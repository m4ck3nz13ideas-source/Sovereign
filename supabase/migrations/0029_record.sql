-- =============================================================================
-- 0029 — THE RECORD: what was said, raised or read stays said, raised or read
--
-- RECOVERED FROM THE LIVE DATABASE, 4 October 2026. This was written and applied
-- straight to Supabase from another session, which numbered it 0027 and never
-- committed it — so the repository had a different 0027 (concurrency) and no
-- idea this existed. It is reproduced here object for object from what is
-- live, so that the tests run against the schema people actually use, and it
-- is written to be re-runnable: on the live database it changes nothing.
--
-- The finding behind it, in the live table comment's own words: "a policy
-- cannot see which columns changed, and 0027 found one being used to rewrite a
-- verdict."
--
-- Three tables had an UPDATE policy whose `with check` was written to admit an
-- answer — a resolution of twenty characters, signed by the person writing it:
--
--   law_assessments.law_resolve      (0004, 0006)
--   proposal_flags.flags_resolve     (0002, 0006)
--   deliberation_comments.comments_answer   (0009)
--
-- A `with check` sees the row AFTER the update, so it can insist that an
-- answer is present. It cannot see what else the same statement changed. Any
-- member who could reach a proposal could therefore send one update that
-- supplied a signed answer AND set `verdict = 'aligned'` on a violation, or
-- rewrote the body of somebody else's concern, or rewrote a flag's label. The
-- policy passed, because the answer was there.
--
-- Every legitimate write to those rows already goes through a security definer
-- function — resolve_law_tension(), resolve_flag(), answer_contribution(),
-- adopt_amendment() — which checks its own rule. So the policies go, and a
-- trigger on each table fixes what a record is: the words never change, an
-- answer is written once, and the person who wrote it cannot be swapped.
--
-- The same pass closed two neighbours:
--
--   - A proposal's STATUS moved only through the decision functions by
--     intention, but the author's own update policy (`proposals_author_withdraw`)
--     could set it to anything. `guard_proposal_status()` admits the two moves
--     a person makes by hand — review to deliberation, and withdrawing before
--     anybody has voted — and leaves every other move to the definer functions.
--
--   - A contribution to a debate could be deleted by its author at any time,
--     including after it had been answered, adopted into the text, replied to,
--     or after the proposal had closed. Each of those makes it part of somebody
--     else's record. `guard_contribution_delete()` refuses then, and still lets
--     a cascade from an account or proposal being removed through.
--
--   - `amendment_would_reopen()` is security definer and returned other
--     proposals' readings without asking whether the caller could reach them.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Two helpers. A value that is set stays set; a person who signed stays signed
-- (or the account went, and the foreign key set it null).
-- -----------------------------------------------------------------------------

create or replace function frozen_once(p_old anyelement, p_new anyelement)
returns boolean language sql immutable as $$
  select p_old is null or p_old is not distinct from p_new
$$;

create or replace function frozen_person(p_old uuid, p_new uuid)
returns boolean language sql immutable as $$
  select p_old is null or p_new is null or p_old = p_new
$$;

-- -----------------------------------------------------------------------------
-- Law readings
-- -----------------------------------------------------------------------------

create or replace function freeze_law_assessment()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  if new.id             is distinct from old.id
  or new.proposal_id    is distinct from old.proposal_id
  or new.law_id         is distinct from old.law_id
  or new.verdict        is distinct from old.verdict
  or new.reasoning      is distinct from old.reasoning
  or new.prompt_id      is distinct from old.prompt_id
  or new.prompt_version is distinct from old.prompt_version
  or new.model          is distinct from old.model
  or new.created_at     is distinct from old.created_at
  or new.law_revision   is distinct from old.law_revision
  -- review_id may only fall to null, when the review it came from is removed
  or (new.review_id is distinct from old.review_id and new.review_id is not null)
  then
    raise exception 'a law reading is a record: what it said cannot be changed — challenge it instead';
  end if;

  if not frozen_once(old.resolution, new.resolution)
  or not frozen_once(old.resolved_at, new.resolved_at)
  or not frozen_person(old.resolved_by, new.resolved_by)
  or not frozen_once(old.superseded_at, new.superseded_at)
  then
    raise exception 'that reading has already been answered or superseded, and the answer stands';
  end if;

  return new;
end;
$$;

create or replace trigger law_assessments_frozen before update on law_assessments
  for each row execute function freeze_law_assessment();

drop policy if exists law_resolve on law_assessments;

comment on table law_assessments is
  'One reading per law per audit. Updated only by resolve_law_tension() '
  '(security definer). There is deliberately no update policy: a policy cannot '
  'see which columns changed, and 0027 found one being used to rewrite a verdict.';

-- -----------------------------------------------------------------------------
-- Flags
-- -----------------------------------------------------------------------------

