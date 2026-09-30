-- =============================================================================
-- 0023 — LEXICON: what a group means by its words, as distinct from what it
--                 decided
--
--   "Understanding before opinion."                   §Best UX Rules, Rule 2
--   "Collective decisions must respect individual sovereignty."
--                                                     §Universal Law 5
--
-- This one came out of holding the app up against Wilber's quadrants. Three of
-- the four were already built and had not been named as such:
--
--   individual interior  — the journal, the values, the mirror, the guardian
--   individual exterior  — person_standing, the forecasting record
--   collective exterior  — proposals, decisions, projects, scope_rules, the
--                          whole ledger
--   collective interior  — nothing. Not a thin version. Nothing.
--
-- Collective interior is shared meaning: what a group takes a word to mean,
-- which is not the same thing as what it voted for. The gap is not decorative.
-- Two members can both resonate at 0.9 on "shared workshop access" while one
-- means a rota and the other means a key each, and every number this system
-- produces will look like agreement. `alignment_shape()` cannot see it —
-- dispersion measures the spread of numbers, and these two numbers are the
-- same number. The disagreement is upstream of anything the schema records.
--
-- So: a group can raise a word, and anybody in the group can write what they
-- take it to mean. That is the whole feature.
--
-- WHAT IT REFUSES TO DO, AND WHY THAT IS THE FEATURE
--
-- The obvious build is a glossary: one agreed definition per term, edited by
-- whoever gets there first, ratified perhaps. That is collective EXTERIOR
-- again — a decision about a word — and it destroys the only information here.
-- A glossary that says "shared: members book slots via the rota" has quietly
-- overwritten the fact that half the group thought otherwise, which is the
-- fact worth having.
--
-- Hence, deliberately absent and to stay absent:
--
--   * `terms` has no definition, canonical, agreed, official or preferred
--     column. There is nowhere to put the group's answer because the group
--     does not have one.
--   * `term_readings` has no vote, score, endorsement, helpful count or
--     agreement flag. A reading is not a candidate.
--   * nothing anywhere computes whether two readings match. This is the
--     sharpest absence in the file and the easiest to undo by accident: a
--     similarity score over two people's sentences would put a number on
--     meaning, and the number would be wrong in a way nobody could audit.
--     The app shows the readings next to each other and says nothing about
--     whether they agree. The members can read.
--   * no term is attached to a proposal. Matching a word against proposal text
--     is a guess, and a wrong guess tells people a decision turned on a
--     definition it never mentioned.
--
-- REVISIONS, AND WHY THEY ARE KEPT
--
-- A reading is append-only per person per term, with a revision number, like
-- `law_acceptances`. Meaning does change — that is most of what a group learns
-- in its first year — and somebody who has understood something better must be
-- able to say so. But a silent edit would let the discovery that two people
-- meant different things be tidied away afterwards, and that discovery is the
-- point. So the old wording stays and `revised` is visible. Culture is the
-- trail, not the current row.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A word the group has noticed it uses
-- -----------------------------------------------------------------------------

create table if not exists terms (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references groups on delete cascade,

  -- Stored as typed. Uniqueness is case- and whitespace-insensitive, below,
  -- because "Shared" and "shared" are the same argument.
  term       text not null check (length(btrim(term)) between 2 and 60),

  -- Who noticed. Not an owner: they have no more standing over the word than
  -- anybody else, and no policy gives them any.
  raised_by  uuid not null references profiles on delete cascade,
  raised_at  timestamptz not null default now()
);

create unique index if not exists terms_group_word
  on terms (group_id, lower(btrim(term)));

create index if not exists terms_group_recent
  on terms (group_id, raised_at desc);

comment on table terms is
  'A word a group has noticed it uses. It carries no definition — see '
  'term_readings — because the group does not have one and the point of this '
  'table is that it might not.';

-- -----------------------------------------------------------------------------
-- What one person takes it to mean
-- -----------------------------------------------------------------------------

create table if not exists term_readings (
  term_id    uuid not null references terms on delete cascade,
  profile_id uuid not null references profiles on delete cascade,

  -- 1 is the first thing they wrote. Higher is later. The current reading is
  -- the highest revision; the earlier ones stay.
  revision   integer not null check (revision >= 1),

  body       text not null check (length(btrim(body)) between 20 and 600),
  written_at timestamptz not null default now(),

  primary key (term_id, profile_id, revision)
);

comment on table term_readings is
  'One row per person per term per revision. Append-only: no update policy and '
  'no delete policy, so a reading somebody has since changed their mind about '
  'is still on the record. There is no score, vote or agreement column and '
  'nothing computes whether two readings match.';

-- -----------------------------------------------------------------------------
-- Policies
--
-- A term and its readings are group-visible, which is the one place in this
-- schema where somebody's own words are readable by others by default. That is
-- deliberate and it is why nothing else about a person is: a reading exists in
-- order to be read by the people you are deciding with. It is the collective
-- interior, not a diary.
-- -----------------------------------------------------------------------------

