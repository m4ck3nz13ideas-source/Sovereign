-- =============================================================================
-- Sovereign — Activate
--
-- The fourth stage of the governance cycle:
--
--   Propose → Align → Vote → ACTIVATE → Reflect
--   "Activate — If supported, resources and people flow to make it real."
--
-- Before this, a proposal that passed became a project immediately, which
-- quietly assumed the money and the hands would appear. They are the part that
-- usually does not. A ratified proposal is now a ratified proposal and nothing
-- more: it becomes real when its needs are actually met by named people.
--
-- WHY THERE IS NO NEW STATUS
--
-- 'passed' already means what activation needs it to mean — ratified, not yet
-- underway — so no enum value is added. That is deliberate beyond tidiness:
-- ALTER TYPE ... ADD VALUE cannot be used in the same transaction that adds
-- it, and the Supabase SQL editor wraps a pasted script in one. A migration
-- that works in psql and fails in the dashboard is a migration that breaks
-- for exactly the people following the README.
--
--   passed    ratified by resonance, waiting on resources
--   executing activated — needs met, project created, work under way
-- =============================================================================

create type commitment_kind as enum ('money', 'time', 'skill', 'material');
create type commitment_status as enum ('pledged', 'honoured', 'withdrawn');

-- -----------------------------------------------------------------------------
-- What a proposal needs before it can be real.
--
-- Stated as quantities so that "we need four people" is checkable rather than
-- a feeling. A proposal with no needs activates immediately, which is correct:
-- "it can be completed without additional needs" is a valid answer.
-- -----------------------------------------------------------------------------

create table proposal_needs (
  id          uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals on delete cascade,
  kind        commitment_kind not null,
  description text not null check (length(btrim(description)) > 0),
  quantity    numeric(14,2) not null check (quantity > 0),
  unit        text not null,
  created_at  timestamptz not null default now(),
  created_by  uuid references profiles on delete set null
);

create index on proposal_needs (proposal_id);

-- -----------------------------------------------------------------------------
-- Who has actually committed what.
--
-- A pledge is a person's name against a quantity. It can be withdrawn while
-- the proposal is still waiting — a commitment somebody cannot honour is worse
-- than one they never made, and a system that traps people into pledges will
-- get fewer of them.
-- -----------------------------------------------------------------------------

create table commitments (
  id           uuid primary key default gen_random_uuid(),
  need_id      uuid not null references proposal_needs on delete cascade,
  proposal_id  uuid not null references proposals on delete cascade,
  profile_id   uuid not null references profiles on delete cascade,
  quantity     numeric(14,2) not null check (quantity > 0),
  note         text,
  status       commitment_status not null default 'pledged',
  created_at   timestamptz not null default now(),
  honoured_at  timestamptz,
  withdrawn_at timestamptz
);

create index on commitments (proposal_id, status);
create index on commitments (need_id) where status = 'pledged';

alter table proposal_needs enable row level security;
alter table commitments    enable row level security;

create policy needs_read on proposal_needs for select
  using (is_group_member(proposal_group(proposal_id)));

-- The author states what the proposal needs; a steward may add what the author
-- missed. Nobody else edits someone else's proposal.
create policy needs_write on proposal_needs for all
  using (
    is_group_steward(proposal_group(proposal_id))
    or exists (select 1 from proposals p where p.id = proposal_id and p.author_id = auth.uid())
  )
  with check (
    is_group_steward(proposal_group(proposal_id))
    or exists (select 1 from proposals p where p.id = proposal_id and p.author_id = auth.uid())
  );

create policy commitments_read on commitments for select
  using (is_group_member(proposal_group(proposal_id)));

-- You pledge for yourself, and you withdraw your own. Nobody commits anyone else.
create policy commitments_own on commitments for all
  using (profile_id = auth.uid() and is_group_member(proposal_group(proposal_id)))
  with check (profile_id = auth.uid() and is_group_member(proposal_group(proposal_id)));

-- -----------------------------------------------------------------------------
-- Where a proposal stands against what it needs
-- -----------------------------------------------------------------------------

