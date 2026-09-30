-- =============================================================================
-- 0019 — INQUIRY: what the different ways of knowing hold about a question
--
--   "Understanding before opinion. Users should understand proposals before
--    expressing alignment."                          §Best UX Rules, Rule 2
--   "AI should always: clarify, summarize, simulate, guide. AI should never
--    feel like it is: ruling, manipulating, forcing, replacing consent."
--                                                    §Role of AI
--
-- Between reading a proposal and moving the sliders there was nowhere to go
-- and look something up. This is that surface: you ask a question the proposal
-- turns on, and get back what several bodies of thought hold about it.
--
-- WHY IT RETURNS POSITIONS AND NOT AN ANSWER
--
-- The obvious build is a search box that answers. That is an oracle, and an
-- oracle inside a governance system decides things without anybody voting.
-- Worse, a toggle between "what the papers say" and "what the scriptures say"
-- that returned different ANSWERS would be making a truth claim either way —
-- either that they are interchangeable, or, by whichever it put first, that
-- one settles it.
--
-- So an inquiry returns a SURVEY. Several lenses, each saying what it holds
-- and why in its own terms, attributed, none reconciled, and the disagreement
-- left standing where it is real. The reader does the reconciling, which is
-- the part a governance system must not automate.
--
-- The schema is what enforces that, because copy does not:
--
--   * positions carry no score, rank, weight, confidence or verdict column,
--     and there is nowhere to put one. A ranked survey is an answer wearing a
--     survey's clothes.
--   * record_inquiry() refuses fewer than two distinct lenses. One position is
--     not a survey of anything.
--   * `ordinal` is display order as returned, never a judgement. Nothing sorts
--     on quality because there is no quality column to sort on.
--
-- WHAT IT IS NOT, AND SAYS IT IS NOT
--
-- Every position here is a model's account of what a body of thought holds. It
-- is not a citation, not a literature review, and not verified. `source_hint`
-- names a work or a thinker to go and read — a starting point, not evidence
-- that the claim is true. The screen says this, every time, and the mock
-- adapter REFUSES rather than inventing one: a fabricated survey of human
-- thought is precisely the thing being surveyed, and Universal Law 2 is not a
-- suggestion.
-- =============================================================================

do $$ begin
  if not exists (select 1 from pg_type where typname = 'inquiry_lens') then
    create type inquiry_lens as enum (
      -- The empirical and statistical literature.
      'empirical',
      -- Religious and wisdom texts.
      'scripture',
      -- Argued philosophical positions.
      'philosophy',
      -- Novels, poetry, essays — what the imaginative tradition holds.
      'literature',
      -- Film and documentary.
      'screen',
      -- What people who actually do this work do.
      'practice',
      -- First-person accounts from people the question lands on.
      'testimony'
    );
  end if;
end $$;

create table if not exists inquiries (
  id          uuid primary key default gen_random_uuid(),

  -- An inquiry always hangs off a proposal. Research nobody can find is
  -- research somebody repeats, and the point is the group's understanding
  -- rather than one member's browsing history.
  proposal_id uuid not null references proposals on delete cascade,

  question    text not null check (length(btrim(question)) between 12 and 240),
  asked_by    uuid not null references profiles on delete cascade,

  -- What it could not find or could not fairly represent, said plainly instead
  -- of padded out. A survey with a hole in it should show the hole.
  note        text,

  prompt_id      text not null,
  prompt_version text not null,
  model          text not null,

  created_at  timestamptz not null default now()
);

create table if not exists positions (
  id         uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references inquiries on delete cascade,

  lens       inquiry_lens not null,

  -- What this body of thought holds. Its position, not the truth.
  claim      text not null check (length(btrim(claim)) between 20 and 600),
  -- Why it holds it, in its own terms rather than translated into somebody
  -- else's. A tradition explained only in empirical language has been answered
  -- rather than reported.
  reasoning  text not null check (length(btrim(reasoning)) between 20 and 900),

  -- Somewhere to go and read. A named work, author or tradition — NOT a
  -- citation, and the screen says so. Nullable, because inventing one is worse
  -- than leaving it out.
  source_hint text,

  -- Display order as returned. Not a ranking: see the header. Called `ordinal`
  -- because `position` is a reserved word in Postgres.
  ordinal    integer not null default 0,

  created_at timestamptz not null default now()
);

comment on table positions is
  'What each lens holds about an inquiry. There is no score, rank, weight, '
  'confidence or verdict column and there must never be one — a ranked survey '
  'is an answer, and answering is the part a governance system must not '
  'automate.';

create index if not exists inquiries_proposal_idx
  on inquiries (proposal_id, created_at desc);
create index if not exists positions_inquiry_idx
  on positions (inquiry_id, ordinal);

