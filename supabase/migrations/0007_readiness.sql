-- =============================================================================
-- 0007 — READINESS: a proposal has to be thought through before anyone sees it
--
--   "A proposal is not just 'an idea'. It must include: Intent — what problem
--    are we solving? Scope — who is affected? Values invoked. Constraints —
--    time, budget, risks. Evidence — optional but encouraged.
--    This already filters out 50% of bad ideas."
--
-- Until now the only gate on submission was eighty characters of prose, which
-- is not a gate. A proposal asks people for their attention, their money and
-- their Saturdays; the moment to find the hole in it is before it is put to
-- them, not after.
--
-- Two mechanisms, and they do different work:
--
--   1. STRUCTURE, enforced by check constraints. Six sections, five of them
--      required. This is the part the database can settle on its own, and the
--      whitepaper's claim is that it is most of the filter.
--
--   2. A SHARPENING PASS, run on the draft before it reaches this database at
--      all, whose readiness score has to clear 0.70. What the database enforces
--      is that a submitted proposal carries one, that it was made for this
--      exact text, and that it is recent.
--
-- What that second mechanism is and is not: the reading happens outside
-- Postgres, so this is checkable and permanently attributed, not unforgeable.
-- Someone determined could call the RPC with a fabricated score — and the
-- sharpening they claim is then on the proposal's page for everyone it was
-- addressed to, with their name on it, forever. That is the same standard as a
-- flag resolution, and it is the honest one at this scale. docs/architecture.md
-- says what would close the gap and why it is not worth closing yet.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- The six sections
--
-- `body` stays, and is now derived — the sections concatenated, which is what
-- the sharpening was run against and what the hash is taken over. Existing
-- proposals keep their body and get empty sections; the constraints below are
-- NOT VALID so they bind new rows without rewriting history.
-- -----------------------------------------------------------------------------

alter table proposals
  add column if not exists intent       text not null default '',
  add column if not exists change       text not null default '',
  add column if not exists constraints  text not null default '',
  add column if not exists risks        text not null default '',
  add column if not exists alternatives text not null default '',
  add column if not exists evidence     text,
  add column if not exists readiness    numeric(4,3),
  add column if not exists body_sha256  text;

comment on column proposals.intent is 'The problem, not the solution. What is going wrong now, and for whom.';
comment on column proposals.change is 'What would be different the day after. Concrete enough to picture.';
comment on column proposals.constraints is 'Money, time, people, and anything it depends on that is not in the author''s gift.';
comment on column proposals.risks is 'What could go wrong, and what would count as evidence it is not working.';
comment on column proposals.alternatives is 'What else was considered, including doing nothing, and why not that.';
comment on column proposals.evidence is 'Optional. Support for the claims that are doing real work.';

alter table proposals drop constraint if exists proposals_sections;
alter table proposals add constraint proposals_sections check (
  length(btrim(intent))       >= 60
  and length(btrim(change))       >= 60
  and length(btrim(constraints))  >= 40
  and length(btrim(risks))        >= 60
  and length(btrim(alternatives)) >= 40
) not valid;

-- -----------------------------------------------------------------------------
-- The sharpening, recorded
--
-- Written by the author before the proposal exists, so `proposal_id` is null
-- until submission binds it. While it is null the row is private to its author,
-- which is the individual-first rule holding: a draft, and anything derived
-- from a draft, is nobody else's business until it is submitted.
-- -----------------------------------------------------------------------------

create table if not exists proposal_readiness (
  id             uuid primary key default gen_random_uuid(),
  author_id      uuid not null references profiles on delete cascade,
  proposal_id    uuid references proposals on delete cascade,

  -- sha256 of the body this reading was made against. Binds a reading to one
  -- exact text, so a draft cannot be sharpened and then submitted rewritten.
  body_sha256    text not null,

  readiness      numeric(4,3) not null check (readiness >= 0 and readiness <= 1),
  verdict        text not null,
  -- One entry per section: { section, ready, note, questions[] }
  sections       jsonb not null default '[]'::jsonb,

  prompt_id      text not null,
  prompt_version text not null,
  model          text not null,

  created_at     timestamptz not null default now()
);

create index if not exists readiness_author_idx
  on proposal_readiness (author_id, created_at desc);
create unique index if not exists readiness_proposal_idx
  on proposal_readiness (proposal_id) where proposal_id is not null;

alter table proposal_readiness enable row level security;

-- Your own always. Everyone else's only once it is attached to a proposal they
-- can reach — at which point it is part of the record, like the review.
create policy readiness_read on proposal_readiness for select
  using (
    author_id = auth.uid()
    or (proposal_id is not null and can_reach_proposal(proposal_id))
  );

