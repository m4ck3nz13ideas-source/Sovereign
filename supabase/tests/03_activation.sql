-- Activate: a ratified proposal becomes real only when its needs are met.
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
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'actann@example.com'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'actben@example.com');

set role app;

do $$
declare
  ann uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  ben uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  gid uuid; pid uuid; rid uuid; code text;
  money_need uuid; people_need uuid; cid uuid; projid uuid;
  msg text; n int; ok_flag boolean; outcome decision_outcome;
  passes int := 0; fails int := 0;
  all_laws text[] := array[
    'sanctity_of_life','truth_and_transparency','sovereignty_of_the_individual',
    'equity_and_justice','subsidiarity','reciprocity_and_mutual_care',
    'stewardship_of_earth','harmony_of_diversity','right_use_of_power',
    'continuous_evolution'];
  l text;
begin
  perform set_config('test.uid', ann::text, true);
  gid := create_group('Activation Test', 'x', 'local');
  code := create_invite(gid, 5, 14);
  perform set_config('test.uid', ben::text, true);
  perform redeem_invite(code);
  perform set_config('test.uid', ann::text, true);

  -- A proposal that gets all the way through the vote.
  pid := test_propose(ann, gid, 'local', null, 'Rent the room', 'Six weeks.',
                      'The hall is double-booked most Thursdays.', 240);

  insert into proposal_reviews (proposal_id, prompt_id, prompt_version, model, summary)
  values (pid, 'proposal.review', '1.2.0', 'test', 'A reading.') returning id into rid;

  foreach l in array all_laws loop
    insert into law_assessments (proposal_id, review_id, law_id, verdict, reasoning,
                                 prompt_id, prompt_version, model)
    values (pid, rid, l, 'aligned', 'clear', 'law.audit', '1.0.0', 'test');
  end loop;

  update proposals set status = 'in_deliberation' where id = pid;

  -- What it needs to be real.
  insert into proposal_needs (proposal_id, kind, description, quantity, unit, created_by)
  values (pid, 'money', 'Six weeks of room hire, up front', 240, 'GBP', ann)
  returning id into money_need;
  insert into proposal_needs (proposal_id, kind, description, quantity, unit, created_by)
  values (pid, 'time', 'Someone to open up each week', 6, 'weeks', ann)
  returning id into people_need;

  insert into proposal_reads (proposal_id, profile_id) values (pid, ann);
  perform cast_resonance(pid, 0.90, 0.90, 0.90, null);
  perform set_config('test.uid', ben::text, true);
  insert into proposal_reads (proposal_id, profile_id) values (pid, ben);
  perform cast_resonance(pid, 0.80, 0.80, 0.80, null);
  perform set_config('test.uid', ann::text, true);

  outcome := close_proposal(pid);
  if outcome = 'passed' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: lawful, well-resonated proposal did not pass'; end if;

  ------------------------------ passing no longer creates a project by itself
  select count(*)::int into n from projects where proposal_id = pid;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a project was created on passing, before any resources existed'; end if;

  select status::text into msg from proposals where id = pid;
  if msg = 'passed' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: expected status passed, got %', msg; end if;

  ------------------------------------- with nothing pledged, it is not ready
  select ready, needs_total, needs_met into ok_flag, n, n from activation_standing(pid);
  select ready into ok_flag from activation_standing(pid);
  if not ok_flag then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: ready with nothing pledged'; end if;

  begin
    perform activate_proposal(pid);
    fails := fails + 1;
    raise warning 'FAIL: activated with nothing pledged';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%nobody has committed%' then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: wrong error activating empty: %', msg; end if;
  end;

  ------------------------------------------------- partial money is not ready
  insert into commitments (need_id, proposal_id, profile_id, quantity, note)
  values (money_need, pid, ann, 100, 'what I can do')
  returning id into cid;

  select ready into ok_flag from activation_standing(pid);
  if not ok_flag then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: ready on a part-funded need'; end if;

  select needs_met into n from activation_standing(pid);
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a part-funded need counted as met (%)', n; end if;

  --------------------------------------- money covered, people still missing
  perform set_config('test.uid', ben::text, true);
  insert into commitments (need_id, proposal_id, profile_id, quantity, note)
  values (money_need, pid, ben, 140, 'the rest');
  perform set_config('test.uid', ann::text, true);

  select needs_met, ready into n, ok_flag from activation_standing(pid);
  if n = 1 and not ok_flag then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: money met should be 1 need and not ready (met %, ready %)', n, ok_flag; end if;

  begin
    perform activate_proposal(pid);
    fails := fails + 1;
    raise warning 'FAIL: activated with the people need unmet';
  exception when others then passes := passes + 1;
  end;

  ------------------------------------------------- everything met, activates
  insert into commitments (need_id, proposal_id, profile_id, quantity, note)
  values (people_need, pid, ann, 6, 'I will open up');

  select needs_met, ready into n, ok_flag from activation_standing(pid);
  if n = 2 and ok_flag then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: all needs met but not ready (met %, ready %)', n, ok_flag; end if;

  projid := activate_proposal(pid);
  if projid is not null then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: activation returned no project'; end if;

  select status::text into msg from proposals where id = pid;
  if msg = 'executing' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: expected executing after activation, got %', msg; end if;

  ------------------------- the budget is what people actually pledged, not asked
  select budget_committed into n from projects where id = projid;
  if n = 240 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: committed budget is % rather than the 240 pledged', n; end if;

  ----------------------------------------- withdrawing takes it below ready
  pid := test_propose(ann, gid, 'local', null, 'Second', 'x',
                      'There is one socket and four things to plug in.');
  insert into proposal_needs (proposal_id, kind, description, quantity, unit, created_by)
  values (pid, 'skill', 'Someone who can wire a socket', 1, 'person', ann)
  returning id into people_need;
  insert into commitments (need_id, proposal_id, profile_id, quantity)
  values (people_need, pid, ann, 1) returning id into cid;

  select ready into ok_flag from activation_standing(pid);
  if ok_flag then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a fully pledged need did not read as ready'; end if;

  update commitments set status = 'withdrawn', withdrawn_at = now() where id = cid;

  select ready into ok_flag from activation_standing(pid);
  if not ok_flag then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: still ready after the only pledge was withdrawn'; end if;

  ------------------------------- a proposal needing nothing is ready at once
  pid := test_propose(ann, gid, 'local', null, 'Third', 'x',
                      'The noticeboard has last winter''s dates on it.');

  select ready into ok_flag from activation_standing(pid);
  if ok_flag then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a proposal needing nothing was not ready'; end if;

  ------------------------------------- you cannot pledge on someone else's behalf
  perform set_config('test.uid', ben::text, true);
  begin
    insert into commitments (need_id, proposal_id, profile_id, quantity)
    values (people_need, (select proposal_id from proposal_needs where id = people_need), ann, 1);
    fails := fails + 1;
    raise warning 'FAIL: Ben committed Ann to something';
  exception when others then passes := passes + 1;
  end;
  perform set_config('test.uid', ann::text, true);

  raise notice '';
  raise notice '  Activation: % passed, % failed', passes, fails;
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;

reset role;
