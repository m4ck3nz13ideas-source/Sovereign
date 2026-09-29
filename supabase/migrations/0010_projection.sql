-- =============================================================================
-- 0010 — IMPACT SIMULATION: predictions that can be wrong
--
--   "Impact Simulation — shows possible outcomes. Predicted effects:
--    positive […] risks […]"                      Overview, Screen 2
--   "Governance Simulation and Forecasting — Predictive Outcome Modeling,
--    Feedback-Driven Policy Evolution."           §Subsidiarity / Simulation
--   "After execution: did reality match predictions?"   V1, Phase 6
--
-- The easy version of this feature is a panel of confident sentences and a
-- chart. It reads as a measurement, it costs nothing to produce, and nobody
-- ever finds out it was wrong. That is not a simulation, it is decoration with
-- a scientific typeface.
--
-- So a projection here is a CLAIM WITH A DATE ON IT. Three things make it one:
--
--   1. It is specific and it is dated. A sentence and a horizon — "within 90
--      days of this starting" — because a prediction with no deadline cannot
--      fail, and a prediction that cannot fail is not information.
--   2. It is frozen before the vote. Nothing can be added once the proposal
--      closes, so nobody gets to predict the past, and nothing can be edited
--      or deleted at any point. There is no policy for either.
--   3. It is MARKED AGAINST REALITY. When the horizon passes, somebody writes
--      held, missed or unclear, and says why in their own words. A project
--      cannot complete while a projection that has come due is unmarked —
--      the same rule as the reflection, for the same reason.
--
-- What this deliberately is not: a score on a person. The record of how well
-- predictions here have held is kept for the AI and for the place, and each
-- person can see their own. There is no function that shows you somebody
-- else's, because "Sovereign does not measure moral alignment or score
-- individuals" and a forecast leaderboard is that with extra steps.
-- =============================================================================

do $$ begin
  if not exists (select 1 from pg_type where typname = 'projection_direction') then
    create type projection_direction as enum ('effect', 'risk');
  end if;
  if not exists (select 1 from pg_type where typname = 'projection_source') then
    create type projection_source as enum ('ai', 'human');
  end if;
  if not exists (select 1 from pg_type where typname = 'projection_verdict') then
    create type projection_verdict as enum ('held', 'missed', 'unclear');
  end if;
end $$;

create table if not exists projections (
  id          uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals on delete cascade,

  -- What kind of claim. An effect is what this is meant to do; a risk is what
  -- it might cost. Both are predictions and both get marked the same way.
  direction   projection_direction not null,

  statement   text not null check (
    length(btrim(statement)) between 20 and 240
  ),

  -- Days from the moment the decision is taken. Not a date, because the
  -- decision has not happened yet when this is written.
  horizon_days integer not null check (horizon_days between 1 and 3650),

  -- How sure. Recorded so it can be compared against how it went — a person
  -- who is right 60% of the time and says 0.6 is calibrated, and that is worth
  -- more than someone who is right 80% of the time and always says 0.99.
  confidence  numeric(4,3) check (confidence >= 0 and confidence <= 1),

  -- Whose words these are, and who put them on the record. Both, always: the
  -- model wrote it, a person chose to enter it.
  source      projection_source not null,
  created_by  uuid not null references profiles on delete cascade,

  prompt_id      text,
  prompt_version text,
  model          text,

  -- Marked against reality, once.
  verdict      projection_verdict,
  verdict_note text,
  resolved_at  timestamptz,
  resolved_by  uuid references profiles on delete set null,

  created_at  timestamptz not null default now()
);

comment on table projections is
  'A dated, falsifiable claim about what a proposal will do, frozen before the vote and marked against reality afterwards.';
comment on column projections.source is
  'Whose words. ai means the model wrote the sentence; human means a person did. created_by is who entered it either way.';
comment on column projections.verdict is
  'held, missed or unclear. Set once, with a written note. There is no policy permitting it to change.';

-- The model's words have to carry the rubric that produced them, exactly as a
-- review does. A person's words do not, and must not pretend to.
alter table projections drop constraint if exists projections_provenance;
alter table projections add constraint projections_provenance check (
  (source = 'ai'
     and prompt_id is not null and prompt_version is not null and model is not null)
  or (source = 'human'
     and prompt_id is null and prompt_version is null and model is null)
);

-- A verdict is a verdict, a note and a time, or it is none of them. And a
-- verdict without a reason is a shrug with a label on it.
alter table projections drop constraint if exists projections_verdict_shape;
alter table projections add constraint projections_verdict_shape check (
  (verdict is null and verdict_note is null and resolved_at is null and resolved_by is null)
  or (verdict is not null and resolved_at is not null and resolved_by is not null
      and length(btrim(coalesce(verdict_note, ''))) >= 20)
);