alter table terms enable row level security;
alter table term_readings enable row level security;

drop policy if exists terms_read on terms;
create policy terms_read on terms for select
  using (is_group_member(group_id));

drop policy if exists terms_raise on terms;
create policy terms_raise on terms for insert
  with check (raised_by = auth.uid() and is_group_member(group_id));

-- No update policy: renaming a word after people have written readings of it
-- changes what they were answering. Raise the other word.
-- No delete policy: a word the group stopped using is a thing that happened.

drop policy if exists term_readings_read on term_readings;
create policy term_readings_read on term_readings for select
  using (
    exists (
      select 1 from terms t
       where t.id = term_readings.term_id
         and is_group_member(t.group_id)
    )
  );

drop policy if exists term_readings_write on term_readings;
create policy term_readings_write on term_readings for insert
  with check (
    profile_id = auth.uid()
    and exists (
      select 1 from terms t
       where t.id = term_readings.term_id
         and is_group_member(t.group_id)
    )
  );

-- No update policy. No delete policy. See the header.

-- -----------------------------------------------------------------------------
-- Raising a word
--
-- Returns the existing term when the word is already there rather than
-- failing, because two people reaching for the same word independently is the
-- signal, not a collision. The second caller gets taken to the page where the
-- first one's reading already is, which is the useful outcome.
-- -----------------------------------------------------------------------------

create or replace function raise_term(p_group_id uuid, p_term text)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_word text := btrim(coalesce(p_term, ''));
  v_id   uuid;
