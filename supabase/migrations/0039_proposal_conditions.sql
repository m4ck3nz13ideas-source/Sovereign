-- 0039 — Every proposal is decided by its own conditions (rule 13, revised).
--
-- Mackenzie's direction: no preset rules per scale. A proposal to repaint a
-- bench and a proposal to change how a city spends its budget do not need the
-- same number of people or the same time to be considered, and they carry
-- different conditions. So the AI reads each proposal and sets its TERMS:
--
--   * how many people must respond for the decision to count (min_voices)
--   * how long it stays open before it can be decided (window_hours)
--   * what must be answered on the record before it can pass (requirements):
--     the specific things this proposal has to settle — who pays, who
--     maintains it, whether the people most affected have been asked.
--
-- What stays fixed, deliberately, because it is the constitution rather than
-- a setting: the Universal Law audit, the alignment threshold, the AI review
-- before anybody responds, and proof of personhood where the scale needs it.
--
-- The guard rails on terms themselves:
--   * They are set once, before anybody responds, and never change. Nobody
--     can lower the bar on a proposal that is losing.
--   * They are public to everybody the proposal reaches, with the AI's
--     reasons, so a soft set of terms is visible to the people it affects.
--   * Floors the AI cannot go under: at least two voices (a proposal never
--     passes on its author alone) and at least a day open.
--   * Once a proposal has terms, nobody closes it before its window ends —
--     not the author, not a steward.
--
-- Proposals submitted before 0039 have no terms and keep the old per-scale
-- and per-group rules until they close.

create table if not exists proposal_conditions (
  proposal_id    uuid primary key references proposals(id) on delete cascade,
  min_voices     int  not null check (min_voices between 2 and 1000000),
  window_hours   int  not null check (window_hours between 24 and 2160),
  requirements   jsonb not null check (jsonb_typeof(requirements) = 'array'
                                       and jsonb_array_length(requirements) <= 8),
  rationale      text not null check (length(btrim(rationale)) between 10 and 2000),
  prompt_id      text not null,
  prompt_version text not null,
  model          text not null,
  created_at     timestamptz not null default now(),
  closes_at      timestamptz not null
);

alter table proposal_conditions enable row level security;
drop policy if exists proposal_conditions_read on proposal_conditions;
create policy proposal_conditions_read on proposal_conditions
  for select using (can_reach_proposal(proposal_id));

create table if not exists proposal_requirement_answers (
  proposal_id uuid not null references proposals(id) on delete cascade,
  idx         int  not null check (idx >= 1),
  answer      text not null check (length(btrim(answer)) between 20 and 2000),
  answered_by uuid not null references profiles(id),
  answered_at timestamptz not null default now(),
  primary key (proposal_id, idx)
);

alter table proposal_requirement_answers enable row level security;
drop policy if exists proposal_requirement_answers_read on proposal_requirement_answers;
create policy proposal_requirement_answers_read on proposal_requirement_answers
  for select using (can_reach_proposal(proposal_id));

-- Written by the server action that ran the terms prompt, once, before
-- anybody has responded.
create or replace function record_proposal_conditions(
  p_proposal_id uuid, p_min_voices int, p_window_hours int,
  p_requirements jsonb, p_rationale text,
  p_prompt_id text, p_prompt_version text, p_model text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_p proposals;
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
  if exists (select 1 from jsonb_array_elements(p_requirements) r
              where jsonb_typeof(r) <> 'string' or length(btrim(r #>> '{}')) < 5) then
    raise exception 'each requirement is a sentence';
  end if;

  insert into proposal_conditions (proposal_id, min_voices, window_hours, requirements, rationale,
                              prompt_id, prompt_version, model, closes_at)
  values (p_proposal_id, greatest(p_min_voices, 2), greatest(p_window_hours, 24), p_requirements,
          btrim(p_rationale), p_prompt_id, p_prompt_version, p_model,
          now() + make_interval(hours => greatest(p_window_hours, 24)));
end;
$$;

-- Anybody the proposal reaches can answer a requirement, on the record, once.
create or replace function answer_requirement(p_proposal_id uuid, p_idx int, p_answer text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare t proposal_conditions; v_status proposal_status;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not can_reach_proposal(p_proposal_id) then raise exception 'proposal not found'; end if;
  select status into v_status from proposals where id = p_proposal_id;
  if v_status not in ('in_review', 'in_deliberation', 'voting') then
    raise exception 'this proposal has been decided';
  end if;
  select * into t from proposal_conditions where proposal_id = p_proposal_id;
  if not found or p_idx < 1 or p_idx > jsonb_array_length(t.requirements) then
    raise exception 'no such requirement';
  end if;
  insert into proposal_requirement_answers (proposal_id, idx, answer, answered_by)
  values (p_proposal_id, p_idx, btrim(p_answer), auth.uid());
exception when unique_violation then
  raise exception 'that requirement has already been answered';
end;
$$;

grant execute on function record_proposal_conditions(uuid, int, int, jsonb, text, text, text, text),
  answer_requirement(uuid, int, text) to authenticated;

-- Closing reads the terms. Same function as before with three changes: a
-- proposal with terms cannot be closed before its window ends; it fails while
-- any requirement is unanswered or below its own number of voices; and the
-- old participation and per-scale voice counts apply only to proposals from
-- before 0039.
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
  if found and now() < v_cond.closes_at then
    raise exception 'this proposal is open until %', to_char(v_cond.closes_at, 'DD Mon YYYY HH24:MI');
  end if;
  if v_cond.proposal_id is not null then
    select count(*)::int into v_open_reqs
      from jsonb_array_elements(v_cond.requirements) with ordinality r(item, idx)
     where not exists (select 1 from proposal_requirement_answers a
                        where a.proposal_id = p_proposal_id and a.idx = r.idx::int);
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
  elsif v_cond.proposal_id is not null and v_open_reqs > 0 then
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
                       'open_requirements', v_open_reqs));

  return v_outcome;
end;
$function$

;
