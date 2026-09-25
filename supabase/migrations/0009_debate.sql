-- =============================================================================
-- 0009 — DEBATE: deliberation that improves a proposal rather than defends one
--
--   "Unlike social media, debate here focuses on improving proposals. Users
--    can: ask questions, suggest edits, propose alternatives, flag concerns.
--    […] AI periodically summarizes debates to reduce noise."
--   §7.2 Polarization detection.
--
-- Until now deliberation was a flat comment thread, which is the shape that
-- produces argument rather than improvement: everything looks the same, so
-- nothing has to be answered and nothing can be counted.
--
-- Three changes:
--
--   1. A contribution has a KIND. A question, an amendment, an alternative or
--      a concern — the four the paper names — and a reply is a reply.
--   2. Questions and concerns are ANSWERED in writing, attributed, permanent.
--      They do not block. They are shown to every person before they touch a
--      slider, and they are counted into the decision record.
--   3. POLARIZATION, honestly. Live, from the argument: whether it is still
--      addressing itself. At close, from the numbers: whether a mean of 0.5
--      was everyone at 0.5 or half at 0.1 and half at 0.9. Those are not the
--      same group and a system that reports them identically is lying.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- The four kinds, and a reply
-- -----------------------------------------------------------------------------

do $$ begin
  if not exists (select 1 from pg_type where typname = 'comment_kind') then
    create type comment_kind as enum ('question', 'amendment', 'alternative', 'concern', 'reply');
  end if;
end $$;

alter table deliberation_comments
  add column if not exists kind        comment_kind not null default 'reply',
  add column if not exists answer      text,
  add column if not exists answered_by uuid references profiles on delete set null,
  add column if not exists answered_at timestamptz,
  add column if not exists adopted_at  timestamptz;

comment on column deliberation_comments.kind is
  'question, amendment, alternative or concern at the top level; reply underneath.';
comment on column deliberation_comments.answer is
  'The written answer to a question or a concern. Attributed and permanent — there is no policy that lets it be changed or removed.';
comment on column deliberation_comments.adopted_at is
  'Set when the author says they will carry an amendment into a rewrite. It does not change this proposal — the text is fixed.';

-- A top-level contribution says what it is. A reply hangs off something.
alter table deliberation_comments drop constraint if exists comments_kind_shape;
alter table deliberation_comments add constraint comments_kind_shape check (
  (parent_id is null and kind <> 'reply')
  or (parent_id is not null and kind = 'reply')
) not valid;

-- Only questions and concerns are answerable; only amendments are adoptable.
alter table deliberation_comments drop constraint if exists comments_answer_shape;
alter table deliberation_comments add constraint comments_answer_shape check (
  (answer is null or kind in ('question', 'concern'))
  and (adopted_at is null or kind = 'amendment')
);

create index if not exists comments_open_idx
  on deliberation_comments (proposal_id)
  where answered_at is null and kind in ('question', 'concern');

-- -----------------------------------------------------------------------------
-- Answering
--
-- The same standard as a flag: twenty characters, attributed, and no path to
-- un-answer it. The difference is what it does — a flag from the review fails
-- a proposal until it is answered, and a question from a member does not.
--
-- That asymmetry is deliberate. A flag is the rubric finding something below
-- the group's own floor. A concern is a person disagreeing, and a system where
-- any one person can hold a proposal until satisfied has a veto in it, which
-- is the thing resonance exists to avoid. So an unanswered concern is carried
-- in front of everyone before they respond, and into the record afterwards,
-- and then the group decides with it in view.
-- -----------------------------------------------------------------------------

create or replace function answer_contribution(p_comment_id uuid, p_answer text)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare v_c record; v_group uuid;
begin
  select * into v_c from deliberation_comments where id = p_comment_id;
  if not found then raise exception 'no such contribution'; end if;

  if not can_reach_proposal(v_c.proposal_id) then
    raise exception 'this proposal is not addressed to you';
  end if;

  if v_c.kind not in ('question', 'concern') then
    raise exception 'only a question or a concern is answered';
  end if;

  if v_c.answered_at is not null then
    raise exception 'that has been answered already — reply to the answer instead';
  end if;

  if length(btrim(coalesce(p_answer, ''))) < 20 then
    raise exception 'an answer says something — what is the case, or what you will do about it';
  end if;

  update deliberation_comments
     set answer = btrim(p_answer),
         answered_by = auth.uid(),
         answered_at = now()
   where id = p_comment_id;

  select group_id into v_group from proposals where id = v_c.proposal_id;
  perform record_ledger_event(v_group, 'debate.answered', 'proposal', v_c.proposal_id,
    jsonb_build_object('contribution', p_comment_id, 'kind', v_c.kind));
end;
$$;

