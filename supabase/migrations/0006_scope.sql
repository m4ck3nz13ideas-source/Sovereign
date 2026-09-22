-- =============================================================================
-- 0006 — SCOPE: the Subsidiarity Engine
--
--   "Right Scale of Action → Local before global — subsidiarity embedded in
--    protocol."
--   "Subsidiarity by interface, not just philosophy."
--
-- Until now a proposal was addressed to a group, and you could not take part in
-- anything without being invited into one. That is the wrong shape for the
-- thing being built: you do not join a committee to have a view about the
-- street you live on.
--
-- After this migration a proposal is addressed either to a GROUP — a named set
-- of people who invited each other — or to a PLACE at one of five scales. Both
-- run the identical loop. What changes is who is eligible, and how the decision
-- rule finds its numbers.
--
-- Where you are is four lines of text you type, not a coordinate. Geocoding is
-- a third-party dependency and a precise location is the most sensitive thing a
-- governance system could hold; a place name you claim is checkable by the
-- people standing next to you, which is the only verification that matters at
-- local scale and the only one honestly available at any other.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Where you are
-- -----------------------------------------------------------------------------

alter table profiles
  add column if not exists place_local       text,
  add column if not exists place_regional    text,
  add column if not exists place_national    text,
  add column if not exists place_continental text,
  add column if not exists place_set_at      timestamptz;

comment on column profiles.place_local is
  'A neighbourhood, town or village, as the person writes it. Never a coordinate.';

-- Matching is on a normalised form so "Stoke Newington" and " stoke  newington "
-- are the same place, while nothing about the stored text is changed — people
-- should see back exactly what they typed.
create or replace function place_key(t text)
returns text language sql immutable set search_path = public as $$
  select nullif(lower(regexp_replace(btrim(coalesce(t, '')), '\s+', ' ', 'g')), '');
$$;

-- -----------------------------------------------------------------------------
-- The rule at each scale
--
-- A group knows how many members it has, so participation is a share. A place
-- does not: there is no register of everyone in a city, and building one would
-- be a surveillance project rather than a governance one. So at place scale the
-- share is replaced by a floor on how many people actually responded — the
-- honest substitute, and the one the interface must state plainly rather than
-- dressing up as a percentage of a population nobody counted.
--
-- The alignment threshold does not move. 0.618 at every scale, because it is a
-- statement about what agreement means, not a difficulty setting.
-- -----------------------------------------------------------------------------

create table if not exists scope_rules (
  scope               group_scope primary key,
  threshold_alignment numeric(4,3) not null default 0.618,
  min_voices          integer not null default 1 check (min_voices >= 1),
  deliberation_days   integer not null default 0 check (deliberation_days >= 0),
  note                text
);

insert into scope_rules (scope, min_voices, deliberation_days, note) values
  ('local', 1, 0,
   'The people are in the room. The window is the conversation they have already had, and one considered response with nobody objecting is a real decision — the ledger records exactly who made it. This is the first number to raise as an instance grows.'),
  ('regional', 12, 7,
   'Beyond the room. Twelve is the smallest number at which a response is unlikely to be one household.'),
  ('national', 50, 14, null),
  ('continental', 200, 21, null),
  ('global', 1000, 30,
   'A global proposal that a thousand people have not read has not been considered globally, whatever its alignment score says.')
on conflict (scope) do nothing;

alter table scope_rules enable row level security;

-- Readable by everyone, changed by nobody from the client. A person governed by
-- a rule can read the rule; an instance operator changes it in SQL, on purpose.
create policy scope_rules_read on scope_rules for select using (true);
grant select on scope_rules to authenticated;

-- -----------------------------------------------------------------------------
-- A proposal is addressed to a group, or to a place
-- -----------------------------------------------------------------------------

alter table proposals
  alter column group_id drop not null;

alter table proposals
  add column if not exists place     text,
  add column if not exists closes_at timestamptz;

alter table proposals drop constraint if exists proposals_addressed;
alter table proposals add constraint proposals_addressed check (
  group_id is not null
  or scope = 'global'
  or (place is not null and btrim(place) <> '')
);

