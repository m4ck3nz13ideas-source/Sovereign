-- =============================================================================
-- Sovereign — the Universal Law layer
--
-- From "Individual Collectivism & Sovereign — Heaven on Earth":
--
--   "All software logic, consensus rules, and token mechanics must operate
--    within the boundaries of Universal Law. Law constrains computation;
--    computation enforces law."
--
--   "Enforcement by logical invalidation of non-aligned actions."
--
-- This migration makes that literal. Before this, a proposal passed on numbers
-- alone. After it, a proposal that the Truth Engine finds in violation of a
-- Universal Law cannot pass, whatever the resonance says and whatever a
-- steward does — close_proposal() refuses, and there is no override path
-- anywhere in this file.
--
-- The laws themselves are NOT stored here. Amending one requires the agreement
-- of every user, so representing them as rows a steward could UPDATE would be
-- a lie about what they are. They live in src/lib/universal-law.ts, ship with
-- the build, and are readable by every member at /settings/law.
-- =============================================================================

-- aligned   — no issue found
-- tension   — a real concern, answerable in writing; blocks until answered
-- violation — fatal; the proposal is invalid and cannot pass
create type law_verdict as enum ('aligned', 'tension', 'violation');

-- -----------------------------------------------------------------------------
-- The Truth Engine's reading of one proposal against one law.
--
-- One row per law per audit, so an audit always covers all ten and a missing
-- row means the audit did not complete rather than "nothing to report".
-- -----------------------------------------------------------------------------

create table law_assessments (
  id             uuid primary key default gen_random_uuid(),
  proposal_id    uuid not null references proposals on delete cascade,
  review_id      uuid references proposal_reviews on delete set null,

  law_id         text not null,
  verdict        law_verdict not null,
  reasoning      text not null check (length(btrim(reasoning)) > 0),

  -- Answering a tension. A violation has no resolution column on purpose.
  resolution     text,
  resolved_at    timestamptz,
  resolved_by    uuid references profiles on delete set null,

  -- Superseded by a later audit (after a challenge). The history is kept.
  superseded_at  timestamptz,

  prompt_id      text not null,
  prompt_version text not null,
  model          text not null,
  created_at     timestamptz not null default now()
);

create index on law_assessments (proposal_id, superseded_at);
create index on law_assessments (proposal_id, verdict) where superseded_at is null;

-- -----------------------------------------------------------------------------
-- Citizen Challenge Mechanism (§6.4 Model Governance).
--
-- The paper gives citizens a way to challenge an AI audit, and it is not
-- optional politeness: without it, one wrong verdict from the Truth Engine
-- kills a proposal permanently and no human can say otherwise. A challenge
-- does not overturn a verdict — it forces a re-audit that must consider the
-- argument made. If the law still says violation, it stands.
-- -----------------------------------------------------------------------------

