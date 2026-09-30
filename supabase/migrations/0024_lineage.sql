-- =============================================================================
-- 0024 — LINEAGE: what changed the second time, and how far back it goes
--
--   "Every proposal shows: Origin, Evolution, Forks, Votes, Impact, Learnings.
--    Governance as a living organism, not a vote."
--                                      §3.2 What I Strongly Recommend Adding
--
-- `proposals.supersedes` has existed since 0008 and already threads a second
-- attempt back to the first. This does not add another link beside it — a
-- second lineage column would be the worst possible outcome, two answers to
-- one question. It finishes the one that is there, because three things were
-- missing and each of them matters:
--
--   1. NOTHING SAID WHAT CHANGED. The proposal page could say "this supersedes
--      that" and never why. A reader faced with two near-similar proposals and
--      an arrow between them has been given work, not information. §3.2 asks
--      for evolution, and evolution is the difference, not the pointer.
--
--   2. IT WENT ONE GENERATION. The page read one level up and one level down
--      with a direct query, so a third attempt looked like a second one. A
--      group that tried something three times should be able to see that.
--
--   3. IT WAS NOT FROZEN. `check_supersedes()` is a BEFORE INSERT trigger, so
--      the link was validated once and then left editable by the author's own
--      update policy. Re-pointing a proposal's history after people have read
--      it is the same class of edit as rewriting its body, which 0007 forbids,
--      and this one was open.
--
-- WHY THE REASON IS MANDATORY, AND WHY THE CONSTRAINT IS `NOT VALID`
--
-- A second attempt that cannot say what it changed is a duplicate with
-- provenance. So the reason is a check constraint rather than an optional
-- field: twenty characters at least, and null exactly when `supersedes` is
-- null.
--
-- It is added NOT VALID on purpose. Rows that already exist were written
-- before there was anywhere to put a reason, and inventing one for them — or
-- backfilling a placeholder — would put words in somebody's mouth in the one
-- table that is meant to be a record. NOT VALID skips the existing rows and
-- enforces every insert and update from here, which is exactly the shape of
-- the honest answer: the rule starts now.
--
-- WHAT IT STILL DOES NOT DO
--
-- `check_supersedes()` requires the same group, scope and place, so a second
-- attempt goes back to the same people. That stays untouched. It means there
-- is no way to fork a local proposal up to regional scale and call it the same
-- idea, which reads like a missing feature and is a deliberate one: the
-- alternative is venue-shopping, where a proposal that failed on one street
-- gets put to a friendlier room and keeps its history as evidence.
--
-- And lineage reaches nothing. `close_proposal()`, `cast_resonance()` and
-- `can_reach_proposal()` do not read these columns and must not: a second
-- attempt that inherited any of its parent's standing would be a system that
-- rewards persistence over quality.
-- =============================================================================

alter table proposals
  add column if not exists supersedes_reason text;

comment on column proposals.supersedes_reason is
  'What this attempt does differently from the one it supersedes. Mandatory '
  'when supersedes is set, because a second attempt that cannot say what '
  'changed is a duplicate. Frozen at submission.';

-- Null or not-null together, and a real sentence when present.
--
-- NOT VALID: rows written before 0024 had nowhere to put this, and a
-- backfilled placeholder would be words nobody said. See the header.
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'proposals_supersedes_reason_paired'
  ) then
    alter table proposals add constraint proposals_supersedes_reason_paired check (
      (supersedes is null and supersedes_reason is null)
      or (
        supersedes is not null
        and supersedes_reason is not null
        and length(btrim(supersedes_reason)) between 20 and 280
      )
    ) not valid;
  end if;
end $$;

-- A proposal cannot supersede itself. Longer cycles cannot form: the parent
-- has to exist before the child is inserted, and after 0024 the link never
-- moves.
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'proposals_supersedes_not_self'
  ) then
    alter table proposals add constraint proposals_supersedes_not_self
      check (supersedes is null or supersedes <> id) not valid;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- And now it does not move
--
-- 0008 validated the link on the way in and then stopped watching. The author
-- update policy exists so a proposal can be withdrawn; it also let the history
-- be re-pointed afterwards, which is the hole this closes. Same treatment as
-- 0007 gives the text and 0015 gives the amendment columns.
-- -----------------------------------------------------------------------------

