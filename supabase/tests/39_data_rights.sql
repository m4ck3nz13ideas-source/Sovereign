-- Data rights: explicit consent, a copy of everything, leaving for good
-- (0045, rule 42).
\set ON_ERROR_STOP on
\pset pager off

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'app') then create role app login; end if;
end $$;
grant usage on schema public, auth to app;
grant select, insert, update, delete on all tables in schema public to app;
grant usage, select on all sequences in schema public to app;
grant execute on all functions in schema public to app;
grant execute on function auth.uid() to app;
grant select on auth.users to app;

update conditions_epoch set since = 'infinity';

insert into auth.users (id, email) values
  ('a1919191-9191-9191-9191-91919191919a', 'leaving@example.com'),
  ('b1919191-9191-9191-9191-91919191919b', 'staying@example.com');

create or replace function test_rights_ready(p_pid uuid, p_author uuid)
returns void language plpgsql as $$
declare l text; rid uuid;
begin
  perform set_config('test.uid', p_author::text, true);
  insert into proposal_reviews (proposal_id, prompt_id, prompt_version, model, summary)
  values (p_pid, 'proposal.review', '1.2.0', 'test', 'A reading.') returning id into rid;
  foreach l in array array['sanctity_of_life','truth_and_transparency','sovereignty_of_the_individual',
    'equity_and_justice','subsidiarity','reciprocity_and_mutual_care','stewardship_of_earth',
    'harmony_of_diversity','right_use_of_power','continuous_evolution'] loop
    insert into law_assessments (proposal_id, review_id, law_id, verdict, reasoning, prompt_id, prompt_version, model)
    values (p_pid, rid, l, 'aligned', 'clear', 'law.audit', '1.0.0', 'test');
  end loop;
  update proposals set status = 'in_deliberation' where id = p_pid and status = 'in_review';
end $$;

-- A friendship and a chat, written as the owner because the friendship
-- functions are not what this suite is about.
insert into friendships (lower_id, higher_id, requested_by, accepted_at) values
  ('a1919191-9191-9191-9191-91919191919a', 'b1919191-9191-9191-9191-91919191919b',
   'a1919191-9191-9191-9191-91919191919a', now());
insert into messages (lower_id, higher_id, author_id, body) values
  ('a1919191-9191-9191-9191-91919191919a', 'b1919191-9191-9191-9191-91919191919b',
   'a1919191-9191-9191-9191-91919191919a', 'From the one leaving.'),
  ('a1919191-9191-9191-9191-91919191919a', 'b1919191-9191-9191-9191-91919191919b',
   'b1919191-9191-9191-9191-91919191919b', 'From the one staying.');
insert into lesson_progress (profile_id, lesson_id, reflection) values
  ('a1919191-9191-9191-9191-91919191919a', 'law-truth', 'Mine.');

set role app;

do $$
declare
  me    uuid := 'a1919191-9191-9191-9191-91919191919a';
  other uuid := 'b1919191-9191-9191-9191-91919191919b';
  gid uuid; code text; pid uuid; n int; flag boolean; doc jsonb; nm text;
  passes int := 0; fails int := 0;
