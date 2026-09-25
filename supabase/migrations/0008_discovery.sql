-- =============================================================================
-- 0008 — DISCOVERY: the feed that decides whether any of this works
--
--   "Users see three types of content: Active proposals. Important updates.
--    Verified knowledge. […] Dormant Ideas — old proposals that need
--    supporters. Purpose: help people discover important issues, prevent
--    overload, show signal over noise."
--
-- This is the part the last two migrations made urgent. A place proposal needs
-- a floor of real responses to pass, and a proposal nobody finds gets none —
-- so a feed that surfaces the right handful is not a nicety here, it is the
-- difference between the loop running and the loop stalling.
--
-- Three things, and no new content type:
--
--   1. attention_queue() — what at this address is actually waiting on YOU,
--      with the reason attached. Not "everything open, newest first".
--   2. dormant_proposals() — proposals that failed for want of people rather
--      than for want of merit, which is a different thing and should be
--      offered back.
--   3. proposals.supersedes — a re-proposal says what it came from, so a
--      second attempt is legible as a second attempt rather than as noise.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Lineage
--
-- Reviving a dormant proposal writes a NEW one. That is not a limitation
-- worked around — it is the existing rule ("a failed proposal is rewritten as
-- a new one") holding, and it means a revival goes through the sharpening pass
-- and the law audit again rather than inheriting a clearance from a different
-- moment. What this column adds is the thread back.
-- -----------------------------------------------------------------------------

alter table proposals
  add column if not exists supersedes uuid references proposals on delete set null;

comment on column proposals.supersedes is
  'The earlier proposal this one was written from. Set when a dormant proposal is taken up again.';

create index if not exists proposals_supersedes_idx
  on proposals (supersedes) where supersedes is not null;

-- The address has to match, or "revival" becomes a way to move a proposal that
-- failed in one place to a friendlier one and call it the same idea.
create or replace function check_supersedes()
returns trigger language plpgsql security definer
set search_path = public as $$
declare v_old record;
begin
  if new.supersedes is null then return new; end if;

  select group_id, scope, place, author_id into v_old
    from proposals where id = new.supersedes;

  if not found then
    raise exception 'that proposal does not exist';
  end if;

  if not can_reach_proposal(new.supersedes) then
    raise exception 'you cannot take up a proposal that was not addressed to you';
  end if;

  if v_old.group_id is distinct from new.group_id
     or v_old.scope is distinct from new.scope
     or place_key(v_old.place) is distinct from place_key(new.place) then
    raise exception 'a proposal taken up again is put to the same people — write it as a new proposal instead';
  end if;

  return new;
end;
$$;

drop trigger if exists proposals_check_supersedes on proposals;
create trigger proposals_check_supersedes
  before insert on proposals
  for each row execute function check_supersedes();

-- -----------------------------------------------------------------------------
-- What is waiting on you
--
-- One row per open proposal at this address, with the reason it is in front of
-- you and how urgent that is. The ordering is the whole point: a feed sorted
-- by recency asks everyone to read everything, which is how people stop
-- reading anything.
--
-- `weight` is a sort key, not a score shown to anyone. Lower is more urgent.
-- -----------------------------------------------------------------------------

create or replace function attention_queue(
  p_group_id uuid default null,
  p_scope    group_scope default null
)
returns table (
  proposal_id uuid,
  title       text,
  summary     text,
  status      proposal_status,
  reason      text,
  detail      text,
  weight      integer,
  closes_at   timestamptz,
  submitted_at timestamptz
)
language sql stable security definer set search_path = public, extensions as $$
  with mine as (
    select p.*
      from proposals p
     where p.status in ('in_review', 'in_deliberation', 'voting')
       and can_reach_proposal(p.id)
       and (
         (p_group_id is not null and p.group_id = p_group_id)
         or (p_group_id is null and p.group_id is null and p.scope = p_scope)
       )
  ),
  standing as (
    select
      m.*,
      (select count(*)::int from law_assessments la
        where la.proposal_id = m.id and la.superseded_at is null) as law_rows,
      (select count(*)::int from law_assessments la
        where la.proposal_id = m.id and la.superseded_at is null
          and la.verdict = 'tension' and la.resolved_at is null) as open_tensions,
      (select count(*)::int from proposal_flags f
        where f.proposal_id = m.id and f.resolved_at is null) as open_flags,
      exists (select 1 from proposal_reviews r where r.proposal_id = m.id) as reviewed,
      exists (select 1 from proposal_reads pr
               where pr.proposal_id = m.id and pr.profile_id = auth.uid()) as i_read,
      exists (select 1 from resonance_votes v
               where v.proposal_id = m.id and v.profile_id = auth.uid()) as i_answered
    from mine m
  )
  select
    s.id, s.title, s.summary, s.status,
    case
      when s.law_rows = 0 then 'not audited yet'
      when s.open_tensions > 0 then 'a tension with Universal Law is unanswered'
      when not s.reviewed then 'not reviewed yet'
      when s.open_flags > 0 then 'a critical flag is unanswered'
      when not s.i_read then 'you have not read the review'
      when not s.i_answered then 'you have not responded'
      else 'waiting on other people'
    end,
    case
      when s.law_rows = 0 then 'Anyone can run the audit. Nothing can proceed until it has run.'
      when s.open_tensions > 0 then s.open_tensions || ' to answer in writing.'
      when not s.reviewed then 'Anyone can run the review.'
      when s.open_flags > 0 then s.open_flags || ' to answer in writing. Unanswered, they fail it whatever the numbers say.'
      when not s.i_read then 'The sliders unlock once you have.'
      when not s.i_answered then 'Three sliders. Two minutes.'
      else 'Nothing for you to do here yet.'
    end,
    case
      when s.law_rows = 0 then 0
      when s.open_tensions > 0 then 1
      when not s.reviewed then 2
      when s.open_flags > 0 then 3
      when not s.i_read then 4
      when not s.i_answered then 5
      else 9
    end,
    s.closes_at,
    s.submitted_at
  from standing s
  order by 7, s.closes_at asc nulls last, s.submitted_at desc;
$$;

grant execute on function attention_queue(uuid, group_scope) to authenticated;

-- -----------------------------------------------------------------------------
-- Dormant
--
--   "Dormant Ideas Feed — rediscover overlooked proposals. Older proposals
--    that may deserve renewed attention."
--
-- Strictly: proposals that failed for want of PEOPLE, not for want of merit.
-- A proposal that broke Universal Law, carried an unanswered flag, or was
-- answered and found wanting is not dormant, it is decided, and offering it
-- back would be the system quietly asking for a different answer.
--
-- Two shapes qualify:
--   - failed with fewer responses than the scale required, everything else clean
--   - passed, and then sat unactivated because nobody committed what it needed
--
-- A proposal already taken up again drops out, so the feed does not keep
-- offering something somebody has already carried forward.
-- -----------------------------------------------------------------------------

create or replace function dormant_proposals(
  p_group_id uuid default null,
  p_scope    group_scope default null,
  p_limit    integer default 12
)
returns table (
  proposal_id  uuid,
  title        text,
  summary      text,
  why          text,
  voices       integer,
  needed       integer,
  decided_at   timestamptz
)
language sql stable security definer set search_path = public, extensions as $$
  with here as (
    select p.*
      from proposals p
     where can_reach_proposal(p.id)
       and (
         (p_group_id is not null and p.group_id = p_group_id)
         or (p_group_id is null and p.group_id is null and p.scope = p_scope)
       )
       and not exists (select 1 from proposals n where n.supersedes = p.id)
  ),
  short as (
    select
      h.id, h.title, h.summary, d.decided_at, d.voter_count,
      coalesce(r.min_voices, 1) as min_voices,
      (select count(*)::int from proposal_flags f
        where f.proposal_id = h.id and f.resolved_at is null) as open_flags,
      (select count(*)::int from law_assessments la
        where la.proposal_id = h.id and la.superseded_at is null
          and (la.verdict = 'violation'
               or (la.verdict = 'tension' and la.resolved_at is null))) as law_problems,
      d.avg_alignment,
      coalesce(r.threshold_alignment, 0.618) as needed_alignment,
      h.status
    from here h
    join decisions d on d.proposal_id = h.id
    left join scope_rules r on r.scope = h.scope and h.group_id is null
  )
  select
    s.id, s.title, s.summary,
    case
      when s.status = 'passed'
        then 'Agreed, and then nobody committed what it needed.'
      else 'Not enough people responded. It was never actually considered.'
    end,
    s.voter_count,
    s.min_voices,
    s.decided_at
  from short s
  where s.open_flags = 0
    and s.law_problems = 0
    and (
      (s.status = 'failed'
        and s.voter_count < s.min_voices
        and coalesce(s.avg_alignment, 0) >= s.needed_alignment)
      or (s.status = 'passed')
    )
  order by s.decided_at desc
  limit greatest(p_limit, 1);
$$;

grant execute on function dormant_proposals(uuid, group_scope, integer) to authenticated;

-- -----------------------------------------------------------------------------
-- What actually happened
--
--   "Positive Signal Feed — verified constructive content. No rage, no outrage
--    farming."
--
-- Read straight off the ledger rather than assembled from the tables, because
-- the ledger is the record of governance acts and a feed built from anything
-- else would be a second, softer account of the same events. Facts with dates
-- on them: decided, started, spent, finished. No engagement counts, no
-- ranking, nothing inferred.
-- -----------------------------------------------------------------------------

create or replace function signal_feed(
  p_group_id uuid default null,
  p_scope    group_scope default null,
  p_limit    integer default 20
)
returns table (
  seq          bigint,
  kind         text,
  subject_id   uuid,
  title        text,
  payload      jsonb,
  actor        text,
  created_at   timestamptz
)
language sql stable security definer set search_path = public, extensions as $$
  select
    e.seq, e.kind, e.subject_id,
    coalesce(p.title, pr.title, 'a record'),
    e.payload,
    coalesce(prof.display_name, 'a member'),
    e.created_at
  from ledger_events e
  left join proposals p  on p.id = e.subject_id and e.subject_type = 'proposal'
  left join projects  pr on pr.id = e.subject_id and e.subject_type = 'project'
  left join profiles  prof on prof.id = e.actor_id
  where e.kind in ('proposal.decided', 'project.started', 'project.completed', 'flag.answered')
    and (
      (p_group_id is not null and e.group_id = p_group_id)
      or (p_group_id is null and e.group_id is null
          and coalesce(p.scope, (select scope from proposals x where x.id = pr.proposal_id)) = p_scope)
    )
    and (
      (e.subject_type = 'proposal' and p.id is not null and can_reach_proposal(p.id))
      or (e.subject_type = 'project' and pr.id is not null and can_reach_project(pr.id))
    )
  order by e.seq desc
  limit greatest(p_limit, 1);
$$;

grant execute on function signal_feed(uuid, group_scope, integer) to authenticated;