begin
  if not is_group_member(p_group_id) then
    raise exception 'only a member of this group can raise a word in it';
  end if;

  if length(v_word) < 2 or length(v_word) > 60 then
    raise exception 'a term is between 2 and 60 characters — this one is %',
      length(v_word);
  end if;

  select t.id into v_id
    from terms t
   where t.group_id = p_group_id
     and lower(btrim(t.term)) = lower(v_word);

  if v_id is not null then
    return v_id;
  end if;

  insert into terms (group_id, term, raised_by)
  values (p_group_id, v_word, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function raise_term(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Writing what you mean
--
-- Always an insert, never an update. The revision is stamped here rather than
-- passed in, for the same reason accept_universal_law() stamps its own: a
-- caller that could name the revision could name one that already exists and
-- overwrite it.
-- -----------------------------------------------------------------------------

create or replace function write_reading(p_term_id uuid, p_body text)
returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_group uuid;
  v_text  text := btrim(coalesce(p_body, ''));
  v_next  integer;
begin
  select t.group_id into v_group from terms t where t.id = p_term_id;

  if v_group is null then
    raise exception 'no such term';
  end if;

  if not is_group_member(v_group) then
    raise exception 'only a member of this group can write a reading in it';
  end if;

  if length(v_text) < 20 or length(v_text) > 600 then
    raise exception
      'a reading is between 20 and 600 characters — this one is %',
      length(v_text)
      using hint = 'Say what you take the word to mean here, concretely '
                   'enough that somebody could tell whether they disagree.';
  end if;

  select coalesce(max(r.revision), 0) + 1 into v_next
    from term_readings r
   where r.term_id = p_term_id
     and r.profile_id = auth.uid();

  insert into term_readings (term_id, profile_id, revision, body)
  values (p_term_id, auth.uid(), v_next, v_text);

  return v_next;
end;
$$;

grant execute on function write_reading(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- The group's words
--
-- `voices` is how many people have written a reading. It is not a measure of
-- agreement and there is no measure of agreement: a word three people have
-- read three ways and a word three people have read identically are the same
-- row here, and telling them apart is a job for a member with eyes.
--
-- security definer, so it carries its own membership check — the policy above
-- does not apply to it. That mistake has already been made twice in this
-- schema (positions_for, search_mine) and it is silent when it happens.
-- -----------------------------------------------------------------------------

drop function if exists group_lexicon(uuid);
create or replace function group_lexicon(p_group_id uuid)
returns table (
  id        uuid,
  term      text,
  voices    integer,
  yours     boolean,
  raised_at timestamptz,
  last_read timestamptz
)
language sql security definer stable set search_path = public, extensions as $$
  select t.id,
         t.term,
         (select count(distinct r.profile_id)
            from term_readings r where r.term_id = t.id)::integer,
         exists (select 1 from term_readings r
                  where r.term_id = t.id and r.profile_id = auth.uid()),
         t.raised_at,
         (select max(r.written_at) from term_readings r where r.term_id = t.id)
    from terms t
   where t.group_id = p_group_id
     and is_group_member(p_group_id)
   order by t.term;
$$;

grant execute on function group_lexicon(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- One word, everybody's current reading
--
-- Current means highest revision. `revised` says the person has changed their
-- wording at least once, which is worth seeing; `revisions` says how often.
-- The earlier wordings are still in the table and readable under the same
-- policy — readings_history() returns them — because a group that can see how
-- its language moved is the only kind that can notice it moved.
--
-- Deliberately returns rows in the order the readings were first written, so
-- nobody is at the top for a reason. Not by length, not by recency, and
-- certainly not by anything resembling quality.
-- -----------------------------------------------------------------------------

drop function if exists readings_for(uuid);
create or replace function readings_for(p_term_id uuid)
returns table (
  profile_id   uuid,
  display_name text,
  handle       text,
  body         text,
  revision     integer,
  revised      boolean,
  written_at   timestamptz,
  first_at     timestamptz,
  mine         boolean
)
language sql security definer stable set search_path = public, extensions as $$
  with allowed as (
    select t.id, t.group_id
      from terms t
     where t.id = p_term_id
       and is_group_member(t.group_id)
  ),
  current as (
    select distinct on (r.profile_id)
           r.profile_id, r.body, r.revision, r.written_at
      from term_readings r
      join allowed a on a.id = r.term_id
     order by r.profile_id, r.revision desc
  )
  select c.profile_id,
         p.display_name,
         p.handle,
         c.body,
         c.revision,
         c.revision > 1,
         c.written_at,
         (select min(r2.written_at) from term_readings r2
           where r2.term_id = p_term_id and r2.profile_id = c.profile_id),
         c.profile_id = auth.uid()
    from current c
    join profiles p on p.id = c.profile_id
   order by 8;
$$;

grant execute on function readings_for(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- How one person's reading moved
-- -----------------------------------------------------------------------------

drop function if exists reading_history(uuid, uuid);
create or replace function reading_history(p_term_id uuid, p_profile_id uuid)
returns table (
  revision   integer,
  body       text,
  written_at timestamptz
)
language sql security definer stable set search_path = public, extensions as $$
  select r.revision, r.body, r.written_at
    from term_readings r
    join terms t on t.id = r.term_id
   where r.term_id = p_term_id
     and r.profile_id = p_profile_id
     and is_group_member(t.group_id)
   order by r.revision;
$$;

grant execute on function reading_history(uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Ask finds words too
--
-- A lexicon nobody stumbles across is a page one person visits once. The Ask
-- tab already searches the collective half through the same eligibility
-- question as every other screen; a term joins it on the group's membership,
-- which is the same question asked of a row that has no proposal.
--
-- Matching the reading bodies as well as the word itself is the useful part:
-- somebody searching "rota" should find that the group has a word "shared"
-- which two people have explained in terms of a rota.
-- -----------------------------------------------------------------------------

create or replace function search_collective(p_query text, p_limit integer default 20)
returns table (
  kind     text,
  id       uuid,
  title    text,
  line     text,
  status   text,
  happened timestamptz
)
language sql security definer stable set search_path = public, extensions as $$
  with q as (select '%' || btrim(coalesce(p_query, '')) || '%' as pat)
  select * from (
    select 'proposal'::text, p.id, p.title, p.summary, p.status::text,
           coalesce(p.submitted_at, p.created_at)
      from proposals p, q
     where length(btrim(coalesce(p_query, ''))) >= 2
       and can_reach_proposal(p.id)
       and (p.title ilike q.pat or p.summary ilike q.pat or p.body ilike q.pat)

    union all

    select 'decision', d.proposal_id, p.title, d.rationale_summary, 'decided',
           d.decided_at
      from decisions d
      join proposals p on p.id = d.proposal_id, q
     where length(btrim(coalesce(p_query, ''))) >= 2
       and can_reach_proposal(d.proposal_id)
       and (p.title ilike q.pat or coalesce(d.rationale_summary, '') ilike q.pat)

    union all

    select 'project', pr.proposal_id, p.title, pr.status::text, pr.status::text,
           pr.created_at
      from projects pr
      join proposals p on p.id = pr.proposal_id, q
     where length(btrim(coalesce(p_query, ''))) >= 2
       and can_reach_proposal(pr.proposal_id)
       and p.title ilike q.pat

    union all

    -- A word the group holds. `line` counts the readings rather than quoting
    -- one, because quoting one in a search result would be picking a winner in
    -- the one place this schema refuses to.
    select 'term', t.id, t.term,
           case (select count(distinct r.profile_id)
                   from term_readings r where r.term_id = t.id)
             when 0 then 'nobody has written what this means yet'
             when 1 then 'one person has written what this means'
             else (select count(distinct r.profile_id)
                     from term_readings r where r.term_id = t.id)
                  || ' people have written what this means'
           end,
           'term',
           t.raised_at
      from terms t, q
     where length(btrim(coalesce(p_query, ''))) >= 2
       and is_group_member(t.group_id)
       and (
         t.term ilike q.pat
         or exists (
           select 1 from term_readings r
            where r.term_id = t.id and r.body ilike q.pat
         )
       )
  ) hits(kind, id, title, line, status, happened)
  order by happened desc nulls last
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

grant execute on function search_collective(text, integer) to authenticated;