create or replace function freeze_proposal_flag()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  if new.id          is distinct from old.id
  or new.proposal_id is distinct from old.proposal_id
  or new.kind        is distinct from old.kind
  or new.label       is distinct from old.label
  or new.severity    is distinct from old.severity
  or new.detail      is distinct from old.detail
  or new.created_at  is distinct from old.created_at
  or (new.review_id is distinct from old.review_id and new.review_id is not null)
  then
    raise exception 'a flag is a record: what it raised cannot be changed — answer it';
  end if;

  if not frozen_once(old.resolution, new.resolution)
  or not frozen_once(old.resolved_at, new.resolved_at)
  or not frozen_person(old.resolved_by, new.resolved_by)
  then
    raise exception 'that flag has already been answered, and the answer stands';
  end if;

  return new;
end;
$$;

create or replace trigger proposal_flags_frozen before update on proposal_flags
  for each row execute function freeze_proposal_flag();

drop policy if exists flags_resolve on proposal_flags;

-- -----------------------------------------------------------------------------
-- What was said in a debate
-- -----------------------------------------------------------------------------

create or replace function freeze_contribution()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  if new.id          is distinct from old.id
  or new.proposal_id is distinct from old.proposal_id
  or new.author_id   is distinct from old.author_id
  or new.parent_id   is distinct from old.parent_id
  or new.kind        is distinct from old.kind
  or new.body        is distinct from old.body
  or new.created_at  is distinct from old.created_at
  then
    raise exception 'what somebody said in the debate cannot be changed afterwards';
  end if;

  if not frozen_once(old.answer, new.answer)
  or not frozen_once(old.answered_at, new.answered_at)
  or not frozen_person(old.answered_by, new.answered_by)
  or not frozen_once(old.adopted_at, new.adopted_at)
  then
    raise exception 'that has already been answered or adopted, and it stands';
  end if;

  return new;
end;
$$;

create or replace trigger deliberation_comments_frozen before update on deliberation_comments
  for each row execute function freeze_contribution();

drop policy if exists comments_answer on deliberation_comments;

create or replace function guard_contribution_delete()
returns trigger language plpgsql set search_path = public, extensions as $$
declare v_status proposal_status;
begin
  -- A delete cascading from an account or a proposal being removed arrives
  -- from the foreign key's own trigger, one level down.
  if pg_trigger_depth() > 1 then
    return old;
  end if;

  if old.answered_at is not null or old.adopted_at is not null then
    raise exception 'that has been answered or adopted — it is part of the record now';
  end if;

  if exists (select 1 from deliberation_comments c where c.parent_id = old.id) then
    raise exception 'somebody has replied to that — it is part of the record now';
  end if;

  select status into v_status from proposals where id = old.proposal_id;
  if v_status is not null
     and v_status not in ('in_review', 'in_deliberation', 'voting') then
    raise exception 'the decision has been made on this debate — it is part of the record now';
  end if;

  return old;
end;
$$;

create or replace trigger deliberation_comments_guard_delete before delete on deliberation_comments
  for each row execute function guard_contribution_delete();

-- -----------------------------------------------------------------------------
-- A proposal's status
-- -----------------------------------------------------------------------------

create or replace function guard_proposal_status()
returns trigger language plpgsql set search_path = public, extensions as $$
declare
  v_owner name;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Security definer functions run as the owner, and every one of them that
  -- moves a status has already checked the rule it is enforcing.
  select pg_get_userbyid(relowner) into v_owner from pg_class where oid = tg_relid;
  if current_user = v_owner then
    return new;
  end if;

  if old.status = 'in_review' and new.status = 'in_deliberation' then
    return new;
  end if;

  if old.status in ('in_review', 'in_deliberation') and new.status = 'withdrawn' then
    return new;
  end if;

  raise exception 'a proposal does not move from % to % by editing it — that happens through the decision rule', old.status, new.status;
end;
$$;

create or replace trigger proposals_guard_status before update of status on proposals
  for each row execute function guard_proposal_status();

-- -----------------------------------------------------------------------------
-- amendment_would_reopen() asks about reach on both sides
-- -----------------------------------------------------------------------------

create or replace function amendment_would_reopen(p_proposal_id uuid)
returns table (
  proposal_id  uuid,
  title        text,
  summary      text,
  reasoning    text,
  law_revision integer,
  decided_at   timestamptz
)
language sql stable security definer set search_path = public, extensions as $$
  select p.id, p.title, p.summary, a.reasoning, a.law_revision, p.closed_at
    from proposals me
    join law_assessments a on a.law_id = me.amends_law
    join proposals p on p.id = a.proposal_id
   where me.id = p_proposal_id
     and me.amends_law is not null
     and can_reach_proposal(me.id)
     and can_reach_proposal(p.id)
     and a.verdict = 'violation'
     and a.superseded_at is null
     and p.id <> p_proposal_id
   order by p.closed_at desc nulls last
   limit 50;
$$;
