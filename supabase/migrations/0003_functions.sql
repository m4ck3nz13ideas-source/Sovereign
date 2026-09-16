-- =============================================================================
-- Sovereign — server-side operations
--
-- Anything that must be true regardless of what the client believes lives here:
-- status transitions, the decision rule, the understanding gate, the reflection
-- gate, the hash chain, and invite redemption.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- The ledger. Append-only and hash-chained: each event commits to the one
-- before it, so a removed or altered row is detectable by replay.
-- A chain adapter would call this AND a contract; nothing else changes.
-- -----------------------------------------------------------------------------

create or replace function record_ledger_event(
  p_group_id     uuid,
  p_kind         text,
  p_subject_type text,
  p_subject_id   uuid,
  p_payload      jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_prev  text;
  v_hash  text;
  v_id    uuid := gen_random_uuid();
  v_now   timestamptz := now();
begin
  if p_group_id is not null and not is_group_member(p_group_id) then
    raise exception 'not a member of this group';
  end if;

  select hash into v_prev
  from ledger_events
  where group_id is not distinct from p_group_id
  order by seq desc
  limit 1;

  v_hash := encode(
    digest(
      coalesce(v_prev, 'genesis') || '|' ||
      coalesce(p_group_id::text, '-') || '|' ||
      coalesce(auth.uid()::text, '-') || '|' ||
      p_kind || '|' || p_subject_type || '|' ||
      coalesce(p_subject_id::text, '-') || '|' ||
      p_payload::text || '|' || v_now::text,
      'sha256'
    ),
    'hex'
  );

  insert into ledger_events (id, group_id, actor_id, kind, subject_type, subject_id,
                             payload, prev_hash, hash, created_at)
  values (v_id, p_group_id, auth.uid(), p_kind, p_subject_type, p_subject_id,
          p_payload, v_prev, v_hash, v_now);

  return v_id;
end;
$$;

-- Replay the chain and report the first point at which it breaks.
create or replace function verify_ledger(p_group_id uuid)
returns table (ok boolean, checked integer, broken_at bigint)
language plpgsql security definer set search_path = public as $$
declare
  r      record;
  v_prev text := null;
  v_calc text;
  v_n    integer := 0;
begin
  if not is_group_member(p_group_id) then
    raise exception 'not a member of this group';
  end if;

  for r in
    select * from ledger_events where group_id = p_group_id order by seq asc
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
-- Groups and invites
-- -----------------------------------------------------------------------------

create or replace function create_group(p_name text, p_purpose text, p_scope group_scope default 'local')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id   uuid;
  v_slug text;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  v_slug := regexp_replace(lower(btrim(p_name)), '[^a-z0-9]+', '-', 'g');
  v_slug := btrim(v_slug, '-');
  if v_slug = '' then v_slug := 'group'; end if;
  if exists (select 1 from groups where slug = v_slug) then
    v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 6);
  end if;

  insert into groups (name, slug, purpose, scope, created_by)
  values (btrim(p_name), v_slug, p_purpose, p_scope, auth.uid())
  returning id into v_id;

  insert into group_members (group_id, profile_id, role)
  values (v_id, auth.uid(), 'owner');

  perform record_ledger_event(v_id, 'group.created', 'group', v_id,
                              jsonb_build_object('name', p_name, 'scope', p_scope));
  return v_id;
end;
$$;

create or replace function create_invite(p_group_id uuid, p_max_uses integer default 1, p_days integer default 14)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if not is_group_steward(p_group_id) then
    raise exception 'only a steward can invite';
  end if;

  v_code := lower(
    substr(encode(gen_random_bytes(9), 'base64'), 1, 12)
  );
  v_code := regexp_replace(v_code, '[^a-z0-9]', '', 'g');
  if length(v_code) < 8 then
    v_code := v_code || substr(md5(gen_random_uuid()::text), 1, 8 - length(v_code));
  end if;

  insert into group_invites (group_id, code, created_by, max_uses, expires_at)
  values (p_group_id, v_code, auth.uid(), greatest(p_max_uses, 1), now() + (p_days || ' days')::interval);

  return v_code;
