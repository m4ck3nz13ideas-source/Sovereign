-- =============================================================================
-- Sovereign — core schema
--
-- Three spaces, per Sovereign Overview (2):
--   INDIVIDUAL  freedom       — private by default, owned by one person
--   COLLECTIVE  coordination  — shared within a group, visible to its members
--   PROJECTS / IMPACT         — what the collective decided, and what happened
--
-- Nothing here is on a chain. Vote recording, identity and treasury sit behind
-- interfaces in src/lib/ledger so a chain adapter can be added later without
-- touching the application. See docs/architecture.md, "The ledger seam".
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

create type entry_mode as enum ('journal', 'faith', 'idea', 'output');

-- Entries arrive unexamined. They are pulled toward reflection, not filed away.
create type entry_state as enum ('unexamined', 'examined', 'archived', 'discarded');

create type concept_status as enum ('seed', 'developing', 'named', 'dormant');

create type group_scope as enum ('local', 'regional', 'national', 'continental', 'global');

create type group_role as enum ('owner', 'steward', 'member');

-- The loop: a proposal is reviewed, deliberated, resonated with, decided,
-- executed, and reflected on. Status moves forward only.
create type proposal_status as enum (
  'in_review',        -- submitted; AI review pending or running
  'in_deliberation',  -- review landed; comments open, sliders unlocked on read
  'voting',           -- first resonance recorded
  'passed',
  'failed',
  'withdrawn',
  'executing',
  'completed'
);

create type flag_kind as enum ('values', 'risk');

create type decision_outcome as enum ('passed', 'failed');

create type project_status as enum ('planning', 'executing', 'completed', 'abandoned');

create type task_status as enum ('todo', 'doing', 'done');

-- -----------------------------------------------------------------------------
-- INDIVIDUAL — Profile (Foundation Layer)
-- "It should feel like opening a personal document, not a social media profile."
-- -----------------------------------------------------------------------------

