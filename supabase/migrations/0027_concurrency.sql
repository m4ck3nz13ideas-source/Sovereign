-- =============================================================================
-- 0027 — CONCURRENCY: the four places two people at once broke something
--
-- Everything in supabase/tests runs in one session, which cannot overlap
-- anything with anything, so none of this was visible. The suite in
-- supabase/tests/concurrency drives real connections and fails on every run
-- against the code below this line.
--
-- WHAT WAS WRONG
--
--   1. REDEEM_INVITE read `uses`, inserted a membership, then wrote
--      `uses + 1`. Two people taking the last seat both read the same number.
--      Deterministically reproducible, and under eight-way load the invite
--      went to all eight.
--
--   2. RECORD_LEDGER_EVENT read the tip of the chain, hashed it, and appended.
--      Two writers both appended to the same parent and the chain stopped
--      replaying — a tamper-evident record reporting tampering on an
--      untampered database, which is worse than not checking.
--
--   3. CLOSE_PROPOSAL read the proposal, computed an outcome, and wrote the
--      decision, the status and a ledger event. `on conflict do nothing` kept
--      a second decision row out and nothing kept out the second status write
--      or the second ledger event, so one decision could end up with two
--      events and a status that disagreed with it.
--
--   4. CAST_RESONANCE could land a vote between the close reading the votes
--      and the close committing. The decision then recorded a `voter_count`
--      that the rows contradicted.
--
-- WHAT THIS DOES ABOUT IT
--
-- Three row locks and one advisory lock, and no change to what any of these
-- functions decide. Nothing here alters an outcome, a threshold or a policy:
-- every rule the other twenty-one suites assert still holds, and they are the
-- check on that.
--
-- The proposal row is the one lock for both closing and voting, which is what
-- makes the fourth case answerable at all. Rule 34 states the answer: a vote
-- racing a close is refused.
--
-- WHY FUNCTIONS ARE REPEATED HERE IN FULL
--
-- The convention in this schema is that a migration is never edited after it
-- is applied, so a changed function is restated. These four bodies are
-- otherwise character-for-character what 0003, 0009 and 0011 defined — the
-- diff against those files should show locks and comments and nothing else.
-- =============================================================================

create or replace function redeem_invite(p_code text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_invite group_invites;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  -- FOR UPDATE, and this is the whole fix. The read of `uses` and the write of
  -- `uses + 1` are separated by a membership insert, so without the lock two
  -- callers both read the same number and both increment it: the last seat is
  -- taken twice and `uses` ends up above `max_uses`. With it, the second caller
  -- waits here and re-reads a row that already says the seat is gone.
  select * into v_invite from group_invites
   where code = lower(btrim(p_code))
   for update;
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

create or replace function record_ledger_event(
  p_group_id     uuid,
  p_kind         text,
  p_subject_type text,
  p_subject_id   uuid,
  p_payload      jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_prev  text;
  v_hash  text;
  v_id    uuid := gen_random_uuid();
  v_now   timestamptz := now();
begin
  if p_group_id is not null and not is_group_member(p_group_id) then
    raise exception 'not a member of this group';
  end if;

  -- One writer at a time per chain.
  --
  -- The next hash commits to the previous one, so reading the tip and
  -- appending to it has to be atomic with respect to other writers. Two
  -- transactions that both read the same tip both compute a hash from it and
  -- both commit, and the chain they leave behind no longer replays: an
  -- untampered record that verifies as tampered, which is worse than no
  -- verification at all.
  --
  -- An advisory lock rather than a row lock because the thing being protected
  -- is the END of the chain rather than any particular row — there is no row
  -- to lock until after the read. It is transaction-scoped, so it releases on
  -- commit whatever happens, and keyed per chain so two groups never wait on
  -- each other. The public chain (null group) gets its own key.
  perform pg_advisory_xact_lock(
    hashtext('sovereign.ledger'),
    hashtext(coalesce(p_group_id::text, 'public')));

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
  v_scope  group_scope;
  v_needs_person boolean;
begin
  -- The same lock `close_proposal()` takes, and taking it here is what decides
  -- the vote-versus-close question: a vote that arrives while a close is being
  -- calculated waits, then finds the proposal closed and is REFUSED. The
  -- alternative — letting it in — would mean a decision whose `voter_count`
  -- the rows contradict, which is a record that lies about the moment it
  -- describes.
  --
  -- FOR UPDATE rather than FOR SHARE even though votes do not conflict with
  -- each other: the first vote on a proposal moves it from `in_deliberation`
  -- to `voting`, so two first votes holding a share lock would both try to
  -- upgrade and deadlock. Votes on one proposal therefore queue, which at five
  -- to fifty people is a cost nobody will ever perceive.
  select group_id, status, scope into v_group, v_status, v_scope
    from proposals where id = p_proposal_id
     for update;
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

  -- Only a place proposal has a scale that anybody is far apart at. A group
  -- has a register — the membership list — so it already knows how many
  -- people it has, and asking its members to prove they exist to each other
  -- would be theatre.
  if v_group is null then
    select require_personhood into v_needs_person from scope_rules where scope = v_scope;
    if coalesce(v_needs_person, false) and not is_verified_person() then
      raise exception 'resonance at % scale needs proof that you are one person — you can still read, ask and object without it', v_scope;
    end if;
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
  v_shape        record;
  v_debate       record;
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

  if v_p.group_id is not null then
    if not is_group_steward(v_p.group_id) then
      raise exception 'only a steward can close a proposal';
    end if;
    select * into v_g from groups where id = v_p.group_id;
  else
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
                       'law_tensions_open', v_law.unanswered_tensions));

  return v_outcome;
end;
$$;

-- The grants are unchanged — a `create or replace` keeps them — and are
-- restated so that applying this file to a fresh database that has somehow
-- lost them is not a silent half-fix.
grant execute on function redeem_invite(text) to authenticated;
grant execute on function record_ledger_event(uuid, text, text, uuid, jsonb) to authenticated;
grant execute on function cast_resonance(uuid, numeric, numeric, numeric, text) to authenticated;
grant execute on function close_proposal(uuid) to authenticated;