end;
$$;

create or replace function redeem_invite(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_invite group_invites;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  select * into v_invite from group_invites where code = lower(btrim(p_code));
  if v_invite.id is null then
    raise exception 'that invite code is not recognised';
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'that invite has expired';
  end if;
  if v_invite.uses >= v_invite.max_uses then
    raise exception 'that invite has already been used';
  end if;

  if exists (select 1 from group_members
             where group_id = v_invite.group_id and profile_id = auth.uid()) then
    return v_invite.group_id;
  end if;

  insert into group_members (group_id, profile_id, role)
  values (v_invite.group_id, auth.uid(), 'member');

  update group_invites set uses = uses + 1 where id = v_invite.id;

  perform record_ledger_event(v_invite.group_id, 'member.joined', 'profile', auth.uid(), '{}'::jsonb);
  return v_invite.group_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Resonance aggregates
--
-- voter_count and member_count are always visible: a member should be able to
-- see that the group has responded. The averages are withheld until the
-- proposal closes, because a live average recreates the bandwagon dynamic
-- resonance exists to remove.
-- -----------------------------------------------------------------------------

create or replace function resonance_summary(p_proposal_id uuid)
returns table (
  voter_count    integer,
  member_count   integer,
  avg_alignment  numeric,
  avg_confidence numeric,
  avg_urgency    numeric,
  revealed       boolean
)
language plpgsql security definer stable set search_path = public as $$
declare
  v_group uuid;
  v_status proposal_status;
  v_revealed boolean;
begin
  select group_id, status into v_group, v_status from proposals where id = p_proposal_id;
  if v_group is null then raise exception 'no such proposal'; end if;
  if not is_group_member(v_group) then raise exception 'not a member of this group'; end if;

  v_revealed := v_status in ('passed', 'failed', 'executing', 'completed');

  return query
  select
    (select count(*)::int from resonance_votes where proposal_id = p_proposal_id),
    (select count(*)::int from group_members where group_id = v_group),
    case when v_revealed then (select round(avg(alignment), 3) from resonance_votes where proposal_id = p_proposal_id) end,
    case when v_revealed then (select round(avg(confidence), 3) from resonance_votes where proposal_id = p_proposal_id) end,
    case when v_revealed then (select round(avg(urgency), 3) from resonance_votes where proposal_id = p_proposal_id) end,
    v_revealed;
end;
$$;

-- -----------------------------------------------------------------------------
-- Casting resonance
--
-- Two gates, enforced here rather than in the UI:
--   1. A review must exist. You cannot resonate with something unexamined.
--   2. The member must have marked the review read. Understanding before action.
-- -----------------------------------------------------------------------------

create or replace function cast_resonance(
  p_proposal_id uuid,
  p_alignment   numeric,
  p_confidence  numeric,
  p_urgency     numeric,
  p_note        text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_group  uuid;
  v_status proposal_status;
begin
  select group_id, status into v_group, v_status from proposals where id = p_proposal_id;
  if v_group is null then raise exception 'no such proposal'; end if;
  if not is_group_member(v_group) then raise exception 'not a member of this group'; end if;

  -- Order matters: say the most useful true thing. A proposal still in review
  -- is not "closed", and telling a member it is would be misleading.
  if v_status = 'in_review'
     or not exists (select 1 from proposal_reviews where proposal_id = p_proposal_id) then
    raise exception 'the review has not landed yet';
  end if;

  if v_status not in ('in_deliberation', 'voting') then
    raise exception 'this proposal is closed';
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

  -- First resonance moves the proposal into voting. No separate admin step:
  -- the sliders unlock on understanding, not on someone opening a poll.
  if v_status = 'in_deliberation' then
    update proposals set status = 'voting' where id = p_proposal_id;
  end if;

  perform record_ledger_event(v_group, 'resonance.recorded', 'proposal', p_proposal_id, '{}'::jsonb);
end;
$$;

-- -----------------------------------------------------------------------------
-- Answering a critical flag
--
-- A flag is never dismissed. It is answered, in writing, attributed and
-- timestamped — naming what changed, or why the risk is acceptable.
-- -----------------------------------------------------------------------------

create or replace function resolve_flag(p_flag_id uuid, p_resolution text)
returns void language plpgsql security definer set search_path = public as $$
declare v_proposal uuid; v_group uuid;
begin
  select proposal_id into v_proposal from proposal_flags where id = p_flag_id;
  if v_proposal is null then raise exception 'no such flag'; end if;
  v_group := proposal_group(v_proposal);
  if not is_group_member(v_group) then raise exception 'not a member of this group'; end if;
  if length(btrim(coalesce(p_resolution, ''))) < 20 then
    raise exception 'an answer needs to say what changed, or why the risk is acceptable';
  end if;

  update proposal_flags
     set resolution = btrim(p_resolution),
         resolved_at = now(),
         resolved_by = auth.uid()
   where id = p_flag_id;

  perform record_ledger_event(v_group, 'flag.answered', 'proposal', v_proposal,
                              jsonb_build_object('flag_id', p_flag_id));
end;
$$;

-- -----------------------------------------------------------------------------
-- Closing a proposal — the decision rule
--
-- Passes only if all three hold:
--   participation >= threshold_participation
--   mean alignment >= threshold_alignment
--   no unresolved critical flag
--
-- The thresholds are the group's, editable in Settings. They are the numbers
-- V1 exists to tune against real decisions.
-- -----------------------------------------------------------------------------

create or replace function close_proposal(p_proposal_id uuid)
returns decision_outcome language plpgsql security definer set search_path = public as $$
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
begin
  select group_id, status into v_group, v_status from proposals where id = p_proposal_id;
  if v_group is null then raise exception 'no such proposal'; end if;
  if not is_group_steward(v_group) then raise exception 'only a steward can close a proposal'; end if;
  if v_status not in ('in_deliberation', 'voting') then
    raise exception 'this proposal is not open';
  end if;

  select * into v_g from groups where id = v_group;

  select count(*)::int into v_voters from resonance_votes where proposal_id = p_proposal_id;
  select count(*)::int into v_members from group_members where group_id = v_group;
  select round(avg(alignment),3), round(avg(confidence),3), round(avg(urgency),3)
    into v_alignment, v_confidence, v_urgency
    from resonance_votes where proposal_id = p_proposal_id;

  select count(*)::int into v_open_flags
    from proposal_flags where proposal_id = p_proposal_id and resolved_at is null;

  v_participation := case when v_members > 0 then round(v_voters::numeric / v_members, 3) else 0 end;

  if v_open_flags > 0 then
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
    jsonb_build_object('outcome', v_outcome, 'alignment', v_alignment,
                       'participation', v_participation, 'open_flags', v_open_flags));

  return v_outcome;
end;
$$;

-- -----------------------------------------------------------------------------
-- Completing a project
--
-- Gated on a real reflection. A project cannot be marked completed without an
-- actual-outcome write of substance — the loop closes here or not at all.
-- -----------------------------------------------------------------------------

create or replace function complete_project(p_project_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_group uuid;
begin
  v_group := project_group(p_project_id);
  if v_group is null then raise exception 'no such project'; end if;
  if not is_group_member(v_group) then raise exception 'not a member of this group'; end if;

  if not exists (select 1 from reflections where project_id = p_project_id) then
    raise exception 'write the reflection first — what actually happened?';
  end if;

  update projects
     set status = 'completed', completed_at = now()
   where id = p_project_id;

  update proposals set status = 'completed'
   where id = (select proposal_id from projects where id = p_project_id);

  perform record_ledger_event(v_group, 'project.completed', 'project', p_project_id, '{}'::jsonb);
end;
$$;

-- -----------------------------------------------------------------------------
-- Retrieval: past decisions most likely to bear on a new proposal.
--
-- Ranked by overlap of the values they invoked. The review prompt is given
-- these, and records which ones it read in memory_used.
-- -----------------------------------------------------------------------------

create or replace function related_decisions(p_group_id uuid, p_values text[], p_limit integer default 6)
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
language sql security definer stable set search_path = public as $$
  select
    d.id, p.id, p.title, d.outcome, d.decided_at, d.values_invoked,
    cardinality(array(select unnest(d.values_invoked) intersect select unnest(p_values))) as overlap,
    pr.expected_outcome,
    rf.actual_outcome,
    rf.lesson
  from decisions d
  join proposals p on p.id = d.proposal_id
  left join projects pr on pr.proposal_id = p.id
  left join reflections rf on rf.project_id = pr.id
  where p.group_id = p_group_id
    and is_group_member(p_group_id)
  order by overlap desc, d.decided_at desc
  limit greatest(p_limit, 1);
$$;

-- -----------------------------------------------------------------------------
-- The contribution record (§8: a plain ledger, no token, no score).
-- Derived and read-only: what a person committed to and delivered.
-- -----------------------------------------------------------------------------

create or replace function contribution_record(p_profile_id uuid, p_group_id uuid)
returns table (
  proposals_authored integer,
  proposals_passed   integer,
  resonance_recorded integer,
  comments_written   integer,
  tasks_completed    integer,
  budget_committed   numeric,
  budget_spent       numeric,
  reflections_written integer
)
language sql security definer stable set search_path = public as $$
  select
    (select count(*)::int from proposals where author_id = p_profile_id and group_id = p_group_id),
    (select count(*)::int from proposals p join decisions d on d.proposal_id = p.id
      where p.author_id = p_profile_id and p.group_id = p_group_id and d.outcome = 'passed'),
    (select count(*)::int from resonance_votes v join proposals p on p.id = v.proposal_id
      where v.profile_id = p_profile_id and p.group_id = p_group_id),
    (select count(*)::int from deliberation_comments c join proposals p on p.id = c.proposal_id
      where c.author_id = p_profile_id and p.group_id = p_group_id),
    (select count(*)::int from project_tasks t join projects pr on pr.id = t.project_id
      where t.assignee_id = p_profile_id and pr.group_id = p_group_id and t.status = 'done'),
    (select coalesce(sum(pr.budget_committed), 0) from projects pr
      join proposals p on p.id = pr.proposal_id
      where pr.group_id = p_group_id and p.author_id = p_profile_id),
    (select coalesce(sum(u.spend_delta), 0) from project_updates u
      join projects pr on pr.id = u.project_id
      where pr.group_id = p_group_id and u.author_id = p_profile_id),
    (select count(*)::int from reflections rf join projects pr on pr.id = rf.project_id
      where rf.created_by = p_profile_id and pr.group_id = p_group_id)
  where is_group_member(p_group_id);
$$;

-- -----------------------------------------------------------------------------
-- Grants. RLS still applies to every table; these functions check membership
-- themselves where they bypass it.
-- -----------------------------------------------------------------------------

grant execute on function
  record_ledger_event(uuid, text, text, uuid, jsonb),
  verify_ledger(uuid),
  create_group(text, text, group_scope),
  create_invite(uuid, integer, integer),
  redeem_invite(text),
  resonance_summary(uuid),
  cast_resonance(uuid, numeric, numeric, numeric, text),
  resolve_flag(uuid, text),
  close_proposal(uuid),
  complete_project(uuid),
  related_decisions(uuid, text[], integer),
  contribution_record(uuid, uuid)
to authenticated;
