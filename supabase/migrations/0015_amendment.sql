-- =============================================================================
-- 0015 — AMENDMENT: the tenth law, applied to the other nine
--
--   "Continuous Evolution — No law is final. Systems must remain open to
--    refinement, learning, and growth."              Universal Law, tenth
--   "Foster Continuous Evolution — implement a recursive amendment protocol,
--    allowing the system to evolve as humanity learns, WHILE MAINTAINING
--    INVARIANCE TO UNIVERSAL LAW."                   §Objectives
--   "Amendability: algorithmic evolution — feedback-driven refinement WITHIN
--    LAWFUL BOUNDS."                                 §Law-based governance
--
-- The source documents say two things that look contradictory: the ten laws
-- are immutable, non-derogable, meta-invariant — and the system must have a
-- recursive amendment protocol, because the tenth law says no law is final.
--
-- They are not contradictory. Read together they say: the WORDING may be
-- refined, the SUBSTANCE may not be weakened. A constitution that cannot be
-- sharpened is a dead one, and law ten forbids that. A constitution that can
-- be narrowed until it permits what it was written to forbid is not one at
-- all.
--
-- So, four things:
--
--   1. THE TEN ARE THE TEN. No repeal, no eleventh, no merge. An amendment
--      changes the words of one existing law, and there is no function here
--      that can do anything else.
--
--   2. AN AMENDMENT IS A GLOBAL PROPOSAL AND NOTHING LESS. A street cannot
--      amend the constitution for everybody, so it goes through the existing
--      global scope — which already means a thousand voices and thirty days —
--      and clears a higher bar on top of that.
--
--   3. IT IS AUDITED AGAINST THE OTHER NINE. The same Truth Engine, the same
--      fatal verdict. An amendment that violates a law cannot amend anything.
--      This is what "invariance to Universal Law" means mechanically.
--
--   4. THE HISTORY IS PUT IN FRONT OF PEOPLE. The dangerous amendment is one
--      that narrows a law so that something previously forbidden becomes
--      permitted. No function can detect that in general — but this instance
--      already has a list of every proposal killed by that exact law, and
--      showing it is the honest contribution. It is a reading list, not a
--      verdict. Sometimes the group was wrong before, and that is precisely
--      the case law ten exists for.
--
-- WHERE THE TEXT LIVES. Revision 1 is the text as shipped, in
-- src/lib/universal-law.ts. Every amendment is a row here, and every
-- assessment records which revision produced it — the same discipline as
-- prompt versions, and for the same reason: a verdict has to be traceable to
-- the wording that produced it.
-- =============================================================================

create table if not exists law_revisions (
  id           uuid primary key default gen_random_uuid(),
  law_id       text not null,
  -- 1 is the shipped text and never appears here. Amendments start at 2.
  revision     integer not null check (revision >= 2),

  text                 text not null check (length(btrim(text)) between 40 and 1200),
  violation_looks_like text not null check (length(btrim(violation_looks_like)) between 40 and 1200),

  -- The proposal that carried it. There is no other way a row gets here.
  adopted_from uuid not null references proposals on delete restrict,
  adopted_at   timestamptz not null default now(),
  adopted_by   uuid references profiles on delete set null,

  unique (law_id, revision)
);

comment on table law_revisions is
  'Amendments to the wording of a Universal Law. Revision 1 is the shipped text and is not stored here. Nothing is ever updated or deleted — a superseded revision stays, because assessments point at it.';

alter table law_revisions enable row level security;

-- The constitution is public. It would be an odd one that was not.
drop policy if exists law_revisions_read on law_revisions;
create policy law_revisions_read on law_revisions for select using (true);

grant select on law_revisions to authenticated, anon;

-- Which wording produced a verdict. Defaults to 1, which is true of every
-- assessment written before this migration and of every law never amended.
alter table law_assessments
  add column if not exists law_revision integer not null default 1;

comment on column law_assessments.law_revision is
  'The revision of the law this verdict was reached under. A reading is only meaningful against the words that produced it.';

-- -----------------------------------------------------------------------------
-- The current wording
-- -----------------------------------------------------------------------------

create or replace function law_current_revision(p_law_id text)
returns integer language sql stable set search_path = public, extensions as $$
  select coalesce(max(revision), 1) from law_revisions where law_id = p_law_id;
$$;

drop function if exists law_text(text);
create or replace function law_text(p_law_id text)
returns table (
  revision             integer,
  text                 text,
  violation_looks_like text,
  adopted_at           timestamptz,
  adopted_from         uuid
)
language sql stable set search_path = public, extensions as $$
  select r.revision, r.text, r.violation_looks_like, r.adopted_at, r.adopted_from
    from law_revisions r
   where r.law_id = p_law_id
   order by r.revision desc
   limit 1;
$$;

grant execute on function law_current_revision(text), law_text(text)
to authenticated, anon;