create index if not exists proposals_place_idx
  on proposals (scope, status, submitted_at desc)
  where group_id is null;

-- A project inherits its proposal's address, so it can have no group either.
alter table projects alter column group_id drop not null;

-- The deliberation window, set once at submission from the rule in force then.
-- Changing scope_rules later never reopens or shortens a proposal already out.
create or replace function set_proposal_window()
returns trigger language plpgsql set search_path = public as $$
declare v_days integer;
begin
  if new.group_id is null and new.closes_at is null then
    select deliberation_days into v_days from scope_rules where scope = new.scope;
    new.closes_at := now() + (coalesce(v_days, 0) || ' days')::interval;
  end if;
  return new;
end;
$$;

drop trigger if exists proposals_set_window on proposals;
create trigger proposals_set_window
  before insert on proposals
  for each row execute function set_proposal_window();

-- Who a proposal is addressed to, and when its deliberation ends, are fixed at
-- submission. Without this the author could move a proposal to a place where
-- the response suited them better, or shorten the window once the numbers were
-- in. The author-withdraw policy is a permission to withdraw, not to re-aim.
create or replace function freeze_proposal_address()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.group_id is distinct from old.group_id
     or new.scope is distinct from old.scope
     or new.place is distinct from old.place
     or new.closes_at is distinct from old.closes_at then
    raise exception 'a proposal''s address and deliberation window are fixed at submission';
  end if;
  return new;
end;
$$;

drop trigger if exists proposals_freeze_address on proposals;
create trigger proposals_freeze_address
  before update on proposals
  for each row execute function freeze_proposal_address();

-- -----------------------------------------------------------------------------
-- Eligibility
-- -----------------------------------------------------------------------------

-- Are you in this place, at this scale? Global is everyone, which is the point
-- of the word.
create or replace function in_scope(p_profile uuid, p_scope group_scope, p_place text)
returns boolean language plpgsql stable security definer
set search_path = public as $$
declare v_mine text;
begin
  if p_profile is null then return false; end if;
  if p_scope = 'global' then return true; end if;

  select case p_scope
           when 'local'       then place_local
           when 'regional'    then place_regional
           when 'national'    then place_national
           when 'continental' then place_continental
         end
    into v_mine
    from profiles where id = p_profile;

  return place_key(v_mine) is not null
     and place_key(v_mine) = place_key(p_place);
end;
$$;

-- The single eligibility question, asked everywhere. A group proposal asks
-- membership; a place proposal asks where you are. Nothing above this function
-- needs to know which kind it is looking at.
create or replace function can_reach_proposal(pid uuid)
returns boolean language plpgsql stable security definer
set search_path = public as $$
declare v_p record;
begin
  select group_id, scope, place into v_p from proposals where id = pid;
  if not found then return false; end if;

  if v_p.group_id is not null then
    return is_group_member(v_p.group_id);
  end if;

  return in_scope(auth.uid(), v_p.scope, v_p.place);
end;
$$;

-- Who may add what a proposal needs, and who may close it. A group proposal
-- keeps its stewards. A place proposal has none — so it is the author, and the
-- clock.
create or replace function can_steward_proposal(pid uuid)
returns boolean language plpgsql stable security definer
set search_path = public as $$
declare v_p record;
begin
  select group_id, author_id into v_p from proposals where id = pid;
  if not found then return false; end if;
  if v_p.author_id = auth.uid() then return true; end if;
  return v_p.group_id is not null and is_group_steward(v_p.group_id);
end;
$$;

create or replace function can_reach_project(pid uuid)
returns boolean language plpgsql stable security definer
set search_path = public as $$
declare v_proposal uuid;
begin
  select proposal_id into v_proposal from projects where id = pid;
  if v_proposal is null then return false; end if;
  return can_reach_proposal(v_proposal);
end;
$$;

grant execute on function
  place_key(text),
  in_scope(uuid, group_scope, text),
  can_reach_proposal(uuid),
  can_steward_proposal(uuid),
  can_reach_project(uuid)