create index if not exists projections_proposal_idx on projections (proposal_id, direction);
create index if not exists projections_open_idx on projections (proposal_id) where verdict is null;

-- -----------------------------------------------------------------------------
-- When a projection comes due
--
-- The clock starts when the decision is taken, not when the sentence was
-- written — a proposal that sat in review for a month should not eat its own
-- horizon. An open proposal has no due date at all, which is the correct
-- answer rather than a missing one.
-- -----------------------------------------------------------------------------

create or replace function projection_due(p_projection_id uuid)
returns timestamptz language sql stable set search_path = public, extensions as $$
  select p.closed_at + make_interval(days => j.horizon_days)
    from projections j
    join proposals p on p.id = j.proposal_id
   where j.id = p_projection_id;
$$;

-- -----------------------------------------------------------------------------
-- Writing one down
--
-- Only while the proposal is still open. The freeze is the whole point: a
-- prediction entered after the vote is a memory, and a prediction entered after
-- the outcome is a lie with a timestamp.
-- -----------------------------------------------------------------------------

create or replace function record_projection(
  p_proposal_id    uuid,
  p_direction      projection_direction,
  p_statement      text,
  p_horizon_days   integer,
  p_confidence     numeric default null,
  p_source         projection_source default 'human',
  p_prompt_id      text default null,
  p_prompt_version text default null,
  p_model          text default null
)
returns uuid language plpgsql security definer
set search_path = public, extensions as $$
declare v_p record; v_id uuid;
begin
  select * into v_p from proposals where id = p_proposal_id;
  if not found then raise exception 'no such proposal'; end if;

  if not can_reach_proposal(p_proposal_id) then
    raise exception 'this proposal is not addressed to you';
  end if;

  -- Open means open: review, deliberation, and right up to the last vote being
  -- counted. What it does not include is anything after the close, which is
  -- where the whole value of the record would go.
  if v_p.status not in ('in_review', 'in_deliberation', 'voting')
     or v_p.closed_at is not null then
    raise exception 'this proposal has closed — a prediction written now is a memory';
  end if;

  if length(btrim(coalesce(p_statement, ''))) < 20 then
    raise exception 'say what will be true, and specifically enough that it could turn out false';
  end if;

  insert into projections (
    proposal_id, direction, statement, horizon_days, confidence,
    source, created_by, prompt_id, prompt_version, model
  )
  values (
    p_proposal_id, p_direction, btrim(p_statement), p_horizon_days, p_confidence,
    p_source, auth.uid(), p_prompt_id, p_prompt_version, p_model
  )
  returning id into v_id;

  perform record_ledger_event(v_p.group_id, 'projection.recorded', 'proposal', p_proposal_id,
    jsonb_build_object('projection', v_id,
                       'direction', p_direction,
                       'horizon_days', p_horizon_days,
                       'source', p_source));

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Marking it against what happened
-- -----------------------------------------------------------------------------

create or replace function resolve_projection(
  p_projection_id uuid,
  p_verdict       projection_verdict,
  p_note          text
)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare v_j record; v_group uuid; v_due timestamptz;
begin
  select * into v_j from projections where id = p_projection_id;
  if not found then raise exception 'no such projection'; end if;

  if v_j.verdict is not null then
    raise exception 'that has been marked already — the record does not get a second answer';
  end if;

  if not can_reach_proposal(v_j.proposal_id) then
    raise exception 'this proposal is not addressed to you';
  end if;

  if length(btrim(coalesce(p_note, ''))) < 20 then
    raise exception 'say what actually happened, in your own words';
  end if;

  v_due := projection_due(p_projection_id);
  if v_due is null then
    raise exception 'this proposal has not been decided yet — there is nothing to measure against';
  end if;
  -- A thing that has already happened can be marked early: that is not a
  -- guess, it is an observation arriving ahead of schedule. A miss cannot,
  -- because until the horizon passes there is still time for it to come true,
  -- and calling it early is just impatience with a verdict attached.
  if v_due > now() and p_verdict <> 'held' then
    raise exception 'this does not come due until % — until then the only thing you can say is that it already happened', v_due::date;
  end if;

  update projections
     set verdict = p_verdict,
         verdict_note = btrim(p_note),
         resolved_at = now(),
         resolved_by = auth.uid()
   where id = p_projection_id;

  select group_id into v_group from proposals where id = v_j.proposal_id;
  perform record_ledger_event(v_group, 'projection.resolved', 'proposal', v_j.proposal_id,
    jsonb_build_object('projection', p_projection_id,
                       'verdict', p_verdict,
                       'source', v_j.source,
                       'horizon_days', v_j.horizon_days));
