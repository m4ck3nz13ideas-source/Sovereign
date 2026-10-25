-- =============================================================================
-- 0056 — Released by the laws, passed by its own requirements
-- =============================================================================
--
-- Mackenzie, 25 October 2026:
--
--   "The proposals are approved to the public by meeting the 0.618 alignment
--    with the universal laws, and then it gets passed by others into a project
--    once its own requirements are met."
--
-- So 0.618 moves. It used to be the bar the AVERAGE OF PEOPLE'S RESPONSES had
-- to clear at close. It is now the bar the Universal Law audit has to clear
-- before a proposal is RELEASED to the people it is addressed to:
--
--   in_review ──(audit complete, no violation, law alignment ≥ 0.618,
--                a review on file)──▶ in_deliberation
--
-- and a proposal with its own conditions (0039/0042) passes once those
-- conditions are met — its voices, its requirements answered, its affected
-- groups reached — with no unanswered law tension and no open review flag.
-- The responses are still secret ballots, still recorded, and still published
-- after close with their spread and split (rules 3, 14). They no longer
-- decide by an average: what decides is whether the proposal did what its own
-- conditions asked of it, which the AI set for that proposal alone and which
-- a challenge can strengthen.
--
-- WHAT "LAW ALIGNMENT" IS
--
-- Each of the ten readings may now carry `alignment`, 0 to 1, from the model
-- (prompt law.audit 1.1.0). It must agree with its verdict: aligned 0.70–1,
-- tension 0.30–0.70, violation below 0.30 — so a number cannot quietly say
-- something the verdict does not. Readings without one (every reading before
-- this migration, and the offline stand-in) count by their verdict: aligned
-- 1, tension 0.5, violation 0. `law_alignment()` is the mean over the ten
-- readings in force, and null unless the audit is complete for the current
-- text. A violation still ends a proposal whatever the score (rule 8).
--
-- Proposals from before 0039, with no conditions, keep the old rule exactly:
-- they were put to people on those terms.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- The number
-- -----------------------------------------------------------------------------

alter table law_assessments
  add column if not exists alignment numeric(4,3)
    check (alignment is null or (alignment >= 0 and alignment <= 1));

-- The bar for release. One place, like amendment_threshold().
create or replace function release_threshold()
returns numeric language sql immutable set search_path = public, extensions as $$
  select 0.618::numeric
$$;

-- What a reading counts for. Its own number if it has one, else its verdict.
create or replace function law_reading_value(p_alignment numeric, p_verdict law_verdict)
returns numeric language sql immutable set search_path = public, extensions as $$
  select coalesce(p_alignment,
                  case p_verdict when 'aligned' then 1.0 when 'tension' then 0.5 else 0.0 end)
$$;

-- The mean over a complete, current audit; null otherwise.
create or replace function law_alignment(p_proposal_id uuid)
returns numeric language sql stable security definer set search_path = public, extensions as $$
  select case when s.audited
              then (select round(avg(law_reading_value(a.alignment, a.verdict)), 3)
                      from law_assessments a
                     where a.proposal_id = p_proposal_id and a.superseded_at is null)
         end
    from law_standing(p_proposal_id) s
$$;

-- -----------------------------------------------------------------------------
-- The payload says the number, and the number agrees with the verdict
-- -----------------------------------------------------------------------------

create or replace function law_audit_payload(p_kind text, p_payload text, p_sig text)
returns jsonb language plpgsql stable security definer set search_path = public, private, extensions as $$
declare d jsonb; r jsonb; n int; v numeric;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  if not signing_required() then
    raise exception 'law audits are written only by the server''s AI layer, and its signing key is not set: no audit can be recorded until it is';
  end if;
  if not ai_signature_valid(p_kind, p_payload, p_sig) then
    raise exception 'this did not come from the AI layer, or it is too old: refused';
  end if;

  d := p_payload::jsonb;

  if d->>'prompt_id' is distinct from 'law.audit' then
    raise exception 'a law audit is made with the law.audit prompt';
  end if;
  if length(btrim(coalesce(d->>'prompt_version', ''))) = 0
     or length(btrim(coalesce(d->>'model', ''))) = 0 then
    raise exception 'a law audit says which prompt version and model produced it';
  end if;
  if length(coalesce(d->>'audit_hash', '')) <> 64 then
    raise exception 'a law audit names the text it read';
  end if;

  if jsonb_typeof(d->'readings') is distinct from 'array' or jsonb_array_length(d->'readings') <> 10 then
    raise exception 'an audit reads all ten laws, once each';
  end if;

  for r in select * from jsonb_array_elements(d->'readings') loop
    if jsonb_typeof(r) <> 'object'
       or jsonb_typeof(r->'law_id') is distinct from 'string'
       or not (r->>'law_id' = any (universal_law_ids())) then
      raise exception 'not one of the ten Universal Laws: %', coalesce(r->>'law_id', 'nothing');
    end if;
    if r->>'verdict' is null or not (r->>'verdict' in ('aligned', 'tension', 'violation')) then
      raise exception 'a reading is aligned, tension or violation, not %', coalesce(r->>'verdict', 'nothing');
    end if;
    if length(btrim(coalesce(r->>'reasoning', ''))) = 0 then
      raise exception 'every reading gives its reasoning';
    end if;

    -- 0056: an alignment, where given, is a number from 0 to 1 that agrees
    -- with the verdict beside it.
    if r ? 'alignment' and jsonb_typeof(r->'alignment') <> 'null' then
      if jsonb_typeof(r->'alignment') <> 'number' then
        raise exception 'a reading''s alignment is a number from 0 to 1';
      end if;
      v := (r->>'alignment')::numeric;
      if v < 0 or v > 1 then
        raise exception 'a reading''s alignment is a number from 0 to 1, not %', v;
      end if;
      if (r->>'verdict' = 'aligned'   and v < 0.70)
         or (r->>'verdict' = 'tension'   and (v < 0.30 or v > 0.70))
         or (r->>'verdict' = 'violation' and v >= 0.30) then
        raise exception 'an alignment of % does not match a verdict of %', v, r->>'verdict';
      end if;
    end if;
  end loop;

  select count(distinct x->>'law_id') into n from jsonb_array_elements(d->'readings') x;
  if n <> 10 then
    raise exception 'an audit reads all ten laws, once each';
  end if;

  return d;