begin
  ------------------------------------------------------------------ consent
  perform set_config('test.uid', me::text, true);

  if not has_current_consent() then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: consent reported before any was given'; end if;

  begin
    perform record_consent(array['adult']);
    fails := fails + 1; raise warning 'FAIL: consent recorded without the sensitive-data purpose';
  exception when others then passes := passes + 1; end;

  begin
    perform record_consent(array['special_category', 'adult', 'marketing']);
    fails := fails + 1; raise warning 'FAIL: an unknown consent purpose was accepted';
  exception when others then passes := passes + 1; end;

  begin
    insert into data_consents (profile_id, purpose, version) values (me, 'adult', consent_version());
    fails := fails + 1; raise warning 'FAIL: consent written directly, around record_consent()';
  exception when others then passes := passes + 1; end;

  perform record_consent(array['special_category', 'adult']);
  perform record_consent(array['special_category', 'adult']);  -- twice is once
  select count(*)::int into n from data_consents where profile_id = me;
  if n = 2 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: expected 2 consent rows, found %', n; end if;
  if has_current_consent() then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: consent given but not reported'; end if;

  update data_consents set given_at = now() - interval '1 year' where profile_id = me;
  delete from data_consents where profile_id = me;
  select count(*)::int into n from data_consents where profile_id = me and given_at > now() - interval '1 day';
  if n = 2 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a consent record was edited or removed'; end if;

  perform set_config('test.uid', other::text, true);
  select count(*)::int into n from data_consents where profile_id = me;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: someone else can read your consent record'; end if;

  -- Arriving needs consent. Other has agreed to the ten but not consented.
  perform accept_universal_law(array['sanctity_of_life','truth_and_transparency','sovereignty_of_the_individual',
    'equity_and_justice','subsidiarity','reciprocity_and_mutual_care','stewardship_of_earth',
    'harmony_of_diversity','right_use_of_power','continuous_evolution']);
  begin
    update profiles set onboarded_at = now() where id = other;
    fails := fails + 1; raise warning 'FAIL: onboarding finished without consent';
  exception when others then passes := passes + 1; end;
  perform record_consent(array['special_category', 'adult']);
  update profiles set onboarded_at = now() where id = other;
  passes := passes + 1;

  ------------------------------------------------------------------ fixture
  perform set_config('test.uid', me::text, true);
  perform accept_universal_law(array['sanctity_of_life','truth_and_transparency','sovereignty_of_the_individual',
    'equity_and_justice','subsidiarity','reciprocity_and_mutual_care','stewardship_of_earth',
    'harmony_of_diversity','right_use_of_power','continuous_evolution']);
  update profiles set display_name = 'Leah Leaving', handle = 'leah', bio = 'Here for now.',
    faith_statement = 'Quaker.', place_local = 'Elm Street', onboarded_at = now() where id = me;
  insert into profile_values (profile_id, name, definition, position) values (me, 'Honesty', 'Say it straight.', 0);
  insert into entries (profile_id, mode, body) values (me, 'journal', 'A private thought about my health.');
  insert into todos (profile_id, body) values (me, 'Water the trees');

  gid := create_group('Rights Test', 'x', 'local');
  code := create_invite(gid, 5, 14);
  perform set_config('test.uid', other::text, true); perform redeem_invite(code);
  insert into follows (follower_id, followed_id) values (other, me);
  insert into feed_mutes (profile_id, muted_id) values (other, me);

  perform set_config('test.uid', me::text, true);
  insert into follows (follower_id, followed_id) values (me, other);
  pid := test_propose(me, gid, 'local', null, 'Fruit trees on the verges', 'x',
                      'The verges are bare and nobody picks anything.');
  perform test_rights_ready(pid, me);
  insert into proposal_reads (proposal_id, profile_id) values (pid, me) on conflict do nothing;
  perform cast_resonance(pid, 0.8, 0.7, 0.4, null);

  ------------------------------------------------------------------ a copy
  doc := my_data_export();
  if doc->'account'->>'email' = 'leaving@example.com' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the copy does not include your email'; end if;
  if jsonb_array_length(doc->'entries.profile_id') = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the copy does not include your journal'; end if;
  if jsonb_array_length(doc->'resonance_votes.profile_id') = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the copy does not include your responses'; end if;
  if jsonb_array_length(doc->'proposals.author_id') = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the copy does not include your proposals'; end if;
  -- Somebody else's private choices about you are theirs.
  if doc ? 'feed_mutes.muted_id' or doc ? 'follows.followed_id' then fails := fails + 1;
    raise warning 'FAIL: the copy reveals who muted or follows you';
  else passes := passes + 1; end if;
  if doc::text ~ 'staying@example.com' then fails := fails + 1;
    raise warning 'FAIL: the copy includes somebody else''s email';
  else passes := passes + 1; end if;

  perform set_config('test.uid', '', true);
  begin
    doc := my_data_export();
    fails := fails + 1; raise warning 'FAIL: a copy was produced for nobody';
  exception when others then passes := passes + 1; end;

  ------------------------------------------------------------------ leaving
  perform set_config('test.uid', me::text, true);
  begin
    perform erase_my_account('yes');
    fails := fails + 1; raise warning 'FAIL: erased without the confirmation words';
  exception when others then passes := passes + 1; end;

  perform erase_my_account('delete my account');

  raise notice ' ';
  raise notice '  Data rights: % passed, % failed', passes, fails;
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;

reset role;

