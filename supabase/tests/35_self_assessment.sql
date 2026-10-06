-- Know yourself is yours alone and reaches nothing collective (0041, rule 39).
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
  ('a1515151-5151-5151-5151-51515151515a', 'self-me@example.com'),
  ('b1515151-5151-5151-5151-51515151515b', 'self-other@example.com');

set role app;

do $$
declare
  me uuid := 'a1515151-5151-5151-5151-51515151515a';
  other uuid := 'b1515151-5151-5151-5151-51515151515b';
  needs jsonb := '{"certainty":0.6,"variety":0.4,"significance":0.7,"connection":0.8,"growth":0.9,"contribution":0.75}';
  id1 uuid; n int;
  passes int := 0; fails int := 0;
begin
  perform set_config('test.uid', me::text, true);
  insert into self_assessments (needs, values_toward, values_away, goals)
  values (needs, '["Growth","Family","Freedom"]', '["Failure","Loneliness"]',
          '[{"result":"Run a half marathon","purpose":"Prove to myself I finish things","actions":["Book the race"]}]')
  returning id into id1;
  passes := passes + 1;

  -- Malformed needs are refused.
  begin
    insert into self_assessments (needs, values_toward, values_away) values ('{"growth":1}', '["Growth"]', '[]');
    fails := fails + 1; raise warning 'FAIL: an assessment missing needs was accepted';
  exception when others then passes := passes + 1; end;

  -- The focus is written once, then fixed; the answers never change.
  update self_assessments set focus = 'Focus on connection.' where id = id1;
  update self_assessments set focus = 'Rewritten later.' where id = id1;
  if (select focus from self_assessments where id = id1) = 'Focus on connection.' then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: the focus was rewritten'; end if;
  begin
    update self_assessments set values_toward = '["Money"]' where id = id1;
    if (select values_toward from self_assessments where id = id1) = '["Growth","Family","Freedom"]'::jsonb then
      passes := passes + 1; else fails := fails + 1; raise warning 'FAIL: answers were edited'; end if;
  exception when others then passes := passes + 1; end;

  -- Nobody else sees it, or writes one in your name.
  perform set_config('test.uid', other::text, true);
  select count(*)::int into n from self_assessments where profile_id = me;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: someone else can read an assessment'; end if;
  begin
    insert into self_assessments (profile_id, needs, values_toward, values_away) values (me, needs, '["X"]', '[]');
    fails := fails + 1; raise warning 'FAIL: an assessment was written in someone else''s name';
  exception when others then passes := passes + 1; end;

  raise notice ' ';
  raise notice '  Know yourself: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;

reset role;

do $$
declare n int;
begin
  -- Nothing collective reads it.
  select count(*)::int into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.prosrc ilike '%self_assessments%'
     and p.proname <> 'freeze_self_assessment';
  if n <> 0 then raise exception 'FAIL: % function(s) read self_assessments', n; end if;
  raise notice '  Know yourself (absences): 1 passed, 0 failed';
end $$;
