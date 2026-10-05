-- A visitor sees totals and nothing else (0037).
\set ON_ERROR_STOP on
\pset pager off

grant usage on schema public to anon;

set role anon;
do $$
declare r record; n int; passes int := 0; fails int := 0;
begin
  select * into r from public_pulse();
  if r.people >= 0 and r.decisions >= 0 and r.projects_done >= 0 and r.businesses >= 0 then
    passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the pulse did not come back for a visitor'; end if;

  -- And nothing else is readable to a visitor.
  begin
    select count(*)::int into n from profiles;
    if n = 0 then passes := passes + 1; else fails := fails + 1;
      raise warning 'FAIL: a visitor can read % profiles', n; end if;
  exception when others then passes := passes + 1; end;

  begin
    select count(*)::int into n from proposals;
    if n = 0 then passes := passes + 1; else fails := fails + 1;
      raise warning 'FAIL: a visitor can read % proposals', n; end if;
  exception when others then passes := passes + 1; end;

  raise notice ' ';
  raise notice '  Public pulse: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;
reset role;

do $$
declare n int;
begin
  -- The only function a visitor may call.
  select count(*)::int into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
     and p.proname = 'public_pulse';
  if n <> 1 then raise exception 'public_pulse is not callable by anon'; end if;
  raise notice '  Public pulse (grant): 1 passed, 0 failed';
end $$;