-- -----------------------------------------------------------------------------
-- A proposal that amends a law
--
-- Deliberately the same object as every other proposal: same readiness gate,
-- same review, same deliberation, same sliders. The constitution is not
-- amended by a special ceremony in a side room — it goes through the thing
-- everything else goes through, and then clears a higher bar.
-- -----------------------------------------------------------------------------

alter table proposals
  add column if not exists amends_law            text,
  add column if not exists amendment_text        text,
  add column if not exists amendment_violation   text;

comment on column proposals.amends_law is
  'The law this proposal rewrites, or null. An amendment is global by definition — a street does not amend the constitution for everybody.';

alter table proposals drop constraint if exists proposals_amendment_shape;
alter table proposals add constraint proposals_amendment_shape check (
  amends_law is null
  or (
    scope = 'global'
    and group_id is null
    and length(btrim(coalesce(amendment_text, ''))) between 40 and 1200
    and length(btrim(coalesce(amendment_violation, ''))) between 40 and 1200
  )
);

create index if not exists proposals_amendment_idx
  on proposals (amends_law) where amends_law is not null;

-- The bar. Deliberately not in scope_rules: a scale's threshold is the
-- group's to set, and this one is not theirs — it is what makes the
-- constitution harder to change than the things the constitution governs.
--
-- And it is applied to the LOWEST voice, not the mean. The rule as written in
-- the source is "to change or add a Universal Law, all users must agree" —
-- unanimity, which on a 0-to-1 scale has no literal reading, since nobody
-- answers yes or no here. The closest honest translation is that NOBODY
-- DISSENTED: every single person who responded is at or above the bar. One
-- person at 0.2 stops it, and that is the intended behaviour rather than an
-- inconvenience. A mean would let a strong majority carry a constitution over
-- a minority's objection, which is precisely what a constitution exists to
-- stop happening to a minority.
create or replace function amendment_threshold()
returns numeric language sql immutable as $$ select 0.900::numeric $$;

grant execute on function amendment_threshold() to authenticated, anon;

-- Nothing about an amendment can be edited after submission, including which
-- law it touches. The text is already frozen by 0007's trigger; this closes
-- the three columns that trigger does not know about.
create or replace function freeze_amendment()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  if new.amends_law is distinct from old.amends_law
     or new.amendment_text is distinct from old.amendment_text
     or new.amendment_violation is distinct from old.amendment_violation then
    raise exception 'an amendment is fixed at submission — withdraw it and write another';
  end if;
  return new;
end;
$$;

drop trigger if exists proposals_freeze_amendment on proposals;
create trigger proposals_freeze_amendment before update on proposals
  for each row execute function freeze_amendment();

-- -----------------------------------------------------------------------------
-- What this instance has refused under this law
--
-- The reading list, not a verdict.
--
-- No function can tell you whether a rewording would permit something it
-- previously forbade — that is a reading, and a machine that claimed to do it
-- would be the most dangerous thing in this codebase. What CAN be done is put
-- the actual history in front of the people voting: here are the proposals
-- this law has killed, in their own words. Decide whether you still want them
-- dead under the new wording.
--
-- Sometimes the answer is yes and the amendment is wrong. Sometimes the answer
-- is that the group was wrong before, which is exactly the case law ten exists
-- for. Either way it should be argued with the evidence on the table.
-- -----------------------------------------------------------------------------

drop function if exists amendment_would_reopen(uuid);
create or replace function amendment_would_reopen(p_proposal_id uuid)
returns table (
  proposal_id uuid,
  title       text,
  summary     text,
  reasoning   text,
  law_revision integer,
  decided_at  timestamptz
)
language sql security definer stable set search_path = public, extensions as $$
  select p.id, p.title, p.summary, a.reasoning, a.law_revision, p.closed_at
    from proposals me
    join law_assessments a on a.law_id = me.amends_law
    join proposals p on p.id = a.proposal_id
   where me.id = p_proposal_id
     and me.amends_law is not null
     and a.verdict = 'violation'
     and a.superseded_at is null
     and p.id <> p_proposal_id
   order by p.closed_at desc nulls last
   limit 50;
$$;

