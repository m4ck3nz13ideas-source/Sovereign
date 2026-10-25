-- Internal helpers are not part of the API (0060).
-- Supabase grants every new function to `authenticated` directly, so a
-- `revoke ... from public` alone leaves it callable by every signed-in user.
-- These are reached only from inside security definer functions.
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  f text; passes int := 0; fails int := 0;
begin
  foreach f in array array['place_at(uuid,text)', 'vendor_document(uuid)', 'vendor_law_fit(uuid)',
                           'my_values_query()', 'law_audit_payload(text,text,text)',
                           'law_insert_readings(uuid,jsonb,uuid)'] loop
    if has_function_privilege('authenticated', f::regprocedure, 'execute')
       or has_function_privilege('anon', f::regprocedure, 'execute') then
      fails := fails + 1; raise warning 'FAIL: % is callable through the API', f;
    else passes := passes + 1; end if;
  end loop;

  -- And what is meant to be callable, is.
  foreach f in array array['alignment_shape(uuid)', 'verified_voice_count(uuid)', 'release_problem(uuid)'] loop
    if has_function_privilege('authenticated', f::regprocedure, 'execute') then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: % is not callable by members', f; end if;
  end loop;

  raise notice ' ';
  raise notice '  Internal helpers: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;

-- The leak itself: a member asking for somebody else's place.
insert into auth.users (id, email) values
  ('a5252525-2525-2525-2525-25252525252a', 'helpers-ann@example.com'),
  ('b5252525-2525-2525-2525-25252525252b', 'helpers-ben@example.com');
update profiles set place_local = 'Helper Street' where id = 'a5252525-2525-2525-2525-25252525252a';

set role authenticated;
do $$
begin
  perform set_config('test.uid', 'b5252525-2525-2525-2525-25252525252b', true);
  begin
    perform place_at('a5252525-2525-2525-2525-25252525252a', 'local');
    raise exception 'FAIL: a member read another member''s place through place_at()';
  exception when insufficient_privilege then
    raise notice '  Internal helpers (the leak): 1 passed, 0 failed';
  end;
end $$;
reset role;