end;
$$;

-- -----------------------------------------------------------------------------
-- Policies
--
-- Read follows the address, like everything else. There is no insert policy
-- and no delete policy: the only way in is through record_projection(), which
-- enforces the freeze, and there is no way out at all. The one update
-- permitted is a resolution, written the way the function writes it.
-- -----------------------------------------------------------------------------

alter table projections enable row level security;

drop policy if exists projections_read on projections;
create policy projections_read on projections for select
  using (can_reach_proposal(proposal_id));

drop policy if exists projections_resolve on projections;
create policy projections_resolve on projections for update
  using (can_reach_proposal(proposal_id) and verdict is null)
  with check (
    can_reach_proposal(proposal_id)
    and verdict is not null
    and resolved_by = auth.uid()
    and length(btrim(coalesce(verdict_note, ''))) >= 20
  );

-- A policy can say who may update a row. It cannot say which columns, because
-- it never sees the old one. So the freeze is a trigger: the claim, its date,
-- its confidence and whose words they were are what the record is for, and an
-- update that touches any of them is rejected whoever is asking.
create or replace function freeze_projection()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  if new.statement is distinct from old.statement
     or new.direction is distinct from old.direction
     or new.horizon_days is distinct from old.horizon_days
     or new.confidence is distinct from old.confidence
     or new.source is distinct from old.source
     or new.created_by is distinct from old.created_by
     or new.proposal_id is distinct from old.proposal_id
     or new.prompt_id is distinct from old.prompt_id
     or new.prompt_version is distinct from old.prompt_version
     or new.model is distinct from old.model then
    raise exception 'a prediction is not edited after the fact — that is the only thing that makes it one';
  end if;

  if old.verdict is not null then
    raise exception 'that has been marked already — the record does not get a second answer';
  end if;

  return new;
end;
$$;

drop trigger if exists projections_frozen on projections;
create trigger projections_frozen before update on projections
  for each row execute function freeze_projection();

grant select, update on projections to authenticated;

grant execute on function
  record_projection(uuid, projection_direction, text, integer, numeric, projection_source, text, text, text),
  resolve_projection(uuid, projection_verdict, text),
  projection_due(uuid)
to authenticated;

-- -----------------------------------------------------------------------------
-- Where the projections stand on one proposal
-- -----------------------------------------------------------------------------

drop function if exists projection_standing(uuid);
create or replace function projection_standing(p_proposal_id uuid)
returns table (
  total     integer,
  effects   integer,
  risks     integer,
  resolved  integer,
  held      integer,
  missed    integer,
  unclear   integer,
  due_now   integer,
  soonest_due timestamptz
)
language sql security definer stable set search_path = public, extensions as $$
  select
    count(*)::int,
    count(*) filter (where j.direction = 'effect')::int,
    count(*) filter (where j.direction = 'risk')::int,
    count(*) filter (where j.verdict is not null)::int,
    count(*) filter (where j.verdict = 'held')::int,
    count(*) filter (where j.verdict = 'missed')::int,
    count(*) filter (where j.verdict = 'unclear')::int,
    count(*) filter (
      where j.verdict is null
        and p.closed_at is not null
        and p.closed_at + make_interval(days => j.horizon_days) <= now()
    )::int,
    min(p.closed_at + make_interval(days => j.horizon_days))
      filter (where j.verdict is null)
  from projections j
  join proposals p on p.id = j.proposal_id
  where j.proposal_id = p_proposal_id
    and can_reach_proposal(p_proposal_id);
$$;

