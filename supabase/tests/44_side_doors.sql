-- The side doors are shut (0050).
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  passes int := 0; fails int := 0;
  n int; names text;
begin
  -- conditions_epoch is reachable by nobody but the owner and definer code.
  if (select relrowsecurity from pg_class where oid = 'public.conditions_epoch'::regclass) then
    passes := passes + 1;
  else
    fails := fails + 1; raise notice 'FAIL: conditions_epoch has no row-level security';
  end if;

  if not has_table_privilege('anon', 'public.conditions_epoch', 'update')
     and not has_table_privilege('anon', 'public.conditions_epoch', 'delete')
     and not has_table_privilege('authenticated', 'public.conditions_epoch', 'update')
     and not has_table_privilege('authenticated', 'public.conditions_epoch', 'delete') then
    passes := passes + 1;
  else
    fails := fails + 1; raise notice 'FAIL: a signed-out or signed-in caller can move the conditions epoch';
  end if;

  -- Signed-out visitors can run exactly two definer functions.
  select count(*), string_agg(p.proname, ', ' order by p.proname) into n, names
    from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.prosecdef
     and has_function_privilege('anon', p.oid, 'execute')
     and p.proname not in ('public_pulse', 'shared_decision')
     and p.proname not like 'test\_%';  -- scaffolding from 00b, never in a migration
  if n = 0 then
    passes := passes + 1;
  else
    fails := fails + 1; raise notice 'FAIL: signed-out visitors can run %', names;
  end if;

  if has_function_privilege('anon', 'public_pulse()', 'execute')
     and has_function_privilege('anon', 'shared_decision(text)', 'execute') then
    passes := passes + 1;
  else
    fails := fails + 1; raise notice 'FAIL: the public site lost its two functions';
  end if;

  -- Signed-in members kept what they had.
  if has_function_privilege('authenticated', 'cast_resonance(uuid, numeric, numeric, numeric, text)', 'execute')
     or exists (select 1 from pg_proc where proname = 'cast_resonance'
                 and has_function_privilege('authenticated', oid, 'execute')) then
    passes := passes + 1;
  else
    fails := fails + 1; raise notice 'FAIL: signed-in members can no longer respond';
  end if;

  select count(*), string_agg(p.proname, ', ' order by p.proname) into n, names
    from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.prosecdef
     and p.proname in ('share_decision', 'unshare_decision', 'erase_my_account',
                       'my_data_export', 'record_consent', 'send_sov', 'close_proposal')
     and not has_function_privilege('authenticated', p.oid, 'execute');
  if n = 0 then
    passes := passes + 1;
  else
    fails := fails + 1; raise notice 'FAIL: signed-in members lost %', names;
  end if;

  -- No public function has a search_path a caller can change.
  select count(*), string_agg(p.proname, ', ' order by p.proname) into n, names
    from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public'
     and p.prolang <> (select oid from pg_language where lanname = 'c')
     and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
     and p.proname not like 'test\_%'
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');
  if n = 0 then
    passes := passes + 1;
  else
    fails := fails + 1; raise notice 'FAIL: no fixed search_path on %', names;
  end if;

  raise notice ' ';
  raise notice '  Side doors: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;

reset role;