-- -----------------------------------------------------------------------------
-- Policies
--
-- Read follows the proposal, like everything else: research in service of the
-- group's understanding belongs to whoever the proposal belongs to.
--
-- No insert policy on either table. The only way in is record_inquiry(), which
-- is what enforces the two-lens floor. No update policy anywhere: a position is
-- what a lens held when it was asked, and asking again makes a new inquiry
-- rather than editing an old one.
-- -----------------------------------------------------------------------------

alter table inquiries enable row level security;
alter table positions  enable row level security;

drop policy if exists inquiries_read on inquiries;
create policy inquiries_read on inquiries for select
  using (can_reach_proposal(proposal_id));

-- The asker may withdraw their own. An inquiry reaches no decision and is not
-- a governance record — unlike a flag, a concern or a projection, none of
-- which can be taken back.
drop policy if exists inquiries_withdraw on inquiries;
create policy inquiries_withdraw on inquiries for delete
  using (asked_by = auth.uid());

drop policy if exists positions_read on positions;
create policy positions_read on positions for select
  using (exists (
    select 1 from inquiries i
     where i.id = positions.inquiry_id
       and can_reach_proposal(i.proposal_id)
  ));

-- -----------------------------------------------------------------------------
-- Recording one
--
-- Positions arrive as jsonb because they come from a model in one shot, and
-- splitting that into a round trip per position would let a caller write half
-- a survey. Either the whole thing lands or none of it does.
-- -----------------------------------------------------------------------------

create or replace function record_inquiry(
  p_proposal_id    uuid,
  p_question       text,
  p_note           text,
  p_prompt_id      text,
  p_prompt_version text,
  p_model          text,
  p_positions      jsonb
)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id uuid;
  v_lenses integer;
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'only a signed-in person can ask';
  end if;

  if not can_reach_proposal(p_proposal_id) then
    raise exception 'this proposal is not addressed to you';
  end if;

  select count(*), count(distinct (x->>'lens'))
    into v_count, v_lenses
    from jsonb_array_elements(coalesce(p_positions, '[]'::jsonb)) as x;

  -- The floor that makes this a survey rather than an answer. One lens
  -- speaking alone is an oracle with extra steps.
  if coalesce(v_lenses, 0) < 2 then
    raise exception 'an inquiry needs at least two ways of knowing and this one has % — a survey of one is an answer',
      coalesce(v_lenses, 0);
  end if;

  insert into inquiries (proposal_id, question, asked_by, note,
                         prompt_id, prompt_version, model)
  values (p_proposal_id, btrim(p_question), auth.uid(), nullif(btrim(coalesce(p_note, '')), ''),
          p_prompt_id, p_prompt_version, p_model)
  returning id into v_id;

  insert into positions (inquiry_id, lens, claim, reasoning, source_hint, ordinal)
  select v_id,
         (x->>'lens')::inquiry_lens,
         btrim(x->>'claim'),
         btrim(x->>'reasoning'),
         nullif(btrim(coalesce(x->>'source_hint', '')), ''),
         (n - 1)::int
    from jsonb_array_elements(p_positions) with ordinality as t(x, n);

  return v_id;
end;
$$;

grant execute on function record_inquiry(uuid, text, text, text, text, text, jsonb)
to authenticated;

-- -----------------------------------------------------------------------------
-- Reading them back
--
-- Ordered by when they were asked and then by the order the lenses came back
-- in. Never by anything that could be mistaken for which one is right.
-- -----------------------------------------------------------------------------

drop function if exists inquiries_for(uuid);
create or replace function inquiries_for(p_proposal_id uuid)
returns table (
  id         uuid,
  question   text,
  note       text,
  asked_by   uuid,
  asked_by_name text,
  model      text,
  lenses     integer,
  created_at timestamptz
)
language sql security definer stable set search_path = public, extensions as $$
  select i.id, i.question, i.note, i.asked_by, p.display_name, i.model,
         (select count(distinct po.lens)::int from positions po where po.inquiry_id = i.id),
         i.created_at
    from inquiries i
    join profiles p on p.id = i.asked_by
   where i.proposal_id = p_proposal_id
     and can_reach_proposal(i.proposal_id)
   order by i.created_at desc;
$$;

grant execute on function inquiries_for(uuid) to authenticated;

drop function if exists positions_for(uuid);
create or replace function positions_for(p_inquiry_id uuid)
returns table (
  lens        inquiry_lens,
  claim       text,
  reasoning   text,
  source_hint text,
  ordinal     integer
)
language sql security definer stable set search_path = public, extensions as $$
  select po.lens, po.claim, po.reasoning, po.source_hint, po.ordinal
    from positions po
    join inquiries i on i.id = po.inquiry_id
   where po.inquiry_id = p_inquiry_id
     and can_reach_proposal(i.proposal_id)
   order by po.ordinal;
$$;

grant execute on function positions_for(uuid) to authenticated;
