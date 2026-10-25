-- The founder's dashboard (0058).
--   * only a founder can read it, and nobody can make themselves one;
--   * it returns counts and nothing that names or identifies a person;
--   * its source reads no rating, no Know yourself and no ballot's numbers.
\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('a5151515-1515-1515-1515-15151515151a', 'pulse-founder@example.com'),
  ('b5151515-1515-1515-1515-15151515151b', 'pulse-member@example.com');

insert into founders (profile_id) values ('a5151515-1515-1515-1515-15151515151a');

set role authenticated;
do $$
declare
  f uuid := 'a5151515-1515-1515-1515-15151515151a';
  m uuid := 'b5151515-1515-1515-1515-15151515151b';
  j jsonb; src text;
  passes int := 0; fails int := 0;
begin
  perform set_config('test.uid', m::text, true);
  begin
    j := founder_pulse();
    fails := fails + 1; raise warning 'FAIL: a member who is not a founder read the founder dashboard';
  exception when others then passes := passes + 1; end;
  begin
    insert into founders (profile_id) values (m);
    fails := fails + 1; raise warning 'FAIL: a member made themselves a founder';
  exception when others then passes := passes + 1; end;
  if not is_founder() then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: is_founder() is true for a member'; end if;

  perform set_config('test.uid', f::text, true);
  j := founder_pulse();
  if (j->'funnel'->>'signed_up')::int >= 2 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the funnel did not count sign-ups'; end if;

  -- Nothing in it names or identifies anybody.
  if j::text !~* '(display_name|handle|email|profile_id|"id"|@)' then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: the founder dashboard carries something that identifies a person'; end if;

  select pg_get_functiondef('public.founder_pulse()'::regprocedure) into src;
  if src !~* '(sphere_priorities|self_assessments|lesson_progress|alignment\s*,|avg\(|confidence|urgency|\.note\b|\mbody\M)' then
    passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: founder_pulse() reads a rating, a self-assessment, a ballot''s numbers or someone''s words'; end if;

  if not has_function_privilege('anon', 'founder_pulse()', 'execute') then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: signed-out visitors can run founder_pulse()'; end if;

  raise notice ' ';
  raise notice '  Founder pulse: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;
reset role;

delete from founders;