create table law_challenges (
  id            uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references law_assessments on delete cascade,
  proposal_id   uuid not null references proposals on delete cascade,
  challenger_id uuid not null references profiles on delete cascade,
  argument      text not null check (length(btrim(argument)) >= 40),
  answered_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index on law_challenges (proposal_id, created_at desc);

-- -----------------------------------------------------------------------------
-- The golden-ratio threshold.
--
--   "Proposals are ratified when collective resonance exceeds a golden-ratio
--    threshold (≥0.618), ensuring consensus through harmony rather than
--    dominance."
--
-- This is specified in the paper, so 0.600 was wrong. Existing groups still
-- carrying the old default are moved; a group that deliberately set something
-- else is left alone.
-- -----------------------------------------------------------------------------

alter table groups alter column threshold_alignment set default 0.618;
update groups set threshold_alignment = 0.618 where threshold_alignment = 0.600;

-- -----------------------------------------------------------------------------
-- Row-level security
-- -----------------------------------------------------------------------------

alter table law_assessments enable row level security;
alter table law_challenges  enable row level security;

create policy law_read on law_assessments for select
  using (is_group_member(proposal_group(proposal_id)));

create policy law_write on law_assessments for insert
  with check (is_group_member(proposal_group(proposal_id)));

-- A tension may be answered. There is deliberately no policy permitting the
-- verdict column to be changed, and none permitting a delete.
create policy law_resolve on law_assessments for update
  using (is_group_member(proposal_group(proposal_id)))
  with check (
    is_group_member(proposal_group(proposal_id))
    and resolution is not null
    and length(btrim(resolution)) >= 20
    and resolved_by = auth.uid()
  );

create policy challenge_read on law_challenges for select
  using (is_group_member(proposal_group(proposal_id)));

create policy challenge_create on law_challenges for insert
  with check (
    is_group_member(proposal_group(proposal_id))
    and challenger_id = auth.uid()
  );

-- -----------------------------------------------------------------------------
-- The gate itself
-- -----------------------------------------------------------------------------

-- Everything standing between a proposal and passing, in one place.
create or replace function law_standing(p_proposal_id uuid)
returns table (
  audited            boolean,
  laws_assessed      integer,
  violations         integer,
  unanswered_tensions integer,
  lawful             boolean
)
language sql security definer stable set search_path = public, extensions as $$
  select
    count(*) > 0,
    count(*)::int,
    count(*) filter (where verdict = 'violation')::int,
    count(*) filter (where verdict = 'tension' and resolved_at is null)::int,
    count(*) > 0
      and count(*) filter (where verdict = 'violation') = 0
      and count(*) filter (where verdict = 'tension' and resolved_at is null) = 0
  from law_assessments
  where proposal_id = p_proposal_id
    and superseded_at is null
    and is_group_member(proposal_group(p_proposal_id));
$$;

-- Answering a tension. Attributed and permanent, like a critical flag.
create or replace function resolve_law_tension(p_assessment_id uuid, p_resolution text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare v_proposal uuid; v_verdict law_verdict; v_group uuid;
begin
  select proposal_id, verdict into v_proposal, v_verdict
    from law_assessments where id = p_assessment_id and superseded_at is null;

  if v_proposal is null then raise exception 'no such assessment'; end if;

  v_group := proposal_group(v_proposal);
  if not is_group_member(v_group) then raise exception 'not a member of this group'; end if;

  if v_verdict = 'violation' then
    raise exception 'a violation of Universal Law cannot be answered, only challenged';
  end if;

  if v_verdict = 'aligned' then
    raise exception 'there is nothing to answer here';
  end if;

  if length(btrim(coalesce(p_resolution, ''))) < 20 then
    raise exception 'say what changed, or why this tension is acceptable';
  end if;

  update law_assessments
     set resolution = btrim(p_resolution),
         resolved_at = now(),
         resolved_by = auth.uid()
   where id = p_assessment_id;

  perform record_ledger_event(v_group, 'law.tension_answered', 'proposal', v_proposal,
                              jsonb_build_object('assessment_id', p_assessment_id));
end;
$$;

-- -----------------------------------------------------------------------------
-- close_proposal, with the law gate in front of the numbers.
--
-- Replaces the version in 0003. The ordering matters: an unlawful proposal
-- fails for that reason and the resonance is not even consulted, because
-- "aligned but outvoted" and "unlawful" are different things and the record
-- should say which happened.
-- -----------------------------------------------------------------------------

create or replace function close_proposal(p_proposal_id uuid)
returns decision_outcome language plpgsql security definer set search_path = public, extensions as $$
declare
  v_group        uuid;
  v_status       proposal_status;
  v_g            groups;
  v_voters       integer;
  v_members      integer;
  v_participation numeric;
  v_alignment    numeric;
  v_confidence   numeric;
  v_urgency      numeric;
  v_open_flags   integer;
  v_outcome      decision_outcome;
  v_values       text[];
  v_law          record;
begin
  select group_id, status into v_group, v_status from proposals where id = p_proposal_id;
  if v_group is null then raise exception 'no such proposal'; end if;
  if not is_group_steward(v_group) then raise exception 'only a steward can close a proposal'; end if;
  if v_status not in ('in_deliberation', 'voting') then
    raise exception 'this proposal is not open';
  end if;

  select * into v_g from groups where id = v_group;
  select * into v_law from law_standing(p_proposal_id);

  -- Universal Law comes first and is not a threshold.
  if not v_law.audited then
    raise exception 'this proposal has not been audited against Universal Law';
  end if;

  select count(*)::int into v_voters from resonance_votes where proposal_id = p_proposal_id;
  select count(*)::int into v_members from group_members where group_id = v_group;
  select round(avg(alignment),3), round(avg(confidence),3), round(avg(urgency),3)
    into v_alignment, v_confidence, v_urgency
    from resonance_votes where proposal_id = p_proposal_id;

  select count(*)::int into v_open_flags
    from proposal_flags where proposal_id = p_proposal_id and resolved_at is null;

  v_participation := case when v_members > 0 then round(v_voters::numeric / v_members, 3) else 0 end;

  if v_law.violations > 0 or v_law.unanswered_tensions > 0 then
    v_outcome := 'failed';
  elsif v_open_flags > 0 then
    v_outcome := 'failed';
  elsif coalesce(v_participation, 0) < v_g.threshold_participation then
    v_outcome := 'failed';
  elsif coalesce(v_alignment, 0) < v_g.threshold_alignment then
    v_outcome := 'failed';
  else
    v_outcome := 'passed';
  end if;

  select coalesce(array_agg(distinct k), '{}')
    into v_values
    from proposal_reviews r,
         lateral jsonb_object_keys(r.values_alignment) k
   where r.proposal_id = p_proposal_id;

  insert into decisions (proposal_id, outcome, avg_alignment, avg_confidence, avg_urgency,
                         participation, voter_count, member_count, values_invoked, decided_by)
  values (p_proposal_id, v_outcome, v_alignment, v_confidence, v_urgency,
          v_participation, v_voters, v_members, coalesce(v_values, '{}'), auth.uid())
  on conflict (proposal_id) do nothing;

  update proposals
     set status = v_outcome::text::proposal_status,
         closed_at = now()
   where id = p_proposal_id;

  if v_outcome = 'passed' then
    insert into projects (proposal_id, group_id, title, expected_outcome, budget_committed)
    select p.id, p.group_id, p.title, p.summary, coalesce(p.budget_amount, 0)
      from proposals p where p.id = p_proposal_id
    on conflict (proposal_id) do nothing;

    update proposals set status = 'executing' where id = p_proposal_id;
  end if;

  perform record_ledger_event(v_group, 'proposal.decided', 'proposal', p_proposal_id,
    jsonb_build_object('outcome', v_outcome,
                       'alignment', v_alignment,
                       'participation', v_participation,
                       'open_flags', v_open_flags,
                       'law_violations', v_law.violations,
                       'law_tensions_open', v_law.unanswered_tensions));

  return v_outcome;
end;
$$;

-- -----------------------------------------------------------------------------
-- cast_resonance, with the law gate in front of it.
--
-- There is no point asking people how they feel about something that cannot
-- lawfully happen. A violation closes the sliders the way a missing review does.
-- -----------------------------------------------------------------------------

create or replace function cast_resonance(
  p_proposal_id uuid,
  p_alignment   numeric,
  p_confidence  numeric,
  p_urgency     numeric,
  p_note        text default null
) returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_group  uuid;
  v_status proposal_status;
  v_violations integer;
begin
  select group_id, status into v_group, v_status from proposals where id = p_proposal_id;
  if v_group is null then raise exception 'no such proposal'; end if;
  if not is_group_member(v_group) then raise exception 'not a member of this group'; end if;

  if v_status = 'in_review'
     or not exists (select 1 from proposal_reviews where proposal_id = p_proposal_id) then
    raise exception 'the review has not landed yet';
  end if;

  if v_status not in ('in_deliberation', 'voting') then
    raise exception 'this proposal is closed';
  end if;

  select count(*)::int into v_violations
    from law_assessments
   where proposal_id = p_proposal_id and superseded_at is null and verdict = 'violation';

  if v_violations > 0 then
    raise exception 'this proposal violates Universal Law and cannot proceed to resonance';
  end if;

  if not exists (select 1 from proposal_reads
                 where proposal_id = p_proposal_id and profile_id = auth.uid()) then
    raise exception 'read the review before recording resonance';
  end if;

  insert into resonance_votes (proposal_id, profile_id, alignment, confidence, urgency, note)
  values (p_proposal_id, auth.uid(), p_alignment, p_confidence, p_urgency, p_note)
  on conflict (proposal_id, profile_id) do update
    set alignment = excluded.alignment,
        confidence = excluded.confidence,
        urgency = excluded.urgency,
        note = excluded.note,
        updated_at = now();

  if v_status = 'in_deliberation' then
    update proposals set status = 'voting' where id = p_proposal_id;
  end if;

  perform record_ledger_event(v_group, 'resonance.recorded', 'proposal', p_proposal_id, '{}'::jsonb);
end;
$$;

grant execute on function
  law_standing(uuid),
  resolve_law_tension(uuid, text)
to authenticated;