to authenticated;

-- -----------------------------------------------------------------------------
-- Every policy that asked "are you in this group" now asks "can you reach this"
-- -----------------------------------------------------------------------------

-- Written against the row's own columns rather than through
-- can_reach_proposal(). A function that looks the proposal up cannot see the
-- row an INSERT ... RETURNING is in the middle of writing, so the author would
-- be refused sight of their own proposal at the moment of submitting it.
drop policy if exists proposals_read on proposals;
create policy proposals_read on proposals for select
  using (
    (group_id is not null and is_group_member(group_id))
    or (group_id is null and in_scope(auth.uid(), scope, place))
  );

-- You may address a proposal to a group you are in, or to a place you are in.
-- You cannot propose for somewhere you do not live. That is subsidiarity at the
-- only point where it can actually be enforced.
drop policy if exists proposals_create on proposals;
create policy proposals_create on proposals for insert
  with check (
    author_id = auth.uid()
    and (
      (group_id is not null and is_group_member(group_id))
      or (group_id is null and in_scope(auth.uid(), scope, place))
    )
  );

drop policy if exists reviews_read on proposal_reviews;
create policy reviews_read on proposal_reviews for select
  using (can_reach_proposal(proposal_id));

drop policy if exists reviews_create on proposal_reviews;
create policy reviews_create on proposal_reviews for insert
  with check (can_reach_proposal(proposal_id));

drop policy if exists flags_read on proposal_flags;
create policy flags_read on proposal_flags for select
  using (can_reach_proposal(proposal_id));

drop policy if exists flags_create on proposal_flags;
create policy flags_create on proposal_flags for insert
  with check (can_reach_proposal(proposal_id));

drop policy if exists flags_resolve on proposal_flags;
create policy flags_resolve on proposal_flags for update
  using (can_reach_proposal(proposal_id))
  with check (
    can_reach_proposal(proposal_id)
    and resolution is not null
    and length(btrim(resolution)) >= 20
    and resolved_by = auth.uid()
  );

drop policy if exists comments_read on deliberation_comments;
create policy comments_read on deliberation_comments for select
  using (can_reach_proposal(proposal_id));

drop policy if exists comments_create on deliberation_comments;
create policy comments_create on deliberation_comments for insert
  with check (can_reach_proposal(proposal_id) and author_id = auth.uid());

drop policy if exists reads_own on proposal_reads;
create policy reads_own on proposal_reads for all
  using (profile_id = auth.uid() and can_reach_proposal(proposal_id))
  with check (profile_id = auth.uid() and can_reach_proposal(proposal_id));

drop policy if exists resonance_read_closed on resonance_votes;
create policy resonance_read_closed on resonance_votes for select
  using (
    profile_id = auth.uid()
    or exists (
      select 1 from proposals p
      where p.id = proposal_id
        and can_reach_proposal(p.id)
        and p.status in ('passed', 'failed', 'executing', 'completed')
    )
  );

drop policy if exists decisions_read on decisions;
create policy decisions_read on decisions for select
  using (can_reach_proposal(proposal_id));

drop policy if exists law_read on law_assessments;
create policy law_read on law_assessments for select
  using (can_reach_proposal(proposal_id));

drop policy if exists law_write on law_assessments;
create policy law_write on law_assessments for insert
  with check (can_reach_proposal(proposal_id));

drop policy if exists law_resolve on law_assessments;
create policy law_resolve on law_assessments for update
  using (can_reach_proposal(proposal_id))
  with check (
    can_reach_proposal(proposal_id)
    and resolution is not null
    and length(btrim(resolution)) >= 20
    and resolved_by = auth.uid()
  );

drop policy if exists challenge_read on law_challenges;
create policy challenge_read on law_challenges for select
  using (can_reach_proposal(proposal_id));

drop policy if exists challenge_create on law_challenges;
create policy challenge_create on law_challenges for insert
  with check (can_reach_proposal(proposal_id) and challenger_id = auth.uid());

drop policy if exists needs_read on proposal_needs;
create policy needs_read on proposal_needs for select
  using (can_reach_proposal(proposal_id));

