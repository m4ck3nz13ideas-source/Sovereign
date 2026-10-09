-- 0045 — Data rights (rule 42): explicit consent, a copy of everything, and
-- leaving for good.
--
-- UK GDPR treats three things Sovereign holds as special category data:
-- political opinions (every proposal, response and debate is one), religious
-- or philosophical beliefs (faith, values, beliefs about yourself), and
-- whatever a person chooses to write about their own health in a journal.
-- The condition Sovereign relies on for all of it is EXPLICIT CONSENT
-- (Article 9(2)(a)) — so it has to be asked for in words that name the data,
-- recorded, and given before any of it is collected.
--
-- THREE PIECES
--
--   * CONSENT. `data_consents` is a record, like `law_acceptances` (rule 28):
--     one row per person per purpose per wording version, never updated and
--     never deleted, because "agreed" has to name what was agreed to.
--     `record_consent()` stamps the current version itself. Onboarding cannot
--     finish without both purposes on the record at the current version.
--
--   * A COPY. `my_data_export()` returns every row that names the caller,
--     table by table, as one JSON document. What it reads is DATA, not code:
--     `private.data_map` lists every column that points at a profile, and
--     `39_data_rights.sql` fails if a column exists that the map does not
--     classify — so a table added later cannot be silently left out of a
--     copy, or silently left behind by an erasure. Four columns are never
--     exported because the row is somebody else's: who muted you (rule 32),
--     somebody's read state in a chat with you (rule 23), who follows you
--     (rule 19) and the other side of a SOV transfer (rule 33).
--
--   * LEAVING. `erase_my_account()` deletes what is yours alone — journal,
--     ideas, values, beliefs, Know yourself, guardian notes, to-dos, learning,
--     posts and comments, messages you wrote, follows, friendships, your
--     personhood proof, any business you own — removes you from your groups,
--     strips the profile to a tombstone named "Former member", and deletes the
--     sign-in account, so the email address is gone.
--
--     What it KEEPS, unattributed, is the collective record: proposals,
--     responses, debate, flags, predictions, decisions, commitments, the
--     ledger and SOV entries. Rule 34 is why: a decision is a statement about
--     what people had said when it closed, and deleting the rows underneath it
--     would leave a `voter_count` the table contradicts and a ledger that no
--     longer replays. Rule 36 (written once) says the same about debate. After
--     erasure those rows point at a profile that names nobody and an auth
--     account that no longer exists. The privacy notice says so.
--
--   To make the tombstone possible, `profiles.id` stops cascading from
--   `auth.users`: deleting the sign-in account no longer takes the profile
--   (and through it, every decision) with it.

------------------------------------------------------------ the tombstone

alter table profiles add column if not exists erased_at timestamptz;

do $$
declare c text;
begin
  select conname into c
    from pg_constraint
   where conrelid = 'public.profiles'::regclass and contype = 'f'
     and confrelid = 'auth.users'::regclass;
  if c is not null then
    execute format('alter table profiles drop constraint %I', c);
  end if;
end $$;

------------------------------------------------------------ consent

create or replace function consent_version()
returns text language sql immutable as $$ select '2026-10-09'::text $$;

create table if not exists data_consents (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id),
  purpose     text not null check (purpose in ('special_category', 'adult')),
  version     text not null,
  given_at    timestamptz not null default now(),
  unique (profile_id, purpose, version)
);

alter table data_consents enable row level security;

drop policy if exists data_consents_own_read on data_consents;
create policy data_consents_own_read on data_consents
  for select using (profile_id = auth.uid());
-- No insert, update or delete policy: record_consent() is the only way in,
-- and nothing takes a record back out.

grant select on data_consents to authenticated;

create or replace function record_consent(p_purposes text[])
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  p text;
begin
  if me is null then raise exception 'sign in first'; end if;
  if p_purposes is null
     or not (p_purposes @> array['special_category', 'adult']) then
    raise exception 'both are needed: explicit consent to sensitive data, and confirming you are 18 or over';
  end if;
  foreach p in array p_purposes loop
    if p not in ('special_category', 'adult') then
      raise exception 'unknown consent purpose %', p;
    end if;
    insert into data_consents (profile_id, purpose, version)
    values (me, p, consent_version())
    on conflict (profile_id, purpose, version) do nothing;
  end loop;
end;
$$;