-- After leaving: read as the owner of the database, not as anybody.
do $$
declare
  me    uuid := 'a1919191-9191-9191-9191-91919191919a';
  other uuid := 'b1919191-9191-9191-9191-91919191919b';
  pid uuid; n int; flag boolean; nm text;
  passes int := 0; fails int := 0;
begin
  select id into pid from proposals where title = 'Fruit trees on the verges';
  select count(*)::int into n from auth.users where id = me;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the sign-in account (and its email) survived erasure'; end if;
  select count(*)::int into n from entries where profile_id = me;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the journal survived erasure'; end if;
  select count(*)::int into n from profile_values where profile_id = me;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: values survived erasure'; end if;
  select count(*)::int into n from todos where profile_id = me;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: to-dos survived erasure'; end if;
  select count(*)::int into n from follows where follower_id = me or followed_id = me;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: follows survived erasure'; end if;
  select count(*)::int into n from group_members where profile_id = me;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: still a member of a group after erasure'; end if;

  select display_name into nm from profiles where id = me;
  select (handle is null and bio is null and faith_statement is null and place_local is null and erased_at is not null)
    into flag from profiles where id = me;
  if nm = 'Former member' and flag then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the profile still names somebody (%)', nm; end if;

  select count(*)::int into n from lesson_progress where profile_id = me;
  select n + count(*)::int into n from friendships where lower_id = me or higher_id = me;
  select n + count(*)::int into n from messages where author_id = me;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: learning, a friendship or a message you wrote survived erasure'; end if;
  select count(*)::int into n from messages where author_id = other;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: erasure deleted what the other person wrote to you'; end if;

  -- The collective record stays, unattributed.
  select count(*)::int into n from proposals where id = pid and author_id = me;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: erasure removed a proposal from the record'; end if;
  select count(*)::int into n from resonance_votes where proposal_id = pid;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: erasure removed a response a decision may count'; end if;

  -- Nobody else lost anything.
  select count(*)::int into n from auth.users where id = other;
  select n + count(*)::int into n from group_members where profile_id = other;
  if n = 2 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: erasing one person touched another'; end if;

  -- And a tombstone is not one of the people.
  if not exists (select 1 from profiles where id = me and onboarded_at is not null and erased_at is null)
  then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the pulse still counts an erased person'; end if;

  raise notice '  Data rights (after leaving): % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;

-- THE MAP COVERS EVERYTHING. Every column that points at a profile is
-- classified, so a table added later cannot be silently left out of a copy
-- or silently left behind by an erasure. Add it to private.data_map in the
-- migration that creates it.
do $$
declare missing text; stale text; wrong text;
begin
  select string_agg(c.conrelid::regclass::text || '.' || a.attname, ', ')
    into missing
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
   where c.contype = 'f' and c.confrelid = 'public.profiles'::regclass
     and not exists (select 1 from private.data_map m
                      where m.table_name = c.conrelid::regclass::text and m.column_name = a.attname);
  if missing is not null then
    raise exception 'FAIL: columns pointing at a profile that private.data_map does not classify: %', missing;
  end if;

  select string_agg(m.table_name || '.' || m.column_name, ', ')
    into stale
    from private.data_map m
   where not exists (
     select 1 from pg_constraint c
       join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
      where c.contype = 'f' and c.confrelid = 'public.profiles'::regclass
        and c.conrelid::regclass::text = m.table_name and a.attname = m.column_name);
  if stale is not null then
    raise exception 'FAIL: private.data_map names columns that do not point at a profile: %', stale;
  end if;

  -- What a decision, a ledger or a balance is made of is never deleted.
  select string_agg(table_name || '.' || column_name, ', ') into wrong
    from private.data_map
   where erase = 'delete'
     and table_name in ('proposals', 'resonance_votes', 'decisions', 'deliberation_comments',
                        'ledger_events', 'sov_entries', 'projections', 'commitments',
                        'preferences', 'law_assessments', 'proposal_flags', 'law_acceptances',
                        'data_consents');
  if wrong is not null then
    raise exception 'FAIL: erasure would delete part of the collective record: %', wrong;
  end if;

  -- The profile no longer cascades from the sign-in account.
  if exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass
               and contype = 'f' and confrelid = 'auth.users'::regclass) then
    raise exception 'FAIL: profiles still cascade from auth.users, so erasure would delete decisions';
  end if;

  raise notice '  Data rights (map): 4 passed, 0 failed';
end $$;

drop function test_rights_ready(uuid, uuid);
