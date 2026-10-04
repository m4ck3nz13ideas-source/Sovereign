-- =============================================================================
-- 0028 — SIGHTINGS: raising a word from where it was used
--
-- 0023 built the lexicon and refused one thing on purpose: "no term is attached
-- to a proposal. Matching a word against proposal text is a guess, and a wrong
-- guess tells people a decision turned on a definition it never mentioned."
--
-- That refusal stands. What this file adds is not a match and not a guess. It
-- is a record that a PERSON, reading a proposal, stopped at a word in it and
-- raised it — with the sentence they stopped at, quoted, and their name on it.
-- The difference is the whole design:
--
--   a match      "this proposal is about 'shared'"   — the system's claim
--   a sighting   "Ann stopped at 'shared' here:      — a person's act,
--                 '…members get shared access to      attributed, dated,
--                 the workshop…'"                     and checkable
--
-- A sighting says where somebody noticed the word. It says nothing about
-- whether the decision turned on it, and nothing reads it as though it did.
--
-- HOW IT STAYS A QUOTE RATHER THAN A CLAIM
--
--   * The excerpt must occur in the proposal's own text — title, summary or
--     body, whitespace- and case-insensitive — checked in the function, not
--     trusted from the client. A sighting that quotes words the proposal does
--     not contain would be exactly the fabricated attachment 0023 refused.
--   * The word must occur inside the excerpt. You raise what you are pointing
--     at, not something the sentence reminded you of.
--   * It is attributed and append-only. No update policy, no delete policy.
--     Somebody noticed; that happened.
--   * Groups only, and the same group. A place has no register (rule 15) and a
--     word belongs to the group that uses it, so a proposal can only be the
--     scene of a sighting for its own group's words.
--   * One sighting per person per word per proposal. Twelve people stopping at
--     the same word is twelve rows; one person pressing twelve times is one.
--
-- WHAT IT DOES NOT DO, AND MUST NOT GROW
--
--   * No column on `proposals`. The proposal page does not list "words in this
--     proposal" — that list would read as the proposal's vocabulary, which is
--     the claim this file refuses to make. The sighting shows on the WORD'S
--     page, as where it was noticed.
--   * No count of sightings anywhere near a decision. Nothing in
--     `close_proposal()`, `cast_resonance()` or `can_reach_proposal()` reads
--     this table. How often a word was stopped at is not a measure of anything
--     the ledger records.
--   * No weight, score, confidence or relevance column. A sighting is not
--     evidence that the word matters, only that somebody thought it might.
-- =============================================================================

create table if not exists term_sightings (
  term_id     uuid not null references terms on delete cascade,
  proposal_id uuid not null references proposals on delete cascade,
  raised_by   uuid not null references profiles on delete cascade,

  -- The sentence they stopped at, verbatim from the proposal. Long enough to
  -- carry the context, short enough that it is a quotation and not a summary.
  excerpt     text not null check (length(btrim(excerpt)) between 2 and 400),

  raised_at   timestamptz not null default now(),

  primary key (term_id, proposal_id, raised_by)
);

create index if not exists term_sightings_term
  on term_sightings (term_id, raised_at);

comment on table term_sightings is
  'Where somebody noticed a word: a person, a proposal, and the sentence they '
  'stopped at, quoted and verified against the proposal text. Not a claim that '
  'the proposal is about the word or that a decision turned on it. Append-only; '
  'read by nothing that decides anything.';

alter table term_sightings enable row level security;

-- Readable by the group the word belongs to — the same people who can read the
-- word and its readings. A sighting is only ever of the group's own proposal,
-- so this is never wider than who could read the quoted sentence already.
drop policy if exists term_sightings_read on term_sightings;
create policy term_sightings_read on term_sightings for select
  using (
    exists (
      select 1 from terms t
       where t.id = term_sightings.term_id
         and is_group_member(t.group_id)
    )
  );

-- No insert policy: writing goes through raise_term_from(), which does the
-- checking a policy cannot (that the quote is really in the proposal).
-- No update policy. No delete policy.

-- -----------------------------------------------------------------------------
-- Whitespace- and case-insensitive text, for comparing a quote with its source.
-- Prose renders paragraphs trimmed and the browser's selection can collapse or
-- keep newlines; neither should make a real quotation fail.
-- -----------------------------------------------------------------------------