grant execute on function projection_standing(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- A project cannot complete on unmarked predictions that have come due
--
-- Same rule as the reflection, and the same reason: a decision that never
-- finds out whether it was right teaches nobody anything. Note the "come due"
-- — a ten-year horizon does not hold a project open for ten years, and a
-- system that pretended otherwise would only teach people to write horizons
-- shorter than they believe.
-- -----------------------------------------------------------------------------

create or replace function complete_project(p_project_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare v_group uuid; v_proposal uuid; v_due integer;
begin
  select proposal_id, group_id into v_proposal, v_group from projects where id = p_project_id;
  if v_proposal is null then raise exception 'no such project'; end if;
  if not can_reach_project(p_project_id) then
    raise exception 'this project is not addressed to you';
  end if;

  if not exists (select 1 from reflections where project_id = p_project_id) then
    raise exception 'write the reflection first — what actually happened?';
  end if;

  select count(*)::int into v_due
    from projections j
    join proposals p on p.id = j.proposal_id
   where j.proposal_id = v_proposal
     and j.verdict is null
     and p.closed_at is not null
     and p.closed_at + make_interval(days => j.horizon_days) <= now();

  if v_due > 0 then
    raise exception '% prediction(s) came due and have not been marked — say how they went first', v_due;
  end if;

  update projects set status = 'completed', completed_at = now() where id = p_project_id;
  update proposals set status = 'completed' where id = v_proposal;

  perform record_ledger_event(v_group, 'project.completed', 'project', p_project_id, '{}'::jsonb);
end;
$$;

grant execute on function complete_project(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- The forecasting record
--
-- Two of them, and neither is a leaderboard.
--
-- forecast_record() is the place's: of everything predicted here that has been
-- marked, how much held. Split by whose words they were, because "is the model
-- any good at this" is a question people should be able to answer about the
-- thing advising them, and the only honest answer is a tally.
--
-- my_forecast_record() is your own, and there is no version of it that takes
-- somebody else's id.
-- -----------------------------------------------------------------------------

drop function if exists forecast_record(group_scope, text, uuid);
create or replace function forecast_record(
  p_scope    group_scope default null,
  p_place    text default null,
  p_group_id uuid default null
)
returns table (
  source   projection_source,
  marked   integer,
  held     integer,
  missed   integer,
  unclear  integer,
  hit_rate numeric,
  mean_confidence numeric
)
language sql security definer stable set search_path = public, extensions as $$
  select
    j.source,
    count(*)::int,
    count(*) filter (where j.verdict = 'held')::int,
    count(*) filter (where j.verdict = 'missed')::int,
    count(*) filter (where j.verdict = 'unclear')::int,
    round(
      count(*) filter (where j.verdict = 'held')::numeric
        / nullif(count(*) filter (where j.verdict in ('held', 'missed')), 0),
      3
    ),
    round(avg(j.confidence), 3)
  from projections j
  join proposals p on p.id = j.proposal_id
  where j.verdict is not null
    and can_reach_proposal(j.proposal_id)
    and (p_group_id is null or p.group_id = p_group_id)
    and (p_scope is null or (p.scope = p_scope and p.place is not distinct from p_place))
  group by j.source
  order by j.source;
$$;

drop function if exists my_forecast_record();
create or replace function my_forecast_record()
returns table (
  marked   integer,
  held     integer,
  missed   integer,
  unclear  integer,
  hit_rate numeric,
  mean_confidence numeric
)
language sql security definer stable set search_path = public, extensions as $$
  select
    count(*)::int,
    count(*) filter (where verdict = 'held')::int,
    count(*) filter (where verdict = 'missed')::int,
    count(*) filter (where verdict = 'unclear')::int,
    round(
      count(*) filter (where verdict = 'held')::numeric
        / nullif(count(*) filter (where verdict in ('held', 'missed')), 0),
      3
    ),
    round(avg(confidence), 3)
  from projections
  where created_by = auth.uid()
    and source = 'human'
    and verdict is not null;
$$;

grant execute on function
  forecast_record(group_scope, text, uuid),
  my_forecast_record()
to authenticated;

-- -----------------------------------------------------------------------------
-- What is waiting to be marked
--
-- For the Impact screen: everything that has come due and not been answered,
-- oldest first, because the longer a prediction sits unmarked the more likely
-- it is that nobody remembers what was meant by it.
-- -----------------------------------------------------------------------------

drop function if exists due_projections(uuid, group_scope, integer);
create or replace function due_projections(
  p_group_id uuid default null,
  p_scope    group_scope default null,
  p_limit    integer default 20
)
returns table (
  projection_id uuid,
  proposal_id   uuid,
  title         text,
  direction     projection_direction,
  statement     text,
  source        projection_source,
  confidence    numeric,
  due_at        timestamptz,
  days_overdue  integer
)
language sql security definer stable set search_path = public, extensions as $$
  select
    j.id, p.id, p.title, j.direction, j.statement, j.source, j.confidence,
    p.closed_at + make_interval(days => j.horizon_days),
    extract(day from now() - (p.closed_at + make_interval(days => j.horizon_days)))::int
  from projections j
  join proposals p on p.id = j.proposal_id
  where j.verdict is null
    and p.closed_at is not null
    and p.closed_at + make_interval(days => j.horizon_days) <= now()
    and can_reach_proposal(j.proposal_id)
    and (p_group_id is null or p.group_id = p_group_id)
    and (p_scope is null or p.scope = p_scope)
  order by (p.closed_at + make_interval(days => j.horizon_days)) asc
  limit greatest(p_limit, 1);
$$;

grant execute on function due_projections(uuid, group_scope, integer) to authenticated;