create or replace function activation_standing(p_proposal_id uuid)
returns table (
  needs_total     integer,
  needs_met       integer,
  people_pledged  integer,
  ready           boolean
)
language sql security definer stable set search_path = public, extensions as $$
  with n as (
    select
      pn.id,
      pn.quantity as required,
      coalesce((
        select sum(c.quantity) from commitments c
         where c.need_id = pn.id and c.status in ('pledged', 'honoured')
      ), 0) as pledged
    from proposal_needs pn
    where pn.proposal_id = p_proposal_id
  )
  select
    (select count(*)::int from n),
    (select count(*)::int from n where pledged >= required),
    (select count(distinct profile_id)::int from commitments
      where proposal_id = p_proposal_id and status in ('pledged','honoured')),
    -- No needs is ready. Every need met is ready. Anything else is not.
    (select count(*) from n where pledged < required) = 0
  where is_group_member(proposal_group(p_proposal_id));
$$;

-- Per-need detail, for the activation panel.
create or replace function need_standing(p_proposal_id uuid)
returns table (
  need_id     uuid,
  kind        commitment_kind,
  description text,
  unit        text,
  required    numeric,
  pledged     numeric,
  met         boolean
)
language sql security definer stable set search_path = public, extensions as $$
  select
    pn.id, pn.kind, pn.description, pn.unit, pn.quantity,
    coalesce((
      select sum(c.quantity) from commitments c
       where c.need_id = pn.id and c.status in ('pledged','honoured')
    ), 0),
    coalesce((
      select sum(c.quantity) from commitments c
       where c.need_id = pn.id and c.status in ('pledged','honoured')
    ), 0) >= pn.quantity
  from proposal_needs pn
  where pn.proposal_id = p_proposal_id
    and is_group_member(proposal_group(p_proposal_id))
  order by pn.created_at;
$$;

-- -----------------------------------------------------------------------------
-- Activation itself
-- -----------------------------------------------------------------------------

create or replace function activate_proposal(p_proposal_id uuid)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  v_group   uuid;
  v_status  proposal_status;
  v_ready   boolean;
  v_project uuid;
begin
  select group_id, status into v_group, v_status from proposals where id = p_proposal_id;
  if v_group is null then raise exception 'no such proposal'; end if;
  if not is_group_member(v_group) then raise exception 'not a member of this group'; end if;

  if v_status <> 'passed' then
    raise exception 'only a proposal that has passed can be activated';
  end if;

  select ready into v_ready from activation_standing(p_proposal_id);

  if not coalesce(v_ready, false) then
    raise exception 'this proposal still needs resources or people that nobody has committed';
  end if;

  insert into projects (proposal_id, group_id, title, expected_outcome,
                        budget_committed, status, started_at)
  select p.id, p.group_id, p.title, p.summary,
         coalesce((select sum(c.quantity) from commitments c
                    join proposal_needs pn on pn.id = c.need_id
                   where c.proposal_id = p.id and pn.kind = 'money'
                     and c.status in ('pledged','honoured')), 0),
         'executing', now()
    from proposals p where p.id = p_proposal_id
  on conflict (proposal_id) do nothing
  returning id into v_project;

  if v_project is null then
    select id into v_project from projects where proposal_id = p_proposal_id;
  end if;

  update proposals set status = 'executing' where id = p_proposal_id;

  perform record_ledger_event(v_group, 'project.started', 'project', v_project,
    jsonb_build_object('activated_from', p_proposal_id));

  return v_project;
end;
$$;

-- Marking a pledge honoured. Self-attested, and that is the honest level of
-- assurance here — the group can see who said what and whether it happened.
create or replace function honour_commitment(p_commitment_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare v_group uuid; v_proposal uuid;
begin
  select proposal_id into v_proposal from commitments
   where id = p_commitment_id and profile_id = auth.uid();
  if v_proposal is null then raise exception 'that is not your commitment'; end if;

  v_group := proposal_group(v_proposal);

  update commitments
     set status = 'honoured', honoured_at = now()
   where id = p_commitment_id;

  perform record_ledger_event(v_group, 'project.spend', 'proposal', v_proposal,
    jsonb_build_object('commitment_id', p_commitment_id, 'honoured', true));
end;
$$;

-- -----------------------------------------------------------------------------
-- close_proposal, without the automatic project.
--
-- Replaces the version in 0004. The only change is at the end: a proposal that
-- passes now stops at 'passed'. Ratification and activation are different
-- events, and collapsing them was the assumption this migration exists to
-- remove.
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

  -- Stops at 'passed'. activate_proposal() makes it real, once its needs are met.
  update proposals
     set status = v_outcome::text::proposal_status,
         closed_at = now()
   where id = p_proposal_id;

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

grant execute on function
  activation_standing(uuid),
  need_standing(uuid),
  activate_proposal(uuid),
  honour_commitment(uuid)
to authenticated;