drop policy if exists needs_write on proposal_needs;
create policy needs_write on proposal_needs for all
  using (can_steward_proposal(proposal_id))
  with check (can_steward_proposal(proposal_id));

drop policy if exists commitments_read on commitments;
create policy commitments_read on commitments for select
  using (can_reach_proposal(proposal_id));

drop policy if exists commitments_own on commitments;
create policy commitments_own on commitments for all
  using (profile_id = auth.uid() and can_reach_proposal(proposal_id))
  with check (profile_id = auth.uid() and can_reach_proposal(proposal_id));

drop policy if exists projects_read on projects;
create policy projects_read on projects for select
  using (proposal_id is not null and can_reach_proposal(proposal_id));

drop policy if exists projects_write on projects;
create policy projects_write on projects for all
  using (can_reach_proposal(proposal_id))
  with check (can_reach_proposal(proposal_id));

drop policy if exists tasks_all on project_tasks;
create policy tasks_all on project_tasks for all
  using (can_reach_project(project_id))
  with check (can_reach_project(project_id));

drop policy if exists updates_read on project_updates;
create policy updates_read on project_updates for select
  using (can_reach_project(project_id));

drop policy if exists updates_create on project_updates;
create policy updates_create on project_updates for insert
  with check (can_reach_project(project_id) and author_id = auth.uid());

drop policy if exists reflections_read on reflections;
create policy reflections_read on reflections for select
  using (can_reach_project(project_id));

drop policy if exists reflections_create on reflections;
create policy reflections_create on reflections for insert
  with check (can_reach_project(project_id) and created_by = auth.uid());

-- -----------------------------------------------------------------------------
-- The functions that gated on membership
-- -----------------------------------------------------------------------------

-- Same two functions as before. The only thing that changes is the question
-- asked at the top, and that member_count is null where there is no register to
-- be a share of — a number the interface must not invent.
drop function if exists resonance_summary(uuid);
create or replace function resonance_summary(p_proposal_id uuid)
returns table (
  voter_count    integer,
  member_count   integer,
  avg_alignment  numeric,
  avg_confidence numeric,
  avg_urgency    numeric,
  revealed       boolean
)
language plpgsql security definer stable set search_path = public, extensions as $$
declare
  v_group    uuid;
  v_status   proposal_status;
  v_revealed boolean;
  v_members  integer;
begin
  select group_id, status into v_group, v_status from proposals where id = p_proposal_id;
  if not found then raise exception 'no such proposal'; end if;
  if not can_reach_proposal(p_proposal_id) then
    raise exception 'this proposal is not addressed to you';
  end if;

  v_revealed := v_status in ('passed', 'failed', 'executing', 'completed');

  if v_group is null then
    v_members := null;
  else
    select count(*)::int into v_members from group_members where group_id = v_group;
  end if;

  return query
  select
    (select count(*)::int from resonance_votes where proposal_id = p_proposal_id),
    v_members,
    case when v_revealed then (select round(avg(alignment), 3) from resonance_votes where proposal_id = p_proposal_id) end,
    case when v_revealed then (select round(avg(confidence), 3) from resonance_votes where proposal_id = p_proposal_id) end,
    case when v_revealed then (select round(avg(urgency), 3) from resonance_votes where proposal_id = p_proposal_id) end,
    v_revealed;
end;
$$;

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
  if not found then raise exception 'no such proposal'; end if;
  if not can_reach_proposal(p_proposal_id) then
    raise exception 'this proposal is not addressed to you';
  end if;

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

-- -----------------------------------------------------------------------------
-- The decision rule, at either address
-- -----------------------------------------------------------------------------

create or replace function close_proposal(p_proposal_id uuid)
returns decision_outcome language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_p            record;
  v_g            groups;
  v_rule         scope_rules;
  v_voters       integer;
  v_members      integer;
  v_participation numeric;
  v_alignment    numeric;
  v_confidence   numeric;
  v_urgency      numeric;
  v_open_flags   integer;
  v_outcome      decision_outcome;
  v_values       text[];
  v_needed       numeric;
  v_law          record;
