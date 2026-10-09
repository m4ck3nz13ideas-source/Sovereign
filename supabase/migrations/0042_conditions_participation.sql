-- 0042 — Participation, not the clock (rule 13, revised again).
--
-- 0039 gave every proposal its own conditions but still forced a time window
-- on all of them. A clock can pass while the people a proposal affects have
-- never seen it, so a window is a poor stand-in for the actual principle:
--
--   a proposal must give the people materially affected a sufficient
--   opportunity to take part before it is decided.
--
-- What changes:
--
--   * TIME IS OPTIONAL. The AI decides whether a window is appropriate; when
--     it is, it is still at least 24 hours. When it is not, the proposal is
--     decided when its conditions are met — and close_proposal() REFUSES to
--     close it before then (it stays open) rather than failing it for want of
--     participation it is still waiting for.
--
--   * AFFECTED GROUPS. The AI may name who must have an opportunity to take
--     part ("tenants of Elm Court", "the youth club"). Each must be marked
--     reached on the record — how, and when — before the proposal can pass.
--     Evidence the proposal needs is expressed as a requirement, as before.
--
--   * CHALLENGES ARE FOR DEBATE, NEVER A STALL. Anybody the proposal reaches
--     can challenge its conditions, as many people and as many times as they
--     like, and anybody can reply. A challenge never blocks a decision.
--     Before anybody has responded, the challenger can have the AI re-read
--     the conditions with their argument; it may only ADD (more voices,
--     requirements, affected groups, a longer window), the database enforces
--     that, and the previous conditions are kept as a public revision. Once
--     people have responded the conditions are fixed: a challenge then is an
--     argument on the record, and the way to act on it is an improved
--     proposal that supersedes this one — not a moving target.
--
--   * NO VOTES WITHOUT CONDITIONS. From this migration on, nobody can respond
--     to a proposal until its conditions are recorded. Before, a proposal
--     whose conditions never got set fell back to the old per-scale rules —
--     including local proposals passing on one voice with no window — and an
--     author could arrange that simply by voting before the conditions landed.
--     Proposals already in progress before this migration keep the old rules.

------------------------------------------------------------------- tables

alter table proposal_conditions alter column window_hours drop not null;
alter table proposal_conditions alter column closes_at drop not null;
alter table proposal_conditions drop constraint if exists proposal_conditions_window_hours_check;
alter table proposal_conditions add constraint proposal_conditions_window_hours_check
  check (window_hours is null or window_hours between 24 and 2160);
alter table proposal_conditions drop constraint if exists proposal_conditions_window_consistent;
alter table proposal_conditions add constraint proposal_conditions_window_consistent
  check ((window_hours is null) = (closes_at is null));

alter table proposal_conditions add column if not exists affected jsonb not null default '[]'::jsonb;
alter table proposal_conditions drop constraint if exists proposal_conditions_affected_check;
alter table proposal_conditions add constraint proposal_conditions_affected_check
  check (jsonb_typeof(affected) = 'array' and jsonb_array_length(affected) <= 8);
alter table proposal_conditions drop constraint if exists proposal_conditions_requirements_check;
alter table proposal_conditions add constraint proposal_conditions_requirements_check
  check (jsonb_typeof(requirements) = 'array' and jsonb_array_length(requirements) <= 12);

alter table proposal_requirement_answers add column if not exists kind text not null default 'requirement';
alter table proposal_requirement_answers drop constraint if exists proposal_requirement_answers_kind_check;
alter table proposal_requirement_answers add constraint proposal_requirement_answers_kind_check
  check (kind in ('requirement', 'affected'));
alter table proposal_requirement_answers drop constraint if exists proposal_requirement_answers_pkey;
alter table proposal_requirement_answers add primary key (proposal_id, kind, idx);

create table if not exists condition_challenges (
  id            uuid primary key default gen_random_uuid(),
  proposal_id   uuid not null references proposals(id) on delete cascade,
  challenger_id uuid not null references profiles(id),
  argument      text not null check (length(btrim(argument)) between 20 and 2000),
  created_at    timestamptz not null default now(),
  answered_at   timestamptz
);
create table if not exists condition_challenge_replies (
  id            uuid primary key default gen_random_uuid(),
  challenge_id  uuid not null references condition_challenges(id) on delete cascade,
  author_id     uuid not null references profiles(id),
  body          text not null check (length(btrim(body)) between 2 and 2000),
  created_at    timestamptz not null default now()
);

