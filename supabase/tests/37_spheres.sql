-- Spheres describe, never decide (0043, rule 40).
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

-- Responses here are scenery for "fixed once anybody responds", not a test of
-- conditions, so the pre-0042 harness setting applies.
update conditions_epoch set since = 'infinity';

insert into auth.users (id, email) values
  ('a1717171-7171-7171-7171-71717171717a', 'sphere-author@example.com'),
  ('b1717171-7171-7171-7171-71717171717b', 'sphere-other@example.com');

set role app;

do $$
declare
  a uuid := 'a1717171-7171-7171-7171-71717171717a';
  b uuid := 'b1717171-7171-7171-7171-71717171717b';
  gid uuid; code text; p uuid; n int; rid uuid; l text;
  passes int := 0; fails int := 0;
begin
  perform set_config('test.uid', a::text, true);
  gid := create_group('Sphere Test', 'x', 'local');
  code := create_invite(gid, 5, 14);
  perform set_config('test.uid', b::text, true); perform redeem_invite(code);

  -- The list is there, and nobody can change it.
  select count(*)::int into n from spheres;
  if n = 8 then passes := passes + 1; else fails := fails + 1; raise warning 'FAIL: % spheres, not 8', n; end if;
  begin
    insert into spheres (id, ordinal, name, description) values ('defence', 9, 'Defence', 'x');
    fails := fails + 1; raise warning 'FAIL: a member added a Sphere';
  exception when others then passes := passes + 1; end;
  update spheres set name = 'Wealth' where id = 'health';
  if (select name from spheres where id = 'health') = 'Health' then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: a member renamed a Sphere'; end if;

  perform set_config('test.uid', a::text, true);
  p := test_propose(a, gid, 'local', null, 'Heat pump for the hall', 'x', 'Replace the hall boiler with a heat pump.');

  -- Tagging: main, area, others.
  update proposals set sphere = 'infrastructure', sphere_area = 'infrastructure.spaces',
                       spheres_also = '{ecology,economy}' where id = p;
  if (select sphere from proposals where id = p) = 'infrastructure' then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: the author could not tag'; end if;

  -- The shape is enforced.
  begin
    update proposals set sphere_area = 'health.mental_health' where id = p;
    fails := fails + 1; raise warning 'FAIL: an area from another Sphere was accepted';
  exception when others then passes := passes + 1; end;
  begin
    update proposals set spheres_also = '{ecology,economy,tech}' where id = p;
    fails := fails + 1; raise warning 'FAIL: four Spheres on one proposal';
  exception when others then passes := passes + 1; end;
  begin
    update proposals set spheres_also = '{infrastructure}' where id = p;
    fails := fails + 1; raise warning 'FAIL: the main Sphere repeated as another';
  exception when others then passes := passes + 1; end;
  begin
    update proposals set spheres_also = '{ecology,ecology}' where id = p;
    fails := fails + 1; raise warning 'FAIL: the same Sphere twice';
  exception when others then passes := passes + 1; end;
  begin
    update proposals set spheres_also = '{defence}' where id = p;
    fails := fails + 1; raise warning 'FAIL: a Sphere that does not exist';
  exception when others then passes := passes + 1; end;
  begin
    update proposals set sphere = null where id = p;
    fails := fails + 1; raise warning 'FAIL: other Spheres with no main one';
  exception when others then passes := passes + 1; end;

  -- Only the author re-tags.
  perform set_config('test.uid', b::text, true);
  update proposals set sphere = 'health', sphere_area = null where id = p;
  if (select sphere from proposals where id = p) = 'infrastructure' then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: someone else re-tagged a proposal'; end if;

  -- Re-tag before anybody responds: fine.
  perform set_config('test.uid', a::text, true);
  update proposals set sphere_area = 'infrastructure.utilities' where id = p;
  if (select sphere_area from proposals where id = p) = 'infrastructure.utilities' then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: the author could not re-tag before responses'; end if;

  -- Once anybody responds it is fixed.
  insert into proposal_reviews (proposal_id, prompt_id, prompt_version, model, summary)
  values (p, 'proposal.review', '1.2.0', 'test', 'A reading.') returning id into rid;
  foreach l in array array['sanctity_of_life','truth_and_transparency','sovereignty_of_the_individual',
    'equity_and_justice','subsidiarity','reciprocity_and_mutual_care','stewardship_of_earth',
    'harmony_of_diversity','right_use_of_power','continuous_evolution'] loop
    insert into law_assessments (proposal_id, review_id, law_id, verdict, reasoning, prompt_id, prompt_version, model)
    values (p, rid, l, 'aligned', 'clear', 'law.audit', '1.0.0', 'test');
  end loop;
  update proposals set status = 'in_deliberation' where id = p;
  perform set_config('test.uid', b::text, true);
  insert into proposal_reads (proposal_id, profile_id) values (p, b) on conflict do nothing;
  perform cast_resonance(p, 0.9, 0.9, 0.9, null);

  perform set_config('test.uid', a::text, true);
  -- Refused by the trigger, or not reachable by the policy once voting has
  -- begun; either way it does not move.
  begin
    update proposals set sphere = 'ecology', sphere_area = null, spheres_also = '{infrastructure}' where id = p;
  exception when others then null; end;
  if (select sphere from proposals where id = p) = 'infrastructure' then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: re-tagged after people responded'; end if;
  -- And the trigger refuses on its own, not only because the policy stops
  -- at 'voting': put the status back where the policy would allow an edit.
  perform test_set_status(p, 'in_deliberation');
  begin
    update proposals set sphere_area = null where id = p;
    fails := fails + 1; raise warning 'FAIL: the trigger let a re-tag through after a response';
  exception when others then passes := passes + 1; end;

  -- Following is yours alone.
  insert into sphere_follows (sphere_id) values ('health'), ('ecology');
  select count(*)::int into n from sphere_follows;
  if n = 2 then passes := passes + 1; else fails := fails + 1; raise warning 'FAIL: could not follow'; end if;
  perform set_config('test.uid', b::text, true);
  select count(*)::int into n from sphere_follows where profile_id = a;
  if n = 0 then passes := passes + 1; else fails := fails + 1; raise warning 'FAIL: someone else can see who follows what'; end if;
  begin
    insert into sphere_follows (profile_id, sphere_id) values (a, 'justice');
    fails := fails + 1; raise warning 'FAIL: followed a Sphere in someone else''s name';
  exception when others then passes := passes + 1; end;
  delete from sphere_follows where profile_id = a;
  perform set_config('test.uid', a::text, true);
  select count(*)::int into n from sphere_follows;
  if n = 2 then passes := passes + 1; else fails := fails + 1; raise warning 'FAIL: someone else removed a follow'; end if;

  raise notice ' ';
  raise notice '  Spheres: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;

reset role;

do $$
declare n int; names text;
begin
  -- A Sphere informs; it never decides. Nothing outside 0043 reads one.
  select count(*)::int, string_agg(p.proname, ', ') into n, names
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.prosrc ~* 'sphere'
     and p.proname <> 'check_proposal_spheres';
  if n <> 0 then raise exception 'FAIL: % function(s) read a Sphere: %', n, names; end if;

  -- Nobody can count followers: no function, no view.
  select count(*)::int into n from pg_views where schemaname = 'public' and definition ~* 'sphere_follows';
  if n <> 0 then raise exception 'FAIL: a view exposes sphere follows'; end if;
  raise notice '  Spheres (absences): 2 passed, 0 failed';
end $$;
