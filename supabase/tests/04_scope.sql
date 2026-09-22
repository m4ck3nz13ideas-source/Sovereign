-- Scope: a proposal addressed to a place, and who that makes eligible.
--
-- Run after 0006_scope.sql. Everything here runs as a non-superuser, so the
-- row-level policies actually apply — a test that passes as the owner proves
-- nothing about what a member can see.
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
  ('e0000000-0000-0000-0000-00000000000e', 'eve@example.com'),
  ('f0000000-0000-0000-0000-00000000000f', 'finn@example.com'),
  ('40000000-0000-0000-0000-000000000004', 'gus@example.com');

set role app;

do $$
declare
  eve  uuid := 'e0000000-0000-0000-0000-00000000000e';
  finn uuid := 'f0000000-0000-0000-0000-00000000000f';
  gus  uuid := '40000000-0000-0000-0000-000000000004';
  hackney_pid uuid; global_pid uuid; regional_pid uuid; group_pid uuid;
  totnes_pid uuid; next_pid uuid;
  rid uuid; gid uuid; projid uuid;
  msg text; n int; ok_flag boolean; outcome decision_outcome;
  members int; chain_ok boolean;
  passes int := 0; fails int := 0;
  all_laws text[] := array[
    'sanctity_of_life','truth_and_transparency','sovereignty_of_the_individual',
    'equity_and_justice','subsidiarity','reciprocity_and_mutual_care',
    'stewardship_of_earth','harmony_of_diversity','right_use_of_power',
    'continuous_evolution'];
  l text;
  seed text := 'The alley is used as a cut-through and it is not safe.';