alter table condition_challenges enable row level security;
drop policy if exists condition_challenges_read on condition_challenges;
create policy condition_challenges_read on condition_challenges
  for select using (can_reach_proposal(proposal_id));

alter table condition_challenge_replies enable row level security;
drop policy if exists condition_challenge_replies_read on condition_challenge_replies;
create policy condition_challenge_replies_read on condition_challenge_replies
  for select using (exists (select 1 from condition_challenges c
                             where c.id = challenge_id and can_reach_proposal(c.proposal_id)));

create table if not exists condition_revisions (
  id           uuid primary key default gen_random_uuid(),
  proposal_id  uuid not null references proposals(id) on delete cascade,
  challenge_id uuid references condition_challenges(id),
  previous     jsonb not null,
  rationale    text not null,
  revised_at   timestamptz not null default now()
);

alter table condition_revisions enable row level security;
drop policy if exists condition_revisions_read on condition_revisions;
create policy condition_revisions_read on condition_revisions
  for select using (can_reach_proposal(proposal_id));

-- When this migration was applied: proposals submitted before it keep the
-- old rules if they never got conditions.
create table if not exists conditions_epoch (
  only_row boolean primary key default true check (only_row),
  since    timestamptz not null default now()
);
insert into conditions_epoch (only_row) values (true) on conflict do nothing;

------------------------------------------------------------------ setting

drop function if exists record_proposal_conditions(uuid, int, int, jsonb, text, text, text, text);