-- Only ever about the caller: no argument, so it cannot be asked about
-- anybody else.
create or replace function has_current_consent()
returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select count(distinct purpose) = 2
    from data_consents
   where profile_id = auth.uid()
     and version = consent_version();
$$;

revoke all on function record_consent(text[]) from public;
revoke all on function has_current_consent() from public;
grant execute on function record_consent(text[]) to authenticated;
grant execute on function has_current_consent() to authenticated;

-- Arriving needs consent on the record, like it needs the ten laws (0021).
-- Only the null-to-not-null moment: people already in are asked by the app,
-- not pushed back through the door by a trigger.
create or replace function profiles_require_consent()
returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.onboarded_at is null or old.onboarded_at is not null then
    return new;
  end if;
  if (select count(distinct purpose) from data_consents
       where profile_id = new.id and version = consent_version()) < 2 then
    raise exception 'onboarding cannot finish without explicit consent to sensitive data and confirming you are 18 or over'
      using hint = 'The consent screen calls record_consent().';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_require_consent on profiles;
create trigger profiles_require_consent
  before update on profiles
  for each row execute function profiles_require_consent();

------------------------------------------------------------ the map

create schema if not exists private;

-- Every column in public that references profiles(id), and what happens to
-- its rows. `export`: included in a person's copy. `erase`: 'delete' removes
-- the rows on erasure, 'keep' leaves them pointing at the tombstone.
-- `erase_where` narrows a delete (SQL predicate on the row, trusted: it is
-- written here and nowhere else).
create table if not exists private.data_map (
  table_name  text not null,
  column_name text not null,
  export      boolean not null,
  erase       text not null check (erase in ('delete', 'keep')),
  erase_where text,
  ord         int not null default 100,
  why         text not null,
  primary key (table_name, column_name)
);

revoke all on private.data_map from public;