create policy readiness_create on proposal_readiness for insert
  with check (author_id = auth.uid() and proposal_id is null);

-- No update policy and no delete policy. A sharpening is not revised; a
-- rewritten draft gets a new one, and the old reading stays.

grant select, insert on proposal_readiness to authenticated;

-- -----------------------------------------------------------------------------
-- The gate
-- -----------------------------------------------------------------------------

-- The threshold. Not 0.618: that number is about when agreement has been
-- reached, and this is not agreement. A quality bar sits higher than the point
-- at which people would go along with something.
create or replace function readiness_threshold()
returns numeric language sql immutable set search_path = public as $$
  select 0.700::numeric;
$$;

-- Two things here are not decoration. plpgsql rather than sql, because an
-- inlinable SQL function loses its search_path when the planner folds it into
-- the calling statement. And security definer, because pgcrypto lives in the
-- extensions schema and not every caller has usage on it — this is a pure
-- function of its argument, so running it as the owner grants nothing.
create or replace function proposal_body_hash(p_body text)
returns text language plpgsql immutable security definer
set search_path = public, extensions as $$
begin
  return encode(digest(btrim(coalesce(p_body, '')), 'sha256'), 'hex');
end;
$$;

grant execute on function proposal_body_hash(text), readiness_threshold() to authenticated;

/*
 * Bind the sharpening to the proposal at insert.
 *
 * Refuses unless the author holds an unattached reading, for this exact body,
 * at or above the threshold, made in the last twenty-four hours. On success it
 * stamps the readiness onto the proposal and attaches the reading, so the page
 * can show what was asked and everyone can judge whether the text answers it.
 *
 * Twenty-four hours because a reading is about a text, and a text does not go
 * stale — but a person's situation does, and a sharpening from last month was
 * made about a different set of circumstances.
 */
create or replace function bind_proposal_readiness()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_hash  text;
  v_worst numeric;
  v_id    uuid;
begin
  v_hash := proposal_body_hash(new.body);

  -- The LOWEST score among this author's unattached readings of this exact
  -- text, not the latest. Sharpening the same words again can only lower where
  -- you stand, never raise it — otherwise a judge that varies between runs is
  -- something to be asked repeatedly until it says yes, and the bar becomes a
  -- formality. To score better, change the proposal.
  select min(readiness) into v_worst
    from proposal_readiness
   where author_id = new.author_id
     and proposal_id is null
     and body_sha256 = v_hash
     and created_at > now() - interval '24 hours';

  if v_worst is null then
    raise exception 'this draft has not been sharpened — run the readiness pass on this exact text before submitting it';
  end if;

  if v_worst < readiness_threshold() then
    raise exception 'this draft scored % and the bar is % — the sharpening says what is still unanswered',
      to_char(v_worst, 'FM0.000'), to_char(readiness_threshold(), 'FM0.000');
  end if;

  new.readiness   := v_worst;
  new.body_sha256 := v_hash;
  return new;
end;
$$;

drop trigger if exists proposals_require_readiness on proposals;
create trigger proposals_require_readiness
  before insert on proposals
  for each row execute function bind_proposal_readiness();

-- Attaching happens after the row exists, so it is its own trigger rather than
-- part of the one above.
create or replace function attach_proposal_readiness()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
begin
  update proposal_readiness
     set proposal_id = new.id
   where id = (
     select id from proposal_readiness
      where author_id = new.author_id
        and proposal_id is null
        and body_sha256 = new.body_sha256
      order by created_at desc
      limit 1
   );
  return new;
end;
$$;

drop trigger if exists proposals_attach_readiness on proposals;
create trigger proposals_attach_readiness
  after insert on proposals
  for each row execute function attach_proposal_readiness();

-- The body is derived from the sections and the hash is what the sharpening was
-- bound to, so neither may move afterwards. Same reasoning as the address:
-- submitting is the moment the text stops being yours to change.
create or replace function freeze_proposal_text()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.body is distinct from old.body
     or new.intent is distinct from old.intent
     or new.change is distinct from old.change
     or new.constraints is distinct from old.constraints
     or new.risks is distinct from old.risks
     or new.alternatives is distinct from old.alternatives
     or new.evidence is distinct from old.evidence
     or new.readiness is distinct from old.readiness
     or new.body_sha256 is distinct from old.body_sha256 then
    raise exception 'a proposal''s text is fixed at submission — amendments go in the deliberation thread';
  end if;
  return new;
end;
$$;

drop trigger if exists proposals_freeze_text on proposals;
create trigger proposals_freeze_text
  before update on proposals
  for each row execute function freeze_proposal_text();

comment on table proposal_readiness is
  'The sharpening pass a draft had to clear before it could be submitted. Private to its author until a proposal attaches it.';