begin
  select * into v_p from proposals where id = p_proposal_id;
  if not found then raise exception 'no such proposal'; end if;

  if v_p.status not in ('in_deliberation', 'voting') then
    raise exception 'this proposal is not open';
  end if;

  if v_p.group_id is not null then
    if not is_group_steward(v_p.group_id) then
      raise exception 'only a steward can close a proposal';
    end if;
    select * into v_g from groups where id = v_p.group_id;
  else
    -- A place has no steward, so nobody may pick the moment. The window closes
    -- it, and anyone it was addressed to can perform the closing.
    if not can_reach_proposal(p_proposal_id) then
      raise exception 'this proposal is not addressed to you';
    end if;
    if v_p.closes_at is not null and now() < v_p.closes_at then
      raise exception 'deliberation is open until %', to_char(v_p.closes_at, 'DD Mon YYYY HH24:MI');
    end if;
    select * into v_rule from scope_rules where scope = v_p.scope;
  end if;

  select * into v_law from law_standing(p_proposal_id);
  if not v_law.audited then
    raise exception 'this proposal has not been audited against Universal Law';
  end if;

  select count(*)::int into v_voters from resonance_votes where proposal_id = p_proposal_id;
  select round(avg(alignment),3), round(avg(confidence),3), round(avg(urgency),3)
    into v_alignment, v_confidence, v_urgency
    from resonance_votes where proposal_id = p_proposal_id;

  select count(*)::int into v_open_flags
    from proposal_flags where proposal_id = p_proposal_id and resolved_at is null;

  if v_p.group_id is not null then
    select count(*)::int into v_members from group_members where group_id = v_p.group_id;
    v_participation := case when v_members > 0
                            then round(v_voters::numeric / v_members, 3) else 0 end;
    v_needed := v_g.threshold_alignment;
  else
    v_members := 0;
    v_participation := null;
    v_needed := v_rule.threshold_alignment;
  end if;

  if v_law.violations > 0 or v_law.unanswered_tensions > 0 then
    v_outcome := 'failed';
  elsif v_open_flags > 0 then
    v_outcome := 'failed';
  elsif v_p.group_id is not null
        and coalesce(v_participation, 0) < v_g.threshold_participation then
    v_outcome := 'failed';
  elsif v_p.group_id is null and v_voters < v_rule.min_voices then
    v_outcome := 'failed';
  elsif coalesce(v_alignment, 0) < v_needed then
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
          v_participation, v_voters, coalesce(v_members, 0), coalesce(v_values, '{}'), auth.uid())
  on conflict (proposal_id) do nothing;

  update proposals
     set status = v_outcome::text::proposal_status,
         closed_at = now()
   where id = p_proposal_id;

  perform record_ledger_event(v_p.group_id, 'proposal.decided', 'proposal', p_proposal_id,
    jsonb_build_object('outcome', v_outcome,
                       'scope', v_p.scope,
                       'place', v_p.place,
                       'alignment', v_alignment,
                       'voices', v_voters,
                       'participation', v_participation,
                       'open_flags', v_open_flags,
                       'law_violations', v_law.violations,
                       'law_tensions_open', v_law.unanswered_tensions));

  return v_outcome;
end;
$$;

create or replace function activate_proposal(p_proposal_id uuid)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  v_p       record;
  v_ready   boolean;
  v_project uuid;
begin
  select * into v_p from proposals where id = p_proposal_id;
  if not found then raise exception 'no such proposal'; end if;
  if not can_reach_proposal(p_proposal_id) then
    raise exception 'this proposal is not addressed to you';
  end if;

  if v_p.status <> 'passed' then
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

  perform record_ledger_event(v_p.group_id, 'project.started', 'project', v_project,
    jsonb_build_object('activated_from', p_proposal_id, 'scope', v_p.scope, 'place', v_p.place));

  return v_project;
end;
$$;