begin
  ------------------------------------------------------------------ where they are
  perform set_config('test.uid', eve::text, true);
  update profiles set place_local = 'Hackney', place_regional = 'London',
                      place_national = 'United Kingdom', place_continental = 'Europe',
                      place_set_at = now()
   where id = eve;

  -- Finn writes it differently. Matching is on a normalised key, so it is the
  -- same street either way.
  perform set_config('test.uid', finn::text, true);
  update profiles set place_local = '  hackney  ', place_regional = 'London',
                      place_national = 'United Kingdom', place_continental = 'Europe',
                      place_set_at = now()
   where id = finn;

  perform set_config('test.uid', gus::text, true);
  update profiles set place_local = 'Totnes', place_regional = 'Devon',
                      place_national = 'United Kingdom', place_continental = 'Europe',
                      place_set_at = now()
   where id = gus;

  ------------------------------------------------- a proposal with no group at all
  perform set_config('test.uid', eve::text, true);
  hackney_pid := test_propose(eve, null, 'local', 'Hackney',
                              'Close the alley to through traffic',
                              'Bollards at the north end.', seed);

  if hackney_pid is not null then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: could not propose without belonging to a group'; end if;

  ---------------------------------------------------------- the neighbour sees it
  perform set_config('test.uid', finn::text, true);
  select count(*) into n from proposals where id = hackney_pid;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a neighbour writing the place differently saw % of it', n; end if;

  ------------------------------------------------- somewhere else does not see it
  perform set_config('test.uid', gus::text, true);
  select count(*) into n from proposals where id = hackney_pid;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: someone in Totnes could read a Hackney proposal'; end if;

  ----------------------------------------- and cannot respond to it either
  begin
    perform cast_resonance(hackney_pid, 0.9, 0.9, 0.9, null);
    fails := fails + 1;
    raise warning 'FAIL: someone outside the place recorded resonance';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%not addressed to you%' then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: wrong error resonating out of scope: %', msg; end if;
  end;

  -------------------------------------- you cannot propose for somewhere you are not
  -- Written out rather than going through test_propose(), because the point
  -- is the refusal. The readiness row is real so that the gate it trips is the
  -- place policy and not the sharpening one — the triggers run first.
  begin
    insert into proposal_readiness (author_id, body_sha256, readiness, verdict,
                                    prompt_id, prompt_version, model)
    values (gus, proposal_body_hash('From Devon, for Hackney.'), 0.900,
            'Sharpened in a test.', 'proposal.sharpen', '1.0.0', 'test');

    insert into proposals (author_id, title, summary, body,
                           intent, change, constraints, risks, alternatives,
                           scope, place)
    values (gus, 'Something for Hackney', 'From Devon.', 'From Devon, for Hackney.',
            'A problem stated at sufficient length to clear the section constraint here.',
            'A change stated at sufficient length to clear the section constraint here.',
            'It takes 4 hours and £40, and depends on nobody.',
            'It might not work, and three months of nothing would say so clearly.',
            'Doing nothing was considered and rejected.',
            'local', 'Hackney');
    fails := fails + 1;
    raise warning 'FAIL: a proposal was addressed to a place the author is not in';
  exception when insufficient_privilege then
    passes := passes + 1;
  end;

  ------------------------------------------------------- global reaches everyone
  perform set_config('test.uid', eve::text, true);
  global_pid := test_propose(eve, null, 'global', null,
                             'Publish the model card',
                             'For anything that scores a proposal.', seed);

  perform set_config('test.uid', gus::text, true);
  select count(*) into n from proposals where id = global_pid;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a global proposal did not reach someone elsewhere'; end if;

  ------------------------------------------------ a group proposal stays the group's
  perform set_config('test.uid', eve::text, true);
  gid := create_group('The Thursday Session', 'x', 'local');
  group_pid := test_propose(eve, gid, 'local', 'Hackney', 'Buy a second urn',
                            'Sixty pounds.', seed);

  perform set_config('test.uid', finn::text, true);
  select count(*) into n from proposals where id = group_pid;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a neighbour read a group proposal without being in the group'; end if;

  ------------------------------------------ the address cannot be moved afterwards
  perform set_config('test.uid', eve::text, true);
  begin
    update proposals set place = 'Totnes' where id = hackney_pid;
    fails := fails + 1;
    raise warning 'FAIL: the author re-aimed a submitted proposal';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%fixed at submission%' then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: wrong error re-aiming: %', msg; end if;
  end;

  --------------------------------------------- no register, so no participation
  insert into proposal_reviews (proposal_id, prompt_id, prompt_version, model, summary)
  values (hackney_pid, 'proposal.review', '1.2.0', 'test', 'A reading.') returning id into rid;

  select member_count into members from resonance_summary(hackney_pid);
  if members is null then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a place proposal invented a membership of %', members; end if;

  ------------------------------------------- Universal Law still comes first
  update proposals set status = 'in_deliberation' where id = hackney_pid;
  begin
    perform close_proposal(hackney_pid);
    fails := fails + 1;
    raise warning 'FAIL: an unaudited place proposal was closed';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%Universal Law%' then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: wrong error closing unaudited: %', msg; end if;
  end;

  foreach l in array all_laws loop
    insert into law_assessments (proposal_id, review_id, law_id, verdict, reasoning,
                                 prompt_id, prompt_version, model)
    values (hackney_pid, rid, l, 'aligned', 'clear', 'law.audit', '1.0.0', 'test');
  end loop;

  ------------------------------------------------------ one voice, at local scale
  insert into proposal_reads (proposal_id, profile_id) values (hackney_pid, eve);
  perform cast_resonance(hackney_pid, 0.91, 0.80, 0.70, 'The alley is the problem.');

  outcome := close_proposal(hackney_pid);
  if outcome = 'passed' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a local proposal above threshold did not pass, got %', outcome; end if;

  select participation is null into ok_flag from decisions where proposal_id = hackney_pid;
  if ok_flag then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a place decision recorded a participation share'; end if;

  ------------------------------------------- ratification is still not activation
  select id into projid from projects where proposal_id = hackney_pid;
  if projid is null then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: passing created a project before activation'; end if;

  projid := activate_proposal(hackney_pid);
  if projid is not null then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a place proposal needing nothing did not activate'; end if;

  perform set_config('test.uid', gus::text, true);
  select count(*) into n from projects where id = projid;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a project inherited no address — Totnes could read it'; end if;

  ------------------------------------------ the window holds above local scale
  perform set_config('test.uid', eve::text, true);
  regional_pid := test_propose(eve, null, 'regional', 'London',
                               'One transport card across London',
                               'Across all operators.', seed);

  insert into proposal_reviews (proposal_id, prompt_id, prompt_version, model, summary)
  values (regional_pid, 'proposal.review', '1.2.0', 'test', 'A reading.') returning id into rid;
  foreach l in array all_laws loop
    insert into law_assessments (proposal_id, review_id, law_id, verdict, reasoning,
                                 prompt_id, prompt_version, model)
    values (regional_pid, rid, l, 'aligned', 'clear', 'law.audit', '1.0.0', 'test');
  end loop;
  update proposals set status = 'in_deliberation' where id = regional_pid;

  begin
    perform close_proposal(regional_pid);
    fails := fails + 1;
    raise warning 'FAIL: a regional proposal was closed inside its deliberation window';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%deliberation is open until%' then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: wrong error closing early: %', msg; end if;
  end;

  ----------------------------------------- retrieval follows the address, not the author
  next_pid := test_propose(eve, null, 'local', 'Hackney', 'Plant the verge',
                           'Along the same alley.', seed || ' verge');

  select count(*) into n from related_decisions_for(next_pid, array['x'], 6);
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: Hackney retrieval found % past decisions, expected 1', n; end if;

  perform set_config('test.uid', gus::text, true);
  totnes_pid := test_propose(gus, null, 'local', 'Totnes', 'Repaint the crossing',
                             'By the school.', seed || ' crossing');

  select count(*) into n from related_decisions_for(totnes_pid, array['x'], 6);
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: Totnes retrieved % of Hackney''s decisions', n; end if;

  ------------------------------------------------------- the public chain holds
  select ok into chain_ok from verify_ledger(null);
  if chain_ok then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the public ledger chain does not verify'; end if;

  raise notice ' ';
  raise notice '  Scope: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then
    raise exception '% checks failed', fails;
  end if;
end $$;

reset role;