create or replace function freeze_lineage()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  if new.supersedes is distinct from old.supersedes
     or new.supersedes_reason is distinct from old.supersedes_reason then
    raise exception
      'where a proposal came from is fixed at submission — re-pointing it after people have read it rewrites its history';
  end if;
  return new;
end;
$$;

drop trigger if exists proposals_freeze_lineage on proposals;
create trigger proposals_freeze_lineage before update on proposals
  for each row execute function freeze_lineage();

-- -----------------------------------------------------------------------------
-- Where this came from, all the way back
--
-- The chain upward, with what happened to each attempt and what the next one
-- changed. It walks only as far as the caller can reach and then stops: an
-- ancestor addressed to people you are not among is not reported, not even as
-- a gap, because "there is one more you cannot see" is itself a disclosure.
-- In practice `check_supersedes()` keeps a chain at one address, so this
-- matters mainly for a group somebody has since left.
--
-- `changed` on each row is what the attempt AFTER it said it was doing
-- differently — read downwards, the chain tells you the story in the order it
-- happened. `generation` is -1 for the parent, -2 for its parent, and so on.
--
-- security definer, so it carries its own reachability check on every row
-- rather than relying on the policy. This schema has made that mistake three
-- times and it is silent every time.
-- -----------------------------------------------------------------------------

drop function if exists proposal_lineage(uuid);
create or replace function proposal_lineage(p_proposal_id uuid)
returns table (
  id           uuid,
  title        text,
  status       text,
  changed      text,
  generation   integer,
  submitted_at timestamptz,
  alignment    numeric,
  outcome      text
)
language plpgsql security definer stable
set search_path = public, extensions as $$
declare
  v_cursor uuid;
  v_child  text;
  v_row    record;
  v_gen    integer := 0;
  v_guard  integer := 0;
begin
  if not coalesce(can_reach_proposal(p_proposal_id), false) then
    return;
  end if;

  select p.supersedes, p.supersedes_reason into v_cursor, v_child
    from proposals p where p.id = p_proposal_id;

  -- The guard is belt and braces. The self-reference check and the freeze
  -- trigger make a cycle unreachable; a runaway loop in a read would be a
  -- worse failure than a short answer.
  while v_cursor is not null and v_guard < 50 loop
    v_guard := v_guard + 1;

    if not coalesce(can_reach_proposal(v_cursor), false) then
      return;
    end if;

    select p.id, p.title, p.status::text, p.submitted_at, p.supersedes,
           p.supersedes_reason, d.avg_alignment, d.outcome::text
      into v_row
      from proposals p
      left join decisions d on d.proposal_id = p.id
     where p.id = v_cursor;

    if not found then
      return;
    end if;

    v_gen := v_gen - 1;

    id           := v_row.id;
    title        := v_row.title;
    status       := v_row.status;
    changed      := v_child;
    generation   := v_gen;
    submitted_at := v_row.submitted_at;
    alignment    := v_row.avg_alignment;
    outcome      := v_row.outcome;
    return next;

    v_cursor := v_row.supersedes;
    v_child  := v_row.supersedes_reason;
  end loop;
end;
$$;

grant execute on function proposal_lineage(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- What came from this
--
-- Direct successors, one level, with what each says it changed. A later
-- attempt at the proposal you are reading is the single most useful thing to
-- know about it.
--
-- No count of these goes anywhere near a person. "Two later attempts exist" is
-- a fact about a proposal; "this author gets rewritten a lot" is a score, and
-- rule 19 has no room for one.
-- -----------------------------------------------------------------------------

drop function if exists proposal_successors(uuid);
create or replace function proposal_successors(p_proposal_id uuid)
returns table (
  id           uuid,
  title        text,
  status       text,
  changed      text,
  author_id    uuid,
  author_name  text,
  submitted_at timestamptz
)
language sql security definer stable set search_path = public, extensions as $$
  select p.id, p.title, p.status::text, p.supersedes_reason,
         p.author_id, pr.display_name, p.submitted_at
    from proposals p
    join profiles pr on pr.id = p.author_id
   where p.supersedes = p_proposal_id
     and coalesce(can_reach_proposal(p_proposal_id), false)
     and coalesce(can_reach_proposal(p.id), false)
   order by p.submitted_at;
$$;

grant execute on function proposal_successors(uuid) to authenticated;