create table profiles (
  id                uuid primary key references auth.users on delete cascade,
  handle            text unique,
  display_name      text not null default 'Unnamed',
  bio               text,
  avatar_url        text,

  -- Purpose: "a single sentence. Updated rarely, deliberately."
  purpose           text,
  purpose_updated_at timestamptz,

  -- Faith and Belief: "not a creed but a personal articulation. Revisable.
  -- Timestamped so he can see how it has evolved."
  faith_statement   text,
  faith_updated_at  timestamptz,

  -- Sovereignty over disclosure. Off by default; the individual opts in.
  share_values      boolean not null default false,
  share_purpose     boolean not null default false,
  share_faith       boolean not null default false,

  onboarded_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Named values, each with a short personal definition. Reorderable.
create table profile_values (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles on delete cascade,
  name        text not null,
  definition  text,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (profile_id, name)
);

create table profile_passions (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles on delete cascade,
  name        text not null,
  note        text,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Faith and Purpose are revisable but never overwritten — the history is the point.
create table statement_revisions (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles on delete cascade,
  kind        text not null check (kind in ('faith', 'purpose')),
  statement   text not null,
  created_at  timestamptz not null default now()
);

create index on statement_revisions (profile_id, kind, created_at desc);

-- -----------------------------------------------------------------------------
-- INDIVIDUAL — Launch intake
-- One page, four modes. Each mode files to a different place as a banner.
--   journal -> Reflection | faith -> Profile | idea -> Pipeline | output -> Connection
-- -----------------------------------------------------------------------------

create table entries (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references profiles on delete cascade,
  mode          entry_mode not null,
  body          text not null check (length(btrim(body)) > 0),
  expanded_body text,
  state         entry_state not null default 'unexamined',
  examined_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index on entries (profile_id, state, created_at desc);
create index on entries (profile_id, mode, created_at desc);

-- -----------------------------------------------------------------------------
-- INDIVIDUAL — Pipeline (knowledge triage)
-- The mobile face of a personal vault. Markdown in, markdown out.
-- -----------------------------------------------------------------------------

create table concepts (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles on delete cascade,
  title       text not null,
  discipline  text,
  body        text not null default '',
  status      concept_status not null default 'seed',
  -- Set when a concept came from, or is mirrored to, a file in an external vault.
  source_path text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index on concepts (profile_id, updated_at desc);

-- An idea entry connected to a concept. The entry stays; the link is the work.
create table concept_entries (
  concept_id  uuid not null references concepts on delete cascade,
  entry_id    uuid not null references entries on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (concept_id, entry_id)
);

-- -----------------------------------------------------------------------------
-- COLLECTIVE — groups and invite-only membership
-- -----------------------------------------------------------------------------

create table groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  purpose     text,
  scope       group_scope not null default 'local',
  created_by  uuid references profiles on delete set null,

  -- The decision rule, editable by the group in Settings. These are the numbers
  -- V1 exists to tune against real decisions.
  threshold_alignment    numeric(4,3) not null default 0.600,
  threshold_participation numeric(4,3) not null default 0.600,
  threshold_values_floor numeric(4,3) not null default 0.300,

  created_at  timestamptz not null default now()
);

create table group_members (
  group_id   uuid not null references groups on delete cascade,
  profile_id uuid not null references profiles on delete cascade,
  role       group_role not null default 'member',
  joined_at  timestamptz not null default now(),
  primary key (group_id, profile_id)
);

create index on group_members (profile_id);

create table group_invites (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references groups on delete cascade,
  code        text not null unique,
  created_by  uuid references profiles on delete set null,
  max_uses    integer not null default 1 check (max_uses > 0),
  uses        integer not null default 0,
  expires_at  timestamptz,
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- COLLECTIVE — proposals
-- -----------------------------------------------------------------------------

create table proposals (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references groups on delete cascade,
  author_id     uuid not null references profiles on delete cascade,
  title         text not null,
  summary       text not null,
  body          text not null,
  category      text,
  scope         group_scope not null default 'local',

  -- Value-based budgeting, kept as a plain number. No treasury contract.
  budget_amount   numeric(14,2),
  budget_currency text not null default 'GBP',
  term_days       integer,

  status        proposal_status not null default 'in_review',
  created_at    timestamptz not null default now(),
  submitted_at  timestamptz not null default now(),
  closed_at     timestamptz
);

create index on proposals (group_id, status, submitted_at desc);

-- The AI layer's reading of a proposal. Every artefact records the prompt
-- version that produced it, so a score can be traced back to its rubric.
create table proposal_reviews (
  id             uuid primary key default gen_random_uuid(),
  proposal_id    uuid not null references proposals on delete cascade,
  prompt_id      text not null,
  prompt_version text not null,
  model          text not null,

  clarity        numeric(4,3),
  evidence       numeric(4,3),
  feasibility    numeric(4,3),
  reversibility  numeric(4,3),

  -- { "<value name>": 0.0–1.0 }
  values_alignment jsonb not null default '{}'::jsonb,
  -- [ { title, severity: low|medium|high, note } ]
  risks            jsonb not null default '[]'::jsonb,
  -- [ "question" ]
  questions        jsonb not null default '[]'::jsonb,
  -- Past decisions this review was given, and read. Retrieval, on the record.
  memory_used      jsonb not null default '[]'::jsonb,

  summary        text,
  created_at     timestamptz not null default now(),
  created_by     uuid references profiles on delete set null
);

create index on proposal_reviews (proposal_id, created_at desc);

-- A flag cannot be dismissed, only answered.
create table proposal_flags (
  id          uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals on delete cascade,
  review_id   uuid references proposal_reviews on delete set null,
  kind        flag_kind not null,
  label       text not null,
  severity    text not null default 'high',
  detail      text,
  resolution  text,
  resolved_at timestamptz,
  resolved_by uuid references profiles on delete set null,
  created_at  timestamptz not null default now()
);

create index on proposal_flags (proposal_id) where resolved_at is null;

create table deliberation_comments (
  id          uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals on delete cascade,
  author_id   uuid not null references profiles on delete cascade,
  parent_id   uuid references deliberation_comments on delete cascade,
  body        text not null check (length(btrim(body)) > 0),
  created_at  timestamptz not null default now()
);

create index on deliberation_comments (proposal_id, created_at);

-- Understanding before action. The sliders are inert until this row exists.
create table proposal_reads (
  proposal_id uuid not null references proposals on delete cascade,
  profile_id  uuid not null references profiles on delete cascade,
  read_at     timestamptz not null default now(),
  primary key (proposal_id, profile_id)
);

-- Resonance, not approval. Three dimensions, each 0–1.
create table resonance_votes (
  proposal_id uuid not null references proposals on delete cascade,
  profile_id  uuid not null references profiles on delete cascade,
  alignment   numeric(4,3) not null check (alignment between 0 and 1),
  confidence  numeric(4,3) not null check (confidence between 0 and 1),
  urgency     numeric(4,3) not null check (urgency between 0 and 1),
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (proposal_id, profile_id)
);

create table decisions (
  id                uuid primary key default gen_random_uuid(),
  proposal_id       uuid not null unique references proposals on delete cascade,
  outcome           decision_outcome not null,
  avg_alignment     numeric(4,3),
  avg_confidence    numeric(4,3),
  avg_urgency       numeric(4,3),
  participation     numeric(4,3),
  voter_count       integer not null default 0,
  member_count      integer not null default 0,
  -- Which of the author's and group's values the proposal invoked. Used to
  -- retrieve this decision when a similar proposal arrives later.
  values_invoked    text[] not null default '{}',
  rationale_summary text,
  prompt_version    text,
  decided_at        timestamptz not null default now(),
  decided_by        uuid references profiles on delete set null
);

-- -----------------------------------------------------------------------------
-- PROJECTS and IMPACT
-- -----------------------------------------------------------------------------

create table projects (
  id               uuid primary key default gen_random_uuid(),
  proposal_id      uuid not null unique references proposals on delete cascade,
  group_id         uuid not null references groups on delete cascade,
  title            text not null,
  expected_outcome text,
  status           project_status not null default 'planning',
  budget_committed numeric(14,2) not null default 0,
  budget_spent     numeric(14,2) not null default 0,
  started_at       timestamptz,
  completed_at     timestamptz,
  created_at       timestamptz not null default now()
);

create index on projects (group_id, status);

create table project_tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects on delete cascade,
  title       text not null,
  assignee_id uuid references profiles on delete set null,
  status      task_status not null default 'todo',
  due_on      date,
  created_at  timestamptz not null default now()
);

create table project_updates (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects on delete cascade,
  author_id   uuid not null references profiles on delete cascade,
  body        text not null,
  spend_delta numeric(14,2) not null default 0,
  created_at  timestamptz not null default now()
);

-- A project cannot complete without one of these. The loop closes here.
create table reflections (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null unique references projects on delete cascade,
  actual_outcome  text not null check (length(btrim(actual_outcome)) >= 80),
  lesson          text,
  assumption_wrong text,
  ai_summary      text,
  prompt_version  text,
  created_by      uuid references profiles on delete set null,
  created_at      timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- CONNECTION — outward contribution
-- "Keep the feed language warm and intellectual, not social-media frantic."
-- -----------------------------------------------------------------------------

create table posts (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references profiles on delete cascade,
  group_id   uuid references groups on delete cascade,
  entry_id   uuid references entries on delete set null,
  body       text not null check (length(btrim(body)) > 0),
  source_tag text,
  created_at timestamptz not null default now()
);

create index on posts (group_id, created_at desc);

create table post_reactions (
  post_id    uuid not null references posts on delete cascade,
  profile_id uuid not null references profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);

create table post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references posts on delete cascade,
  author_id  uuid not null references profiles on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- The ledger seam
--
-- An append-only, hash-chained record of every governance act. Tamper-evident
-- and exportable without a blockchain. src/lib/ledger writes here; a chain
-- adapter would write here *and* to a contract.
-- -----------------------------------------------------------------------------

create table ledger_events (
  seq           bigserial primary key,
  id            uuid not null default gen_random_uuid(),
  group_id      uuid references groups on delete cascade,
  actor_id      uuid references profiles on delete set null,
  kind          text not null,
  subject_type  text not null,
  subject_id    uuid,
  payload       jsonb not null default '{}'::jsonb,
  prev_hash     text,
  hash          text not null,
  created_at    timestamptz not null default now()
);

create index on ledger_events (group_id, seq desc);

-- -----------------------------------------------------------------------------
-- AI artefacts that belong to a person rather than a proposal:
-- Reflection's "Prompts from your entries" and Pipeline's synthesis prompts.
-- -----------------------------------------------------------------------------

create table ai_prompts_surfaced (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references profiles on delete cascade,
  surface        text not null check (surface in ('reflection', 'pipeline')),
  question       text not null,
  rationale      text,
  prompt_id      text not null,
  prompt_version text not null,
  model          text not null,
  responded_at   timestamptz,
  dismissed_at   timestamptz,
  created_at     timestamptz not null default now()
);

create index on ai_prompts_surfaced (profile_id, surface, created_at desc);

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on profiles
  for each row execute function touch_updated_at();

create trigger concepts_touch before update on concepts
  for each row execute function touch_updated_at();

create trigger resonance_touch before update on resonance_votes
  for each row execute function touch_updated_at();

-- A new auth user gets a profile automatically.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