create or replace function flat_text(p text)
returns text
language sql immutable as $$
  select btrim(regexp_replace(lower(coalesce(p, '')), '\s+', ' ', 'g'));
$$;

-- -----------------------------------------------------------------------------
-- Raising a word from a proposal
--
-- Does what raise_term() does — returns the group's existing word if it is
-- already there — and records where it was noticed. security definer, so it
-- carries its own checks: reach, membership, same group, and that the quote is
-- a quote.
-- -----------------------------------------------------------------------------

create or replace function raise_term_from(
  p_proposal_id uuid,
  p_term        text,
  p_excerpt     text
)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_word    text := btrim(coalesce(p_term, ''));
  v_excerpt text := btrim(regexp_replace(coalesce(p_excerpt, ''), '\s+', ' ', 'g'));
  v_group   uuid;
  v_source  text;
  v_id      uuid;
begin
  if not coalesce(can_reach_proposal(p_proposal_id), false) then
    raise exception 'that proposal is not addressed to you';
  end if;

  select p.group_id,
         flat_text(concat_ws(' ', p.title, p.summary, p.body))
    into v_group, v_source
    from proposals p
   where p.id = p_proposal_id;

  -- A place has no register, so there is no group for the word to belong to.
  if v_group is null then
    raise exception 'words belong to a group, and this proposal is addressed to a place'
      using hint = 'A place has nobody whose language it is. Raise the word in your group.';
  end if;

  if not is_group_member(v_group) then
    raise exception 'only a member of this group can raise a word in it';
  end if;

  if length(v_word) < 2 or length(v_word) > 60 then
    raise exception 'a term is between 2 and 60 characters — this one is %',
      length(v_word);
  end if;

  if length(v_excerpt) < 2 or length(v_excerpt) > 400 then
    raise exception 'the quoted passage is between 2 and 400 characters — this one is %',
      length(v_excerpt);
  end if;

  -- The two checks that keep this a quotation and not an attachment.
  if position(flat_text(v_excerpt) in v_source) = 0 then
    raise exception 'that passage is not in this proposal'
      using hint = 'A sighting quotes the proposal. It cannot quote something it does not say.';
  end if;

  if position(flat_text(v_word) in flat_text(v_excerpt)) = 0 then
    raise exception 'the word is not in the passage you quoted';
  end if;

  select t.id into v_id
    from terms t
   where t.group_id = v_group
     and lower(btrim(t.term)) = lower(v_word);

  if v_id is null then
    insert into terms (group_id, term, raised_by)
    values (v_group, v_word, auth.uid())
    returning id into v_id;
  end if;

  insert into term_sightings (term_id, proposal_id, raised_by, excerpt)
  values (v_id, p_proposal_id, auth.uid(), v_excerpt)
  on conflict (term_id, proposal_id, raised_by) do nothing;

  return v_id;
end;
$$;

grant execute on function raise_term_from(uuid, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Where a word was noticed
--
-- Oldest first, so it reads in the order it happened. Filters on reach as well
-- as membership: a member who could not read a proposal (none today — a group
-- proposal reaches every member — but the question is asked the same way
-- everywhere, rule 10) does not learn its title from a sighting.
-- -----------------------------------------------------------------------------

drop function if exists sightings_for(uuid);
create or replace function sightings_for(p_term_id uuid)
returns table (
  proposal_id    uuid,
  proposal_title text,
  excerpt        text,
  raised_by      uuid,
  display_name   text,
  raised_at      timestamptz,
  mine           boolean
)
language sql security definer stable set search_path = public, extensions as $$
  select s.proposal_id, p.title, s.excerpt, s.raised_by, pr.display_name,
         s.raised_at, s.raised_by = auth.uid()
    from term_sightings s
    join terms t     on t.id = s.term_id
    join proposals p on p.id = s.proposal_id
    join profiles pr on pr.id = s.raised_by
   where s.term_id = p_term_id
     and is_group_member(t.group_id)
     and coalesce(can_reach_proposal(s.proposal_id), false)
   order by s.raised_at;
$$;

grant execute on function sightings_for(uuid) to authenticated;