-- The remaining membership gates, restated against the address. Nothing else
-- in these functions changes — same wording, same ledger events, same order.
create or replace function resolve_flag(p_flag_id uuid, p_resolution text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare v_proposal uuid; v_group uuid;
begin
  select proposal_id into v_proposal from proposal_flags where id = p_flag_id;
  if v_proposal is null then raise exception 'no such flag'; end if;
  if not can_reach_proposal(v_proposal) then
    raise exception 'this proposal is not addressed to you';
  end if;
  if length(btrim(coalesce(p_resolution, ''))) < 20 then
    raise exception 'an answer needs to say what changed, or why the risk is acceptable';
  end if;

  update proposal_flags
     set resolution = btrim(p_resolution),
         resolved_at = now(),
         resolved_by = auth.uid()
   where id = p_flag_id;

  select group_id into v_group from proposals where id = v_proposal;
  perform record_ledger_event(v_group, 'flag.answered', 'proposal', v_proposal,
                              jsonb_build_object('flag_id', p_flag_id));
end;
$$;

create or replace function resolve_law_tension(p_assessment_id uuid, p_resolution text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare v_proposal uuid; v_verdict law_verdict; v_group uuid;
begin
  select proposal_id, verdict into v_proposal, v_verdict
    from law_assessments where id = p_assessment_id and superseded_at is null;

  if v_proposal is null then raise exception 'no such assessment'; end if;
  if not can_reach_proposal(v_proposal) then
    raise exception 'this proposal is not addressed to you';
  end if;

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

  select group_id into v_group from proposals where id = v_proposal;
  perform record_ledger_event(v_group, 'law.tension_answered', 'proposal', v_proposal,
                              jsonb_build_object('assessment_id', p_assessment_id));
end;
$$;

drop function if exists activation_standing(uuid);
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
    (select count(*) from n where pledged < required) = 0
  where can_reach_proposal(p_proposal_id);
$$;

drop function if exists law_standing(uuid);
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
    and can_reach_proposal(p_proposal_id);
$$;

drop function if exists need_standing(uuid);
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
    and can_reach_proposal(p_proposal_id)
  order by pn.created_at;
$$;

create or replace function complete_project(p_project_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare v_group uuid; v_proposal uuid;
begin
  select proposal_id, group_id into v_proposal, v_group from projects where id = p_project_id;
  if v_proposal is null then raise exception 'no such project'; end if;
  if not can_reach_project(p_project_id) then
    raise exception 'this project is not addressed to you';
  end if;

  if not exists (select 1 from reflections where project_id = p_project_id) then
    raise exception 'write the reflection first — what actually happened?';
  end if;

  update projects set status = 'completed', completed_at = now() where id = p_project_id;
  update proposals set status = 'completed' where id = v_proposal;

  perform record_ledger_event(v_group, 'project.completed', 'project', p_project_id, '{}'::jsonb);
end;
$$;

-- Retrieval has to follow the address too. A proposal about this street should
-- be reviewed against what this street decided before, not against a group the
-- author happens to belong to.
create or replace function related_decisions_for(
  p_proposal_id uuid,
  p_values      text[],
  p_limit       integer default 6
)
returns table (
  decision_id      uuid,
  proposal_id      uuid,
  title            text,
  outcome          decision_outcome,
  decided_at       timestamptz,
  values_invoked   text[],
  overlap          integer,
  expected_outcome text,
  actual_outcome   text,
  lesson           text
)
language sql security definer stable set search_path = public, extensions as $$
  with me as (select group_id, scope, place from proposals where id = p_proposal_id)
  select
    d.id, p.id, p.title, d.outcome, d.decided_at, d.values_invoked,
    cardinality(array(
      select unnest(d.values_invoked) intersect select unnest(p_values)
    )) as overlap,
    pr.expected_outcome, rf.actual_outcome, rf.lesson
  from decisions d
  join proposals p on p.id = d.proposal_id
  cross join me
  left join projects pr on pr.proposal_id = p.id
  left join reflections rf on rf.project_id = pr.id
  where p.id <> p_proposal_id
    and can_reach_proposal(p_proposal_id)
    and (
      (me.group_id is not null and p.group_id = me.group_id)
      or (me.group_id is null and p.group_id is null
          and p.scope = me.scope
          and place_key(p.place) is not distinct from place_key(me.place))
    )
  order by overlap desc, d.decided_at desc
  limit greatest(p_limit, 1);
$$;

grant execute on function related_decisions_for(uuid, text[], integer) to authenticated;

-- Place-scoped governance has no group, so its events form one chain with a
-- null group_id — the public one, which the ledger_read policy already lets
-- anyone read. That is the right answer rather than an accident: a decision
-- taken in the open should be auditable in the open. verify_ledger() with no
-- argument replays it.
create or replace function verify_ledger(p_group_id uuid default null)
returns table (ok boolean, checked integer, broken_at bigint)
language plpgsql security definer set search_path = public, extensions as $$
declare
  r      record;
  v_prev text := null;
  v_calc text;
  v_n    integer := 0;
begin
  if p_group_id is not null and not is_group_member(p_group_id) then
    raise exception 'not a member of this group';
  end if;

  for r in
    select * from ledger_events
     where group_id is not distinct from p_group_id
     order by seq asc
  loop
    v_calc := encode(
      digest(
        coalesce(v_prev, 'genesis') || '|' ||
        coalesce(r.group_id::text, '-') || '|' ||
        coalesce(r.actor_id::text, '-') || '|' ||
        r.kind || '|' || r.subject_type || '|' ||
        coalesce(r.subject_id::text, '-') || '|' ||
        r.payload::text || '|' || r.created_at::text,
        'sha256'
      ),
      'hex'
    );
    v_n := v_n + 1;
    if v_calc <> r.hash then
      return query select false, v_n, r.seq;
      return;
    end if;
    v_prev := r.hash;
  end loop;

  return query select true, v_n, null::bigint;
end;
$$;

-- -----------------------------------------------------------------------------
-- Connection's own feed
--
-- A post with no group used to reach only people who shared a group with the
-- author — which means someone who has joined nothing posts into silence. The
-- neighbours are the obvious other audience, and local is deliberately the
-- only scale used here: sharing a continent is not a relationship, and a feed
-- that behaves as though it were is the thing this product is not.
-- -----------------------------------------------------------------------------

create or replace function shares_local_place_with(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from profiles me, profiles them
     where me.id = auth.uid()
       and them.id = other
       and place_key(me.place_local) is not null
       and place_key(me.place_local) = place_key(them.place_local)
  );
$$;

grant execute on function shares_local_place_with(uuid) to authenticated;

drop policy if exists posts_read on posts;
create policy posts_read on posts for select
  using (
    author_id = auth.uid()
    or (group_id is not null and is_group_member(group_id))
    or (group_id is null and (
          shares_group_with(author_id)
          or shares_local_place_with(author_id)
        ))
  );

-- -----------------------------------------------------------------------------
-- The feed
--
-- One query per scale, so the selector can show what is actually there rather
-- than five identical tabs. Counts only what the caller can reach.
-- -----------------------------------------------------------------------------

create or replace function scope_counts()
returns table (scope group_scope, place text, open_count integer, total_count integer)
language sql stable security definer set search_path = public as $$
  select p.scope,
         p.place,
         count(*) filter (
           where p.status in ('in_review', 'in_deliberation', 'voting')
         )::int,
         count(*)::int
    from proposals p
   where p.group_id is null
     and in_scope(auth.uid(), p.scope, p.place)
   group by p.scope, p.place
   order by p.scope;
$$;

grant execute on function scope_counts() to authenticated;

-- -----------------------------------------------------------------------------
-- The contribution record follows the person, not the group.
-- -----------------------------------------------------------------------------

comment on table scope_rules is
  'The decision rule at each scale for proposals addressed to a place. Editable only in SQL, readable by everyone.';
comment on column proposals.place is
  'The place this proposal is addressed to, at its scope. Null for a group proposal and for a global one.';
comment on column proposals.closes_at is
  'When deliberation ends for a place proposal. Nobody may close it sooner.';
