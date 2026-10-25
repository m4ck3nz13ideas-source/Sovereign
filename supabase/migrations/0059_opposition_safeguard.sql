-- =============================================================================
-- 0059 — The safeguard: a proposal most people are strongly against fails
-- =============================================================================
--
-- Mackenzie, 25 October 2026. Since 0056 a proposal with its own conditions
-- passes once they are met, and no average of the responses decides it. That
-- left a hole: a proposal could meet every condition while the people it
-- reached told it, in secret, that they were against it — and pass anyway.
--
-- The safeguard is one rule, on the golden ratio's other side:
--
--   a proposal with conditions FAILS, whatever else is met, if more than half
--   of the people who responded gave it an alignment below 0.382 (1 − 0.618).
--
-- It is not a bar to clear. Lukewarm support passes; a split passes and is
-- reported as a split (rule 14). What fails is a majority that was strongly
-- against. It is read at close, the only moment the numbers may be read
-- (rule 3), and `decisions.opposed` records how many were, so the outcome can
-- say why without saying who.
--
-- A proposal that fails this way failed on its merits: `dormant_proposals()`
-- never offers it back (rule 12), because it had the people.
-- =============================================================================

create or replace function opposition_threshold()
returns numeric language sql immutable set search_path = public, extensions as $$
  select 0.382::numeric
$$;

alter table decisions add column if not exists opposed integer;

create or replace function close_proposal(p_proposal_id uuid)
returns decision_outcome language plpgsql security definer set search_path = public, extensions as $$
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
  v_law_align    numeric;
  v_opposed      integer := 0;
begin
  -- The proposal row is the closing lock, and `cast_resonance()` takes the
  -- same one (rule 34).
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
    -- are met — and not before.
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
  v_law_align := law_alignment(p_proposal_id);

  select count(*)::int into v_voters from resonance_votes where proposal_id = p_proposal_id;
  select round(avg(alignment),3), round(avg(confidence),3), round(avg(urgency),3)
    into v_alignment, v_confidence, v_urgency
    from resonance_votes where proposal_id = p_proposal_id;

  -- 0059: how many responded strongly against it. Read here, at close, the
  -- one moment the numbers may be read at all (rule 3).
  select count(*)::int into v_opposed
    from resonance_votes where proposal_id = p_proposal_id and alignment < opposition_threshold();

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
  elsif v_cond.proposal_id is not null and v_voters > 0 and v_opposed * 2 > v_voters then
    -- 0059: the safeguard. Its requirements were met, but more than half of
    -- the people who responded were strongly against it. Meeting the
    -- conditions shows people took part; it cannot turn their objection
    -- into consent.
    v_outcome := 'failed';
  elsif v_cond.proposal_id is not null then
    -- 0056: its own requirements are met, and that is what passes it. No
    -- average of the responses stands in front of it.
    v_outcome := 'passed';
  -- Before 0039: the rule it was put to people under.
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
                         participation, voter_count, member_count, values_invoked, decided_by,
                         dispersion, polarized, open_questions, open_concerns, law_alignment, opposed)
  values (p_proposal_id, v_outcome, v_alignment, v_confidence, v_urgency,
          v_participation, v_voters, coalesce(v_members, 0), coalesce(v_values, '{}'), auth.uid(),
          v_shape.dispersion, coalesce(v_shape.polarized, false),
          coalesce(v_debate.open_questions, 0), coalesce(v_debate.open_concerns, 0), v_law_align, v_opposed)
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
                       'law_alignment', v_law_align,
                       'opposed', v_opposed,
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
$$;

revoke all on function opposition_threshold() from public, anon;
grant execute on function opposition_threshold() to authenticated;

notify pgrst, 'reload schema';
