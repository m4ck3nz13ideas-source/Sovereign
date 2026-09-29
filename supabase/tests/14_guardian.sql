-- The guardian: private, owner-only, reaching nothing, storing no model of
-- anybody — and forgettable, which almost nothing else here is.
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

insert into auth.users (id, email) values
  ('f1000001-0000-0000-0000-000000000000', 'guard1@example.com'),
  ('f1000002-0000-0000-0000-000000000000', 'guard2@example.com');

set role app;

do $$
declare
  ann uuid := 'f1000001-0000-0000-0000-000000000000';
  ben uuid := 'f1000002-0000-0000-0000-000000000000';
  pid uuid; nid uuid; n int; msg text;
  passes int := 0; fails int := 0;
begin
  perform set_config('test.uid', ann::text, true);
  update profiles set place_local = 'Chapel Row', place_national = 'United Kingdom',
                      place_set_at = now()
   where id = ann;
  insert into profile_values (profile_id, name, definition, position)
  values (ann, 'Reciprocity', 'What is taken is replenished.', 0),
         (ann, 'Plain speech', 'Say the cost out loud.', 1);

  perform set_config('test.uid', ben::text, true);
  update profiles set place_local = 'Chapel Row', place_national = 'United Kingdom',
                      place_set_at = now()
   where id = ben;
  insert into profile_values (profile_id, name, definition, position)
  values (ben, 'Something else', 'Bens own words.', 0);

  perform set_config('test.uid', ann::text, true);

  ------------------------------------ it is given your words, and only yours
  select count(*)::int into n from guardian_context();
  if n = 2 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the guardian context has % values, expected 2', n; end if;

  select value_name into msg from guardian_context() order by value_name limit 1;
  if msg = 'Plain speech' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the context is not this person''s own values (%)', msg; end if;

  perform set_config('test.uid', ben::text, true);
  select count(*)::int into n from guardian_context();
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: one person''s guardian saw % values, expected only their own', n;
  end if;
  perform set_config('test.uid', ann::text, true);

  ------------------------------------------------------- a note of your own
  pid := test_propose(ann, null, 'local', 'Chapel Row',
                      'Share the ladder', 'One ladder between six houses.',
                      'Everyone on the row owns a ladder and uses it twice a year.');

  insert into guardian_notes (profile_id, kind, proposal_id, questions, gaps, reading,
                              prompt_id, prompt_version, model)
  values (ann, 'prepare', pid,
          '["Who stores it, and what happens when they move?"]'::jsonb,
          '[{"value":"Reciprocity","note":"Nothing says what the person storing it gets."}]'::jsonb,
          'This is about who carries an inconvenience on everybody else''s behalf.',
          'guardian.prepare', '1.0.0', 'test')
  returning id into nid;

  select count(*)::int into n from my_guardian_notes(30);
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: expected 1 note, got %', n; end if;

  ------------------------------------------- nobody else can read it, ever
  perform set_config('test.uid', ben::text, true);
  select count(*)::int into n from guardian_notes;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: another member read % of somebody''s guardian notes', n; end if;

  select count(*)::int into n from my_guardian_notes(30);
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: my_guardian_notes leaked somebody else''s'; end if;

  ------------------------------------------ nor write one in somebody's name
  begin
    insert into guardian_notes (profile_id, kind, proposal_id, reading,
                                prompt_id, prompt_version, model)
    values (ann, 'prepare', pid, 'Something Ben wants Ann to think.',
            'guardian.prepare', '1.0.0', 'test');
    select count(*)::int into n from guardian_notes where profile_id = ann;
    if n = 0 then passes := passes + 1; else fails := fails + 1;
      raise warning 'FAIL: one person wrote a guardian note in another''s name'; end if;
  exception when others then passes := passes + 1;
  end;

  ------------------------------------------ nor delete somebody else's
  perform forget_guardian_notes();
  perform set_config('test.uid', ann::text, true);
  select count(*)::int into n from my_guardian_notes(30);
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: one person forgot another person''s notes'; end if;

  ---------------------------------- it reaches no proposal and no decision
  select count(*)::int into n from ledger_events where kind like 'guardian%';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % guardian events reached the public ledger', n; end if;

  select count(*)::int into n
    from information_schema.columns
   where table_name = 'proposals' and column_name like 'guardian%';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the guardian grew % columns on proposals', n; end if;

  ------------------------------- and it holds no verdict, score or model of you
  select count(*)::int into n
    from information_schema.columns
   where table_name = 'guardian_notes'
     and column_name in ('verdict', 'score', 'recommendation', 'alignment',
                         'profile_model', 'inferred_values', 'sentiment');
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: guardian_notes grew % columns that make it a handler', n; end if;

  ------------------------------------------------------ forgetting is real
  perform forget_guardian_notes();
  select count(*)::int into n from my_guardian_notes(30);
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: forgetting left % notes behind', n; end if;

  raise notice ' ';
  raise notice '  Guardian: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then
    raise exception '% checks failed', fails;
  end if;
end $$;

reset role;