end;
$$;

create or replace function law_insert_readings(
  p_proposal_id uuid, d jsonb, p_challenge_id uuid
) returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_audit uuid := gen_random_uuid(); r jsonb; v_rev int;
          v_was text := coalesce(current_setting('sovereign.ai_signed', true), '');
begin
  -- The signature was checked by law_audit_payload(); tell 0040's trigger so.
  perform set_config('sovereign.ai_signed', 'on', true);
  for r in select * from jsonb_array_elements(d->'readings') loop
    v_rev := law_current_revision(r->>'law_id');
    if r ? 'law_revision' and (r->>'law_revision')::int is distinct from v_rev then
      raise exception 'that law was amended while it was being read: audit it again';
    end if;

    insert into law_assessments (proposal_id, law_id, verdict, reasoning, law_revision,
                                 prompt_id, prompt_version, model, provider, issued_at,
                                 audit_id, challenge_id, alignment)
    values (p_proposal_id, r->>'law_id', (r->>'verdict')::law_verdict, btrim(r->>'reasoning'), v_rev,
            d->>'prompt_id', d->>'prompt_version', d->>'model', nullif(d->>'provider', ''),
            (d->>'issued_at')::timestamptz, v_audit, p_challenge_id,
            case when jsonb_typeof(r->'alignment') = 'number' then (r->>'alignment')::numeric end);
  end loop;
  perform set_config('sovereign.ai_signed', v_was, true);
  return v_audit;
end;
$$;

-- -----------------------------------------------------------------------------
-- Release: the one move into deliberation now has a rule
-- -----------------------------------------------------------------------------

-- When this migration was applied. A proposal submitted before it was put
-- to people on the old terms and is released as it always was; the gate
-- applies from here on. Same pattern, and the same lock-down, as
-- conditions_epoch (0042, 0050).
create table if not exists release_epoch (
  only_row boolean primary key default true check (only_row),
  since    timestamptz not null default now()
);
insert into release_epoch (only_row) values (true) on conflict do nothing;
alter table release_epoch enable row level security;
revoke all on release_epoch from public, anon, authenticated;

-- Why a proposal is still held, or null when it may be released. The app
-- shows this line on a held proposal, so it is written to be read.
create or replace function release_problem(p_proposal_id uuid)
returns text language plpgsql stable security definer set search_path = public, extensions as $$
declare s record; v_align numeric;
begin
  if not can_reach_proposal(p_proposal_id) then return 'not addressed to you'; end if;
  if (select submitted_at from proposals where id = p_proposal_id)
     < (select since from release_epoch) then
    return null;
  end if;
  select * into s from law_standing(p_proposal_id);
  if not coalesce(s.audited, false) then
    return 'it has not yet been read against all ten Universal Laws';
  end if;
  if s.violations > 0 then
    return 'it violates a Universal Law';
  end if;
  v_align := law_alignment(p_proposal_id);
  if coalesce(v_align, 0) < release_threshold() then
    return format('its alignment with the Universal Laws is %s, and %s is needed to release it',
                  to_char(coalesce(v_align, 0), 'FM0.000'), to_char(release_threshold(), 'FM0.000'));
  end if;
  if not exists (select 1 from proposal_reviews where proposal_id = p_proposal_id) then
    return 'it has not been reviewed yet';
  end if;
  return null;
end;
$$;

create or replace function guard_proposal_status()
returns trigger language plpgsql set search_path = public, extensions as $$
declare
  v_owner name;
  v_why   text;
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

  -- 0056: released to the people it is addressed to only once the laws say so.
  if old.status = 'in_review' and new.status = 'in_deliberation' then
    v_why := release_problem(new.id);
    if v_why is not null then
      raise exception 'not released yet: %', v_why;
    end if;
    return new;
  end if;

  if old.status in ('in_review', 'in_deliberation') and new.status = 'withdrawn' then
    return new;
  end if;

  raise exception 'a proposal does not move from % to % by editing it — that happens through the decision rule', old.status, new.status;
end;
$$;

-- -----------------------------------------------------------------------------
-- Passing: its own requirements, not an average
-- -----------------------------------------------------------------------------

alter table decisions add column if not exists law_alignment numeric(4,3);

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
                         dispersion, polarized, open_questions, open_concerns, law_alignment)
  values (p_proposal_id, v_outcome, v_alignment, v_confidence, v_urgency,
          v_participation, v_voters, coalesce(v_members, 0), coalesce(v_values, '{}'), auth.uid(),
          v_shape.dispersion, coalesce(v_shape.polarized, false),
          coalesce(v_debate.open_questions, 0), coalesce(v_debate.open_concerns, 0), v_law_align)
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

-- -----------------------------------------------------------------------------
-- Grants (rule 46: nothing new reaches anon)
-- -----------------------------------------------------------------------------

revoke all on function release_threshold(), law_reading_value(numeric, law_verdict),
  law_alignment(uuid), release_problem(uuid) from public, anon;
grant execute on function release_threshold(), law_alignment(uuid), release_problem(uuid)
  to authenticated;
revoke all on function law_insert_readings(uuid, jsonb, uuid), law_audit_payload(text, text, text)
  from public, anon, authenticated;