-- Adopting an amendment changes nothing about this proposal. The text is fixed
-- at submission and stays fixed. What it does is put a marker on the record
-- saying the author will carry this into the rewrite, so the amendment does
-- not have to be argued twice.
create or replace function adopt_amendment(p_comment_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare v_c record; v_group uuid;
begin
  select * into v_c from deliberation_comments where id = p_comment_id;
  if not found then raise exception 'no such contribution'; end if;
  if v_c.kind <> 'amendment' then raise exception 'only an amendment is adopted'; end if;

  if not can_steward_proposal(v_c.proposal_id) then
    raise exception 'only the author, or a steward of the group, can adopt an amendment';
  end if;

  update deliberation_comments set adopted_at = now()
   where id = p_comment_id and adopted_at is null;

  select group_id into v_group from proposals where id = v_c.proposal_id;
  perform record_ledger_event(v_group, 'debate.adopted', 'proposal', v_c.proposal_id,
    jsonb_build_object('amendment', p_comment_id));
end;
$$;

-- Answering is an update, and the policy is written so the only update it
-- permits is one that supplies an answer and signs it.
drop policy if exists comments_answer on deliberation_comments;
create policy comments_answer on deliberation_comments for update
  using (can_reach_proposal(proposal_id))
  with check (
    can_reach_proposal(proposal_id)
    and answer is not null
    and length(btrim(answer)) >= 20
    and answered_by = auth.uid()
  );

grant execute on function
  answer_contribution(uuid, text),
  adopt_amendment(uuid)
to authenticated;

-- -----------------------------------------------------------------------------
-- Where the debate stands
-- -----------------------------------------------------------------------------

create or replace function debate_standing(p_proposal_id uuid)
returns table (
  contributions   integer,
  questions       integer,
  open_questions  integer,
  concerns        integer,
  open_concerns   integer,
  amendments      integer,
  adopted         integer,
  alternatives    integer,
  voices          integer
)
language sql security definer stable set search_path = public, extensions as $$
  select
    count(*)::int,
    count(*) filter (where kind = 'question')::int,
    count(*) filter (where kind = 'question' and answered_at is null)::int,
    count(*) filter (where kind = 'concern')::int,
    count(*) filter (where kind = 'concern' and answered_at is null)::int,
    count(*) filter (where kind = 'amendment')::int,
    count(*) filter (where kind = 'amendment' and adopted_at is not null)::int,
    count(*) filter (where kind = 'alternative')::int,
    count(distinct author_id)::int
  from deliberation_comments
  where proposal_id = p_proposal_id
    and can_reach_proposal(p_proposal_id);
$$;

grant execute on function debate_standing(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- The summary
--
--   "AI periodically summarizes debates to reduce noise."
--
-- Stored with the number of contributions it covered, so a summary written
-- across nine comments and then left while six more arrive is visibly stale
-- rather than quietly wrong. Versioned like every other artefact.
--
-- `polarization` here is a reading of the ARGUMENT, not of the votes — the
-- votes are hidden until close and that rule does not bend for this. It says
-- whether people are still addressing each other or have stopped.
-- -----------------------------------------------------------------------------

create table if not exists debate_summaries (
  id             uuid primary key default gen_random_uuid(),
  proposal_id    uuid not null references proposals on delete cascade,
  covers         integer not null,
  arguments_for  jsonb not null default '[]'::jsonb,
  arguments_against jsonb not null default '[]'::jsonb,
  unresolved     jsonb not null default '[]'::jsonb,
  shifted        text,
  polarization   text not null check (polarization in ('converging', 'mixed', 'splitting')),
  reading        text not null,
  prompt_id      text not null,
  prompt_version text not null,
  model          text not null,
  created_at     timestamptz not null default now(),
  created_by     uuid references profiles on delete set null
);

create index if not exists debate_summaries_idx
  on debate_summaries (proposal_id, created_at desc);

alter table debate_summaries enable row level security;

create policy debate_summary_read on debate_summaries for select
  using (can_reach_proposal(proposal_id));

create policy debate_summary_create on debate_summaries for insert
  with check (can_reach_proposal(proposal_id) and created_by = auth.uid());

-- No update and no delete. A summary that was wrong is superseded by a later
-- one, and both stay — the same rule as a superseded law reading.

grant select, insert on debate_summaries to authenticated;

-- -----------------------------------------------------------------------------
-- Polarization, from the numbers
--
-- A mean says nothing about a split. Everyone at 0.50 and half at 0.10 with
-- half at 0.90 both average 0.50, and they are not the same group: the first
-- is a room that is unsure, the second is a room that disagrees. Reporting
-- them identically is the single easiest way for a governance tool to launder
-- a rift into a consensus.
--
-- So two numbers go onto every decision:
--   dispersion — population standard deviation of alignment
--   polarized  — spread AND both ends occupied, which is what a split is
--
-- The rule: dispersion above 0.25, with at least a fifth of responses in the
-- bottom third and at least a fifth in the top third. Those thresholds are
-- guesses and they are meant to be argued with; what matters is that the
-- shape is reported at all.
--
-- A polarized proposal can still pass. It should — the threshold is the
-- threshold. What changes is that the record says the group was split, and
-- anyone reading it later knows the difference.
-- -----------------------------------------------------------------------------

alter table decisions
  add column if not exists dispersion numeric(4,3),
  add column if not exists polarized  boolean not null default false,
  add column if not exists open_questions integer not null default 0,
  add column if not exists open_concerns  integer not null default 0;

comment on column decisions.dispersion is
  'Population standard deviation of alignment. A mean without this hides whether the group agreed or merely averaged.';
comment on column decisions.polarized is
  'Spread, with both ends occupied. A split, not an uncertainty.';

create or replace function alignment_shape(p_proposal_id uuid)
returns table (dispersion numeric, polarized boolean)
language sql stable security definer set search_path = public, extensions as $$
  with v as (select alignment::numeric a from resonance_votes where proposal_id = p_proposal_id)
  select
    round(coalesce(stddev_pop(a), 0), 3),
    coalesce(stddev_pop(a), 0) > 0.25
      and count(*) filter (where a < 0.3333)::numeric >= 0.2 * count(*)
      and count(*) filter (where a > 0.6667)::numeric >= 0.2 * count(*)
      and count(*) >= 3
  from v;
$$;

grant execute on function alignment_shape(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- The decision rule, unchanged — with the shape of the room recorded alongside
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
  v_shape        record;
  v_debate       record;
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