truncate private.data_map;
insert into private.data_map (table_name, column_name, export, erase, erase_where, ord, why) values
  -- Yours alone (rule 1, 25, 39, 41): deleted.
  ('profile_values',      'profile_id',   true,  'delete', null, 10, 'your values'),
  ('profile_passions',    'profile_id',   true,  'delete', null, 10, 'your passions'),
  ('statement_revisions', 'profile_id',   true,  'delete', null, 10, 'your purpose and faith history'),
  ('entries',             'profile_id',   true,  'delete', null, 10, 'your journal'),
  ('concepts',            'profile_id',   true,  'delete', null, 10, 'your ideas'),
  ('ai_prompts_surfaced', 'profile_id',   true,  'delete', null, 10, 'prompts shown to you'),
  ('guardian_notes',      'profile_id',   true,  'delete', null, 10, 'your guardian notes'),
  ('todos',               'profile_id',   true,  'delete', null, 10, 'your to-dos'),
  ('self_assessments',    'profile_id',   true,  'delete', null, 10, 'Know yourself'),
  ('lesson_progress',     'profile_id',   true,  'delete', null, 10, 'Learn'),
  ('feed_settings',       'profile_id',   true,  'delete', null, 10, 'your feed settings'),
  ('feed_mutes',          'profile_id',   true,  'delete', null, 10, 'who you muted'),
  ('feed_mutes',          'muted_id',     false, 'delete', null, 10, 'somebody else muting you: never shown to you (rule 32)'),
  ('sphere_follows',      'profile_id',   true,  'delete', null, 10, 'Spheres you follow'),
  ('inquiries',           'asked_by',     true,  'delete', 'proposal_id is null', 10, 'questions asked on their own are owner-only; ones on a proposal are kept'),
  ('personhood_proofs',   'profile_id',   true,  'delete', null, 10, 'your personhood nullifier'),
  ('marketplace_reviewers','profile_id',  true,  'delete', null, 10, 'reviewer role'),
  ('ad_clicks',           'viewer_id',    true,  'keep',   null, 100, 'billing record of a click, unattributed after erasure'),
  -- The social side: yours, deleted.
  ('post_likes',          'profile_id',   true,  'delete', null, 20, 'your likes'),
  ('post_reactions',      'profile_id',   true,  'delete', null, 20, 'your saves'),
  ('post_comments',       'author_id',    true,  'delete', null, 20, 'your comments'),
  ('posts',               'author_id',    true,  'delete', null, 30, 'your posts'),
  ('post_witness',        'author_id',    true,  'delete', null, 40, 'the door reading of your posts'),
  ('follows',             'follower_id',  true,  'delete', null, 20, 'who you follow'),
  ('follows',             'followed_id',  false, 'delete', null, 20, 'who follows you: nobody reads a follow graph (rule 19)'),
  ('friendships',         'lower_id',     true,  'delete', null, 50, 'friendships'),
  ('friendships',         'higher_id',    true,  'delete', null, 50, 'friendships'),
  ('friendships',         'requested_by', true,  'delete', null, 50, 'friendships'),
  ('chat_marks',          'profile_id',   true,  'delete', null, 20, 'your read state'),
  ('chat_marks',          'other_id',     false, 'delete', null, 20, 'somebody else''s read state (rule 23)'),
  ('messages',            'author_id',    true,  'delete', null, 30, 'messages you wrote'),
  ('messages',            'lower_id',     true,  'keep',   null, 100, 'messages the other person wrote stay theirs'),
  ('messages',            'higher_id',    true,  'keep',   null, 100, 'messages the other person wrote stay theirs'),
  ('group_members',       'profile_id',   true,  'delete', null, 60, 'you leave every group'),
  ('vendors',             'owner_id',     true,  'delete', null, 70, 'a business you own'),
  ('vendor_concerns',     'raised_by',    true,  'keep',   null, 100, 'a concern a reviewer may still be answering'),
  -- The collective record: kept, unattributed (rules 34, 36).
  ('groups',              'created_by',   true,  'keep', null, 100, 'group record'),
  ('group_invites',       'created_by',   true,  'keep', null, 100, 'group record'),
  ('proposals',           'author_id',    true,  'keep', null, 100, 'decided or deciding'),
  ('proposal_reviews',    'created_by',   true,  'keep', null, 100, 'review record'),
  ('proposal_flags',      'resolved_by',  true,  'keep', null, 100, 'written once (rule 5)'),
  ('deliberation_comments','author_id',   true,  'keep', null, 100, 'written once (rule 36)'),
  ('deliberation_comments','answered_by', true,  'keep', null, 100, 'written once (rule 36)'),
  ('proposal_reads',      'profile_id',   true,  'keep', null, 100, 'understanding before action (rule 4)'),
  ('resonance_votes',     'profile_id',   true,  'keep', null, 100, 'a decision counts these (rule 34)'),
  ('decisions',           'decided_by',   true,  'keep', null, 100, 'decision record'),
  ('project_tasks',       'assignee_id',  true,  'keep', null, 100, 'project record'),
  ('project_updates',     'author_id',    true,  'keep', null, 100, 'project record'),
  ('reflections',         'created_by',   true,  'keep', null, 100, 'project record (rule 6)'),
  ('ledger_events',       'actor_id',     true,  'keep', null, 100, 'a chain that must replay (rule 34)'),
  ('law_assessments',     'resolved_by',  true,  'keep', null, 100, 'written once (rule 36)'),
  ('law_challenges',      'challenger_id',true,  'keep', null, 100, 'audit record'),
  ('proposal_needs',      'created_by',   true,  'keep', null, 100, 'project record'),
  ('commitments',         'profile_id',   true,  'keep', null, 100, 'activation counted these (rule 9)'),
  ('proposal_readiness',  'author_id',    true,  'keep', null, 100, 'bound to a submitted proposal (rule 11)'),
  ('debate_summaries',    'created_by',   true,  'keep', null, 100, 'debate record'),
  ('projections',         'created_by',   true,  'keep', null, 100, 'dated and frozen (rule 16)'),
  ('projections',         'resolved_by',  true,  'keep', null, 100, 'dated and frozen (rule 16)'),
  ('contentions',         'created_by',   true,  'keep', null, 100, 'contention record (rule 21)'),
  ('contention_members',  'added_by',     true,  'keep', null, 100, 'contention record (rule 21)'),
  ('preferences',         'profile_id',   true,  'keep', null, 100, 'an ordering counted these (rule 21)'),
  ('law_revisions',       'adopted_by',   true,  'keep', null, 100, 'the constitution''s history (rule 24)'),
  ('law_acceptances',     'profile_id',   true,  'keep', null, 100, 'record of what was agreed (rule 28)'),
  ('data_consents',       'profile_id',   true,  'keep', null, 100, 'proof consent was asked for and given'),
  ('terms',               'raised_by',    true,  'keep', null, 100, 'group lexicon, append-only (rule 30)'),
  ('term_readings',       'profile_id',   true,  'keep', null, 100, 'append-only (rule 30)'),
  ('term_sightings',      'raised_by',    true,  'keep', null, 100, 'append-only (rule 35)'),
  ('sov_entries',         'account_profile', true,  'keep', null, 100, 'balances are sums of entries (rule 33)'),
  ('sov_entries',         'counterparty_profile', false, 'keep', null, 100, 'the other side of somebody else''s transfer (rule 33)'),
  ('vendor_vettings',     'signed_by',    true,  'keep', null, 100, 'review record (rule 37)'),
  ('vendor_suspensions',  'suspended_by', true,  'keep', null, 100, 'review record (rule 37)'),
  ('vendor_suspensions',  'lifted_by',    true,  'keep', null, 100, 'review record (rule 37)'),
  ('vendor_concerns',     'closed_by',    true,  'keep', null, 100, 'review record (rule 37)'),
  ('offerings',           'removed_by',   true,  'keep', null, 100, 'review record (rule 37)'),
  ('vendor_verifications','checked_by',   true,  'keep', null, 100, 'review record (rule 37)'),
  ('proposal_requirement_answers','answered_by', true, 'keep', null, 100, 'answered on the record (rule 13)'),
  ('condition_challenges','challenger_id',true,  'keep', null, 100, 'debate record (rule 13)'),
  ('condition_challenge_replies','author_id', true, 'keep', null, 100, 'debate record (rule 13)');