grant execute on function amendment_would_reopen(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Enacting
--
-- Ratification is not enactment, the same way ratification is not activation.
-- close_proposal() stops at `passed`; this is the separate, deliberate act
-- that changes the constitution, and it checks the higher bar itself rather
-- than trusting that whoever closed it applied one.
-- -----------------------------------------------------------------------------

create or replace function enact_amendment(p_proposal_id uuid)
returns uuid language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_p record; v_d record; v_rev integer; v_id uuid; v_violations integer;
  v_lowest numeric;
begin
  select * into v_p from proposals where id = p_proposal_id;
  if not found then raise exception 'no such proposal'; end if;
  if v_p.amends_law is null then raise exception 'that does not amend anything'; end if;

  if not can_reach_proposal(p_proposal_id) then
    raise exception 'this proposal is not addressed to you';
  end if;

  if v_p.status <> 'passed' then
    raise exception 'only an amendment that has passed can be enacted';
  end if;

  select * into v_d from decisions where proposal_id = p_proposal_id;
  if not found then raise exception 'there is no decision on file'; end if;

  -- Nobody dissented: the LOWEST voice, not the mean. See amendment_threshold.
  select min(alignment) into v_lowest
    from resonance_votes where proposal_id = p_proposal_id;

  if v_lowest is null then
    raise exception 'nobody responded to this';
  end if;

  if v_lowest < amendment_threshold() then
    raise exception 'an amendment needs every voice at % or above, and the lowest here is % — a constitution is not carried over an objection',
      amendment_threshold(), v_lowest;
  end if;

  -- Invariance to Universal Law, mechanically: the amendment was audited like
  -- everything else, and a violation is fatal here as everywhere.
  select count(*)::int into v_violations
    from law_assessments
   where proposal_id = p_proposal_id and superseded_at is null and verdict = 'violation';
  if v_violations > 0 then
    raise exception 'this amendment violates Universal Law and cannot be enacted';
  end if;

  -- A tension is not fatal anywhere else and it is not fatal here, but an
  -- UNANSWERED one is: the constitution does not get rewritten over a question
  -- nobody was willing to answer in writing.
  if exists (
    select 1 from law_assessments
     where proposal_id = p_proposal_id and superseded_at is null
       and verdict = 'tension' and resolution is null
  ) then
    raise exception 'answer the tensions in the audit before rewriting a law';
  end if;

  v_rev := law_current_revision(v_p.amends_law) + 1;

  insert into law_revisions (law_id, revision, text, violation_looks_like,
                             adopted_from, adopted_by)
  values (v_p.amends_law, v_rev, btrim(v_p.amendment_text),
          btrim(v_p.amendment_violation), p_proposal_id, auth.uid())
  returning id into v_id;

  update proposals set status = 'completed' where id = p_proposal_id;

  -- Global, so the group is null and the event lands on the public chain.
  perform record_ledger_event(null, 'law.amended', 'proposal', p_proposal_id,
    jsonb_build_object('law', v_p.amends_law,
                       'revision', v_rev,
                       'alignment', v_d.avg_alignment,
                       'lowest_voice', v_lowest,
                       'voices', v_d.voter_count,
                       'verified_voices', v_d.verified_voices));

  return v_id;
end;
$$;

grant execute on function enact_amendment(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Where an amendment stands
-- -----------------------------------------------------------------------------

drop function if exists amendment_standing(uuid);
create or replace function amendment_standing(p_proposal_id uuid)
returns table (
  law_id            text,
  current_revision  integer,
  proposed_text     text,
  proposed_violation text,
  threshold         numeric,
  alignment         numeric,
  lowest_voice      numeric,
  voices            integer,
  passed            boolean,
  enacted           boolean,
  would_reopen      integer
)
language sql security definer stable set search_path = public, extensions as $$
  select
    p.amends_law,
    law_current_revision(p.amends_law),
    p.amendment_text,
    p.amendment_violation,
    amendment_threshold(),
    d.avg_alignment,
    (select min(v.alignment) from resonance_votes v where v.proposal_id = p.id),
    d.voter_count,
    p.status in ('passed', 'completed'),
    exists (select 1 from law_revisions r where r.adopted_from = p.id),
    (select count(*)::int from amendment_would_reopen(p.id))
  from proposals p
  left join decisions d on d.proposal_id = p.id
  where p.id = p_proposal_id
    and p.amends_law is not null
    and can_reach_proposal(p.id);
$$;

grant execute on function amendment_standing(uuid) to authenticated;

-- Every amendment ever put, whatever happened to it. The constitution's own
-- history, including the attempts that failed — a record that only kept the
-- successful ones would be a worse record.
drop function if exists amendment_history(text);
create or replace function amendment_history(p_law_id text default null)
returns table (
  proposal_id uuid,
  law_id      text,
  title       text,
  status      proposal_status,
  alignment   numeric,
  voices      integer,
  revision    integer,
  submitted_at timestamptz,
  closed_at   timestamptz
)
language sql security definer stable set search_path = public, extensions as $$
  select
    p.id, p.amends_law, p.title, p.status,
    d.avg_alignment, d.voter_count,
    (select r.revision from law_revisions r where r.adopted_from = p.id),
    p.submitted_at, p.closed_at
  from proposals p
  left join decisions d on d.proposal_id = p.id
  where p.amends_law is not null
    and (p_law_id is null or p.amends_law = p_law_id)
  order by p.submitted_at desc;
$$;

grant execute on function amendment_history(text) to authenticated;