create or replace function record_proposal_conditions(
  p_proposal_id uuid, p_min_voices int, p_window_hours int,
  p_requirements jsonb, p_affected jsonb, p_rationale text,
  p_prompt_id text, p_prompt_version text, p_model text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_p proposals; v_hours int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into v_p from proposals where id = p_proposal_id for update;
  if not found or not can_reach_proposal(p_proposal_id) then raise exception 'proposal not found'; end if;
  if v_p.status not in ('in_review', 'in_deliberation') then
    raise exception 'conditions are set before anybody responds';
  end if;
  if exists (select 1 from resonance_votes where proposal_id = p_proposal_id) then
    raise exception 'conditions are set before anybody responds';
  end if;
  if exists (select 1 from proposal_conditions where proposal_id = p_proposal_id) then
    raise exception 'this proposal already has its conditions';
  end if;
  if exists (select 1 from jsonb_array_elements(p_requirements || coalesce(p_affected, '[]'::jsonb)) r
              where jsonb_typeof(r) <> 'string' or length(btrim(r #>> '{}')) < 3) then
    raise exception 'each requirement and affected group is a short sentence';
  end if;

  v_hours := case when p_window_hours is null then null else greatest(p_window_hours, 24) end;

  insert into proposal_conditions (proposal_id, min_voices, window_hours, requirements, affected, rationale,
                                   prompt_id, prompt_version, model, closes_at)
  values (p_proposal_id, greatest(p_min_voices, 2), v_hours, p_requirements, coalesce(p_affected, '[]'::jsonb),
          btrim(p_rationale), p_prompt_id, p_prompt_version, p_model,
          case when v_hours is null then null else now() + make_interval(hours => v_hours) end);
end;
$$;

-------------------------------------------------------- answering, reaching

create or replace function answer_condition(p_proposal_id uuid, p_kind text, p_idx int, p_text text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare c proposal_conditions; v_status proposal_status; v_len int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not can_reach_proposal(p_proposal_id) then raise exception 'proposal not found'; end if;
  select status into v_status from proposals where id = p_proposal_id;
  if v_status not in ('in_review', 'in_deliberation', 'voting') then
    raise exception 'this proposal has been decided';
  end if;
  select * into c from proposal_conditions where proposal_id = p_proposal_id;
  if not found then raise exception 'no such requirement'; end if;
  v_len := jsonb_array_length(case p_kind when 'requirement' then c.requirements
                                          when 'affected' then c.affected end);
  if v_len is null or p_idx < 1 or p_idx > v_len then raise exception 'no such requirement'; end if;
  insert into proposal_requirement_answers (proposal_id, kind, idx, answer, answered_by)
  values (p_proposal_id, p_kind, p_idx, btrim(p_text), auth.uid());
exception when unique_violation then
  raise exception 'that has already been answered';
end;
$$;

create or replace function answer_requirement(p_proposal_id uuid, p_idx int, p_answer text)
returns void
language sql
as $$ select answer_condition(p_proposal_id, 'requirement', p_idx, p_answer); $$;

------------------------------------------------------------------ challenge

create or replace function raise_condition_challenge(p_proposal_id uuid, p_argument text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_status proposal_status; v_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not can_reach_proposal(p_proposal_id) then raise exception 'proposal not found'; end if;
  select status into v_status from proposals where id = p_proposal_id;
  if v_status not in ('in_review', 'in_deliberation', 'voting') then
    raise exception 'this proposal has been decided';
  end if;
  if not exists (select 1 from proposal_conditions where proposal_id = p_proposal_id) then
    raise exception 'this proposal has no conditions to challenge yet';
  end if;
  insert into condition_challenges (proposal_id, challenger_id, argument)
  values (p_proposal_id, auth.uid(), btrim(p_argument))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function reply_to_condition_challenge(p_challenge_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare c condition_challenges; v_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into c from condition_challenges where id = p_challenge_id;
  if not found or not can_reach_proposal(c.proposal_id) then raise exception 'challenge not found'; end if;
  insert into condition_challenge_replies (challenge_id, author_id, body)
  values (p_challenge_id, auth.uid(), btrim(p_body))
  returning id into v_id;
  return v_id;
end;
$$;

-- The AI's re-reading after a challenge, before anybody has responded.
-- Strengthen-only, enforced here:
-- voices never go down, nothing is removed or reordered (answers keep their
-- numbers), a window can be added or lengthened but never shortened or
-- removed. The previous conditions are kept as a public revision.
create or replace function apply_condition_challenge(
  p_challenge_id uuid, p_min_voices int, p_window_hours int,
  p_requirements jsonb, p_affected jsonb, p_rationale text,
  p_prompt_id text, p_prompt_version text, p_model text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare ch condition_challenges; c proposal_conditions; v_reqs jsonb; v_aff jsonb; v_closes timestamptz; v_hours int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if signing_required() and not ai_write_in_progress() then
    raise exception 'conditions are written by the AI layer, signed by the server — not directly';
  end if;
  select * into ch from condition_challenges where id = p_challenge_id for update;
  if not found then raise exception 'challenge not found'; end if;
  if ch.challenger_id is distinct from auth.uid() then
    raise exception 'only the person who raised a challenge can have it answered';
  end if;
  if ch.answered_at is not null then raise exception 'that challenge has already been answered'; end if;

  select * into c from proposal_conditions where proposal_id = ch.proposal_id for update;

  -- Once anybody has responded the conditions are fixed: a challenge is then
  -- an argument on the record, never a moving target that holds the decision.
  if exists (select 1 from resonance_votes where proposal_id = ch.proposal_id) then
    raise exception 'people have already responded, so the conditions are fixed — make the case for an improved proposal instead';
  end if;

  -- Append only what is new, keeping existing items and their numbers.
  select c.requirements || coalesce(jsonb_agg(r) filter (where not (c.requirements @> jsonb_build_array(r))), '[]'::jsonb)
    into v_reqs from jsonb_array_elements(coalesce(p_requirements, '[]'::jsonb)) r;
  select c.affected || coalesce(jsonb_agg(r) filter (where not (c.affected @> jsonb_build_array(r))), '[]'::jsonb)
    into v_aff from jsonb_array_elements(coalesce(p_affected, '[]'::jsonb)) r;

  v_hours := c.window_hours;
  v_closes := c.closes_at;
  if p_window_hours is not null then
    v_hours := greatest(coalesce(c.window_hours, 0), p_window_hours, 24);
    v_closes := greatest(coalesce(c.closes_at, now()), c.created_at + make_interval(hours => v_hours));
  end if;

  insert into condition_revisions (proposal_id, challenge_id, previous, rationale)
  values (c.proposal_id, ch.id,
          jsonb_build_object('min_voices', c.min_voices, 'window_hours', c.window_hours,
                             'closes_at', c.closes_at, 'requirements', c.requirements,
                             'affected', c.affected, 'rationale', c.rationale),
          left(btrim(coalesce(p_rationale, '')), 2000));

  update proposal_conditions
     set min_voices = greatest(c.min_voices, coalesce(p_min_voices, 0)),
         window_hours = v_hours,
         closes_at = v_closes,
         requirements = v_reqs,
         affected = v_aff,
         rationale = case when length(btrim(coalesce(p_rationale, ''))) >= 10 then btrim(p_rationale) else c.rationale end,
         prompt_id = p_prompt_id, prompt_version = p_prompt_version, model = p_model
   where proposal_id = c.proposal_id;

  update condition_challenges set answered_at = now() where id = ch.id;
end;
$$;

-- And nothing else may change conditions after the fact.
create or replace function guard_condition_update()
returns trigger
language plpgsql
as $$
begin
  if new.proposal_id is distinct from old.proposal_id
     or new.min_voices < old.min_voices
     or (old.window_hours is not null and (new.window_hours is null or new.window_hours < old.window_hours))
     or (old.closes_at is not null and (new.closes_at is null or new.closes_at < old.closes_at))
     or not (new.requirements @> old.requirements)
     or not (new.affected @> old.affected)
     or jsonb_array_length(new.requirements) < jsonb_array_length(old.requirements)
     or jsonb_array_length(new.affected) < jsonb_array_length(old.affected) then
    raise exception 'conditions can only be strengthened, never weakened';
  end if;
  if (select array_agg(x order by i) from jsonb_array_elements(old.requirements) with ordinality t(x, i))
     is distinct from
     (select array_agg(x order by i) from jsonb_array_elements(new.requirements) with ordinality t(x, i)
       where i <= jsonb_array_length(old.requirements)) then
    raise exception 'existing requirements keep their place';
  end if;
  return new;
end;
$$;

drop trigger if exists proposal_conditions_guard on proposal_conditions;
create trigger proposal_conditions_guard before update on proposal_conditions
  for each row execute function guard_condition_update();

-------------------------------------------------- no votes without conditions

create or replace function require_conditions_before_votes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from proposal_conditions where proposal_id = new.proposal_id)
     and (select submitted_at from proposals where id = new.proposal_id)
         >= (select since from conditions_epoch) then
    raise exception 'this proposal''s conditions have not been set yet, so it is not open for responses';
  end if;
  return new;
end;
$$;

drop trigger if exists resonance_requires_conditions on resonance_votes;
create trigger resonance_requires_conditions before insert on resonance_votes
  for each row execute function require_conditions_before_votes();

grant execute on function
  record_proposal_conditions(uuid, int, int, jsonb, jsonb, text, text, text, text),
  answer_condition(uuid, text, int, text), answer_requirement(uuid, int, text),
  raise_condition_challenge(uuid, text), reply_to_condition_challenge(uuid, text),
  apply_condition_challenge(uuid, int, int, jsonb, jsonb, text, text, text, text)
  to authenticated;

-- ai_write learns the affected groups and the challenge re-reading.
CREATE OR REPLACE FUNCTION public.ai_write(p_kind text, p_payload text, p_sig text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
declare
  d jsonb := p_payload::jsonb;
  v_id uuid;
  v_out jsonb := '{}'::jsonb;
  r jsonb;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not ai_signature_valid(p_kind, p_payload, p_sig) then
    raise exception 'this did not come from the AI layer, or it is too old: refused';
  end if;

  perform set_config('sovereign.ai_signed', 'on', true);

  if p_kind = 'proposal.review' then
    insert into proposal_reviews (proposal_id, prompt_id, prompt_version, model, clarity, evidence,
                                  feasibility, reversibility, values_alignment, risks, questions,
                                  memory_used, summary)
    values ((d->>'proposal_id')::uuid, d->>'prompt_id', d->>'prompt_version', d->>'model',
            (d->>'clarity')::numeric, (d->>'evidence')::numeric, (d->>'feasibility')::numeric,
            (d->>'reversibility')::numeric, d->'values_alignment', d->'risks', d->'questions',
            d->'memory_used', d->>'summary')
    returning id into v_id;
    for r in select * from jsonb_array_elements(coalesce(d->'flags', '[]'::jsonb)) loop
      insert into proposal_flags (proposal_id, review_id, kind, label, severity, detail)
      values ((d->>'proposal_id')::uuid, v_id, r->>'kind', r->>'label', r->>'severity', r->>'detail');
    end loop;
    v_out := jsonb_build_object('id', v_id);

  elsif p_kind = 'law.audit' then
    for r in select * from jsonb_array_elements(d->'readings') loop
      insert into law_assessments (proposal_id, law_id, verdict, reasoning, law_revision,
                                   prompt_id, prompt_version, model)
      values ((d->>'proposal_id')::uuid, r->>'law_id', (r->>'verdict')::law_verdict, r->>'reasoning',
              coalesce((r->>'law_revision')::int, 1), d->>'prompt_id', d->>'prompt_version', d->>'model');
    end loop;

  elsif p_kind = 'law.challenge' then
    v_out := jsonb_build_object('violations',
      record_challenge_audit((d->>'challenge_id')::uuid, d->'readings',
                             d->>'prompt_id', d->>'prompt_version', d->>'model'));

  elsif p_kind = 'post.witness' then
    insert into post_witness (author_id, body_sha256, first_hand, verdict, concerns,
                              prompt_id, prompt_version, model)
    values (auth.uid(), d->>'body_sha256', (d->>'first_hand')::numeric, d->>'verdict',
            d->'concerns', d->>'prompt_id', d->>'prompt_version', d->>'model')
    returning id into v_id;
    v_out := jsonb_build_object('id', v_id);

  elsif p_kind = 'proposal.conditions' then
    perform record_proposal_conditions((d->>'proposal_id')::uuid, (d->>'min_voices')::int,
                                       nullif(d->>'window_hours', '')::int, d->'requirements',
                                       coalesce(d->'affected', '[]'::jsonb), d->>'rationale',
                                       d->>'prompt_id', d->>'prompt_version', d->>'model');

  elsif p_kind = 'proposal.conditions.challenge' then
    perform apply_condition_challenge((d->>'challenge_id')::uuid, (d->>'min_voices')::int,
                                      nullif(d->>'window_hours', '')::int, d->'requirements',
                                      coalesce(d->'affected', '[]'::jsonb), d->>'rationale',
                                      d->>'prompt_id', d->>'prompt_version', d->>'model');

  elsif p_kind = 'marketplace.vetting' then
    if (select vendor_content_hash(v) from vendors v where v.id = (d->>'vendor_id')::uuid)
       is distinct from d->>'content_hash' then
      raise exception 'the business has changed since it was read: read it again';
    end if;
    v_id := record_vendor_vetting((d->>'vendor_id')::uuid, d->'readings',
                                  d->>'prompt_id', d->>'prompt_version', d->>'model');
    v_out := jsonb_build_object('id', v_id);

  else
    raise exception 'unknown kind of AI write: %', p_kind;
  end if;

  perform set_config('sovereign.ai_signed', 'off', true);
  return v_out;
end;
$function$

;

-- close_proposal: optional window, affected groups, open challenges.
CREATE OR REPLACE FUNCTION public.close_proposal(p_proposal_id uuid)
 RETURNS decision_outcome
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
  v_shape        record;
  v_debate       record;
  v_cond        proposal_conditions;
  v_open_reqs    integer := 0;
  v_unreached    integer := 0;
  v_votes_now    integer := 0;
begin
  -- The proposal row is the closing lock, and `cast_resonance()` takes the
  -- same one. Two closes: the second waits here, then re-reads a row whose
  -- status is already decided and falls out at the check below — so exactly
  -- one decision, one status and one ledger event, rather than a second caller
  -- computing an outcome from a stale snapshot and writing it over the first.
  --
  -- `on conflict (proposal_id) do nothing` on the insert already kept a second
  -- decision ROW out. What it never stopped was the second caller's
  -- `update proposals set status` and its `record_ledger_event` — leaving a
  -- decision that said one thing and a status that said another.
  select * into v_p from proposals where id = p_proposal_id for update;
  if not found then raise exception 'no such proposal'; end if;

  if v_p.status not in ('in_deliberation', 'voting') then
    raise exception 'this proposal is not open';
  end if;

  -- 0039: a proposal with its own conditions is decided by them. Nobody closes it
  -- before its window ends — not even a steward.
  select * into v_cond from proposal_conditions where proposal_id = p_proposal_id;
  if v_cond.proposal_id is not null and v_cond.closes_at is not null and now() < v_cond.closes_at then
    raise exception 'this proposal is open until %', to_char(v_cond.closes_at, 'DD Mon YYYY HH24:MI');
  end if;
  if v_cond.proposal_id is not null then
    select count(*)::int into v_open_reqs
      from jsonb_array_elements(v_cond.requirements) with ordinality r(item, idx)
     where not exists (select 1 from proposal_requirement_answers a
                        where a.proposal_id = p_proposal_id and a.kind = 'requirement'
                          and a.idx = r.idx::int);
    select count(*)::int into v_unreached
      from jsonb_array_elements(v_cond.affected) with ordinality r(item, idx)
     where not exists (select 1 from proposal_requirement_answers a
                        where a.proposal_id = p_proposal_id and a.kind = 'affected'
                          and a.idx = r.idx::int);
    select count(*)::int into v_votes_now from resonance_votes where proposal_id = p_proposal_id;

    -- 0042: with no time window, the proposal is decided when its conditions
    -- are met — and not before. Closing it early would fail it for want of
    -- the very participation it is still waiting for, so it is refused and
    -- stays open instead.
    if v_cond.closes_at is null
       and (v_votes_now < v_cond.min_voices or v_open_reqs > 0 or v_unreached > 0) then
      raise exception 'not ready to decide: % of % voices, % requirement(s) and % affected group(s) still open',
        v_votes_now, v_cond.min_voices, v_open_reqs, v_unreached;
    end if;
  end if;

  if v_p.group_id is not null then
    if not is_group_steward(v_p.group_id) then
      raise exception 'only a steward can close a proposal';
    end if;
    select * into v_g from groups where id = v_p.group_id;
  else
    if not can_reach_proposal(p_proposal_id) then
      raise exception 'this proposal is not addressed to you';
    end if;
    if v_cond.proposal_id is null and v_p.closes_at is not null and now() < v_p.closes_at then
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

  select * into v_shape  from alignment_shape(p_proposal_id);
  select * into v_debate from debate_standing(p_proposal_id);

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
  elsif v_cond.proposal_id is not null and (v_open_reqs > 0 or v_unreached > 0) then
    v_outcome := 'failed';
  elsif v_cond.proposal_id is not null and v_voters < v_cond.min_voices then
    v_outcome := 'failed';
  elsif v_cond.proposal_id is null and v_p.group_id is not null
        and coalesce(v_participation, 0) < v_g.threshold_participation then
    v_outcome := 'failed';
  elsif v_cond.proposal_id is null and v_p.group_id is null and v_voters < v_rule.min_voices then
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
                         participation, voter_count, member_count, values_invoked, decided_by,
                         dispersion, polarized, open_questions, open_concerns)
  values (p_proposal_id, v_outcome, v_alignment, v_confidence, v_urgency,
          v_participation, v_voters, coalesce(v_members, 0), coalesce(v_values, '{}'), auth.uid(),
          v_shape.dispersion, coalesce(v_shape.polarized, false),
          coalesce(v_debate.open_questions, 0), coalesce(v_debate.open_concerns, 0))
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
                       'dispersion', v_shape.dispersion,
                       'polarized', coalesce(v_shape.polarized, false),
                       'voices', v_voters,
                       'participation', v_participation,
                       'open_flags', v_open_flags,
                       'open_questions', coalesce(v_debate.open_questions, 0),
                       'open_concerns', coalesce(v_debate.open_concerns, 0),
                       'law_violations', v_law.violations,
                       'law_tensions_open', v_law.unanswered_tensions,
                       'open_requirements', v_open_reqs,
                       'unreached_groups', v_unreached));

  return v_outcome;
end;
$function$

;