------------------------------------------------------------ a copy

create or replace function my_data_export()
returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  m record;
  rows jsonb;
  out jsonb;
begin
  if me is null then raise exception 'sign in first'; end if;

  out := jsonb_build_object(
    'exported_at', now(),
    'about', 'Everything Sovereign holds that names you, table by table. Rows other people wrote about you that would reveal their private choices (who muted or follows you, their read state, their SOV) are not included.',
    'account', (select jsonb_build_object('email', u.email) from auth.users u where u.id = me),
    'profile', (select to_jsonb(p) from profiles p where p.id = me)
  );

  for m in select * from private.data_map where export order by table_name, column_name loop
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from public.%I t where t.%I = $1',
      m.table_name, m.column_name)
      into rows using me;
    if jsonb_array_length(rows) > 0 then
      out := out || jsonb_build_object(m.table_name || '.' || m.column_name, rows);
    end if;
  end loop;

  return out;
end;
$$;

revoke all on function my_data_export() from public;
grant execute on function my_data_export() to authenticated;

------------------------------------------------------------ leaving

create or replace function erase_my_account(p_confirm text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  m record;
begin
  if me is null then raise exception 'sign in first'; end if;
  if p_confirm is distinct from 'delete my account' then
    raise exception 'type "delete my account" to confirm';
  end if;

  for m in select * from private.data_map where erase = 'delete' order by ord, table_name, column_name loop
    execute format('delete from public.%I where %I = $1 %s',
      m.table_name, m.column_name,
      case when m.erase_where is null then '' else 'and (' || m.erase_where || ')' end)
      using me;
  end loop;

  update profiles set
    display_name = 'Former member',
    handle = null, bio = null, avatar_url = null,
    purpose = null, purpose_updated_at = null,
    faith_statement = null, faith_updated_at = null,
    share_values = false, share_purpose = false, share_faith = false,
    place_local = null, place_regional = null, place_national = null,
    place_continental = null, place_set_at = null,
    erased_at = now()
  where id = me;

  -- The sign-in account and its email. In Supabase this cascades to the
  -- account's sessions and identities inside the auth schema.
  delete from auth.users where id = me;
end;
$$;

revoke all on function erase_my_account(text) from public;
grant execute on function erase_my_account(text) to authenticated;

------------------------------------------------------------ the pulse

-- A tombstone is not one of the people.
create or replace function public_pulse()
returns table (people int, decisions int, projects_done int, businesses int)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::int from profiles where onboarded_at is not null and erased_at is null),
    (select count(*)::int from decisions),
    (select count(*)::int from projects where status = 'completed'),
    (select count(*)::int from vendors v where vendor_approved(v.id));
$$;

comment on table data_consents is
  'Rule 42: explicit consent to special category data, and being 18 or over. One row per person per purpose per wording version; never updated or deleted.';
