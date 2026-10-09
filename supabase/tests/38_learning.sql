-- Learn is yours alone, gates nothing and earns nothing (0044, rule 41).
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
  ('a1818181-8181-8181-8181-81818181818a', 'learn-me@example.com'),
  ('b1818181-8181-8181-8181-81818181818b', 'learn-other@example.com');

set role app;

do $$
declare
  me uuid := 'a1818181-8181-8181-8181-81818181818a';
  other uuid := 'b1818181-8181-8181-8181-81818181818b';
  n int;
  passes int := 0; fails int := 0;
begin
  perform set_config('test.uid', me::text, true);
  insert into lesson_progress (lesson_id, completed_at, reflection)
  values ('law-truth', now(), 'I hold back bad news at work. That is the thing to change.');
  passes := passes + 1;

  update lesson_progress set reflection = 'Rewritten, because it is a note.' where lesson_id = 'law-truth';
  if (select reflection from lesson_progress where lesson_id = 'law-truth') like 'Rewritten%' then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: could not edit your own note'; end if;

  begin
    insert into lesson_progress (lesson_id) values ('Not An Id; drop table');
    fails := fails + 1; raise warning 'FAIL: a malformed lesson id was accepted';
  exception when others then passes := passes + 1; end;
  begin
    insert into lesson_progress (lesson_id, reflection) values ('long', repeat('x', 2001));
    fails := fails + 1; raise warning 'FAIL: an over-long note was accepted';
  exception when others then passes := passes + 1; end;

  perform set_config('test.uid', other::text, true);
  select count(*)::int into n from lesson_progress where profile_id = me;
  if n = 0 then passes := passes + 1; else fails := fails + 1; raise warning 'FAIL: someone else can read your learning'; end if;
  begin
    insert into lesson_progress (profile_id, lesson_id) values (me, 'law-life');
    fails := fails + 1; raise warning 'FAIL: wrote learning in someone else''s name';
  exception when others then passes := passes + 1; end;
  update lesson_progress set reflection = 'tampered' where profile_id = me;
  delete from lesson_progress where profile_id = me;
  perform set_config('test.uid', me::text, true);
  if (select reflection from lesson_progress where lesson_id = 'law-truth') like 'Rewritten%' then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: someone else changed or removed your learning'; end if;

  raise notice ' ';
  raise notice '  Learn: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;

reset role;

do $$
declare n int; names text;
begin
  -- Gates nothing and earns nothing: no function reads it — not a decision,
  -- not a reach check, not the SOV mint.
  select count(*)::int, string_agg(p.proname, ', ') into n, names
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.prosrc ~* 'lesson_progress';
  if n <> 0 then raise exception 'FAIL: % function(s) read learning: %', n, names; end if;
  raise notice '  Learn (absences): 1 passed, 0 failed';
end $$;
