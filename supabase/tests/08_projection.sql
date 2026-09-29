-- Impact simulation: predictions that carry a date, freeze before the vote,
-- and have to be marked against what actually happened.
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
  ('f1111111-1111-1111-1111-11111111111f', 'pro1@example.com'),
  ('f2222222-2222-2222-2222-22222222222f', 'pro2@example.com'),
  ('f3333333-3333-3333-3333-33333333333f', 'pro3@example.com');

set role app;

-- The suite runs in two halves, because one step in the middle has to happen
-- outside the policies: a hundred days must pass, and the author cannot touch a
-- closed proposal — which is exactly the rule every other test here leans on.
-- These carry the state across the seam.
create temp table t08 (k text primary key, id uuid);
create temp table t08n (passes int not null, fails int not null);
insert into t08n values (0, 0);

do $$
declare
  ann  uuid := 'f1111111-1111-1111-1111-11111111111f';
  ben  uuid := 'f2222222-2222-2222-2222-22222222222f';
  zoe  uuid := 'f3333333-3333-3333-3333-33333333333f';
  gid uuid; pid uuid; rid uuid; code text; projid uuid;
  soon uuid; late uuid; risky uuid; aij uuid; other uuid;
  msg text; n int; d timestamptz; v projection_verdict;
  rate numeric; outcome decision_outcome;
  passes int := 0; fails int := 0;
  all_laws text[] := array[
    'sanctity_of_life','truth_and_transparency','sovereignty_of_the_individual',
    'equity_and_justice','subsidiarity','reciprocity_and_mutual_care',
    'stewardship_of_earth','harmony_of_diversity','right_use_of_power',
    'continuous_evolution'];
  l text;
begin
  perform set_config('test.uid', ann::text, true);
  gid := create_group('Projection Test', 'x', 'local');
  code := create_invite(gid, 9, 14);
  perform set_config('test.uid', ben::text, true); perform redeem_invite(code);
  perform set_config('test.uid', ann::text, true);

  -- Zoe is nowhere near this group, and says so.
  perform set_config('test.uid', zoe::text, true);
  update profiles set place_local = 'Somewhere Else', place_national = 'Elsewhere',
                      place_set_at = now()
   where id = zoe;
  perform set_config('test.uid', ann::text, true);

  pid := test_propose(ann, gid, 'local', null, 'Replace the boiler', 'Twelve hundred.',
                      'The boiler fails twice a winter and the repairs cost more each time.');

  insert into proposal_reviews (proposal_id, prompt_id, prompt_version, model, summary)
  values (pid, 'proposal.review', '1.2.0', 'test', 'A reading.') returning id into rid;
  foreach l in array all_laws loop
    insert into law_assessments (proposal_id, review_id, law_id, verdict, reasoning,
                                 prompt_id, prompt_version, model)
    values (pid, rid, l, 'aligned', 'clear', 'law.audit', '1.0.0', 'test');
  end loop;
  update proposals set status = 'in_deliberation' where id = pid;

  ------------------------------------------------- a claim has to be a claim
  begin
    perform record_projection(pid, 'effect', 'It will help.', 90);
    fails := fails + 1;
    raise warning 'FAIL: a three-word prediction was accepted';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%could turn out false%' or msg like '%violates check constraint%'
      then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: wrong error on a vague prediction: %', msg; end if;
  end;

  ------------------------------------------------------- and it has a horizon
  begin
    perform record_projection(pid, 'effect',
      'No winter call-out for a boiler failure at the hall.', 0);
    fails := fails + 1;
    raise warning 'FAIL: a zero-day horizon was accepted';
  exception when others then passes := passes + 1;
  end;

  ------------------------------------------------------ writing them down
  soon := record_projection(pid, 'effect',
    'No emergency call-out for the boiler between now and the end of winter.',
    30, 0.800);
  late := record_projection(pid, 'effect',
    'The hall spends less on heating this year than it did last year.',
    365, 0.600);
  risky := record_projection(pid, 'risk',
    'The work overruns the twelve hundred we have set aside for it.',
    60, 0.300);

  select count(*)::int into n from projections where proposal_id = pid;
  if n = 3 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: expected 3 projections, got %', n; end if;

  select effects into n from projection_standing(pid);
  if n = 2 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: expected 2 effects, got %', n; end if;

  ------------------------------------- the model's words carry their rubric
  aij := record_projection(pid, 'risk',
    'A second radiator fails within the same period and is not covered.',
    90, 0.250, 'ai', 'proposal.simulate', '1.0.0', 'test-model');

  select model into msg from projections where id = aij;
  if msg = 'test-model' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the model was not recorded against its own sentence'; end if;

  ----------------------------------- and a person's words must not pretend to
  begin
    insert into projections (proposal_id, direction, statement, horizon_days,
                             source, created_by, prompt_id, prompt_version, model)
    values (pid, 'effect', 'Something a person wrote but dressed as a reading.',
            30, 'human', ann, 'proposal.simulate', '1.0.0', 'test-model');
    fails := fails + 1;
    raise warning 'FAIL: a human projection carried a prompt version';
  exception when others then passes := passes + 1;
  end;

  ------------------------------------------------- nothing is due before close
  select due_now into n from projection_standing(pid);
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % due on an undecided proposal', n; end if;

  begin
    perform resolve_projection(soon, 'held', 'It has not been through a winter yet.');
    fails := fails + 1;
    raise warning 'FAIL: marked a projection on an undecided proposal';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%not been decided%' then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: wrong error marking early: %', msg; end if;
  end;

  -------------------------------------------- another place cannot see any of it
  perform set_config('test.uid', zoe::text, true);
  select count(*)::int into n from projections where proposal_id = pid;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: an outsider read % projections', n; end if;

  begin
    perform record_projection(pid, 'effect',
      'An outsider predicting things about a hall they have never been in.', 30);
    fails := fails + 1;
    raise warning 'FAIL: an outsider wrote a projection';
  exception when others then passes := passes + 1;
  end;
  perform set_config('test.uid', ann::text, true);

  --------------------------------------------------------------- close it
  insert into proposal_reads (proposal_id, profile_id) values (pid, ann);
  perform cast_resonance(pid, 0.90, 0.90, 0.90, null);
  perform set_config('test.uid', ben::text, true);
  insert into proposal_reads (proposal_id, profile_id) values (pid, ben);
  perform cast_resonance(pid, 0.85, 0.85, 0.85, null);
  perform set_config('test.uid', ann::text, true);

  outcome := close_proposal(pid);
  if outcome = 'passed' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the proposal did not pass (%)', outcome; end if;

  --------------------------------------------- and now nothing can be added
  begin
    perform record_projection(pid, 'effect',
      'A prediction written after the votes were counted and read.', 30);
    fails := fails + 1;
    raise warning 'FAIL: a projection was added after the proposal closed';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%is a memory%' then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: wrong error after close: %', msg; end if;
  end;

  ------------------------------------------- the clock starts at the decision
  d := projection_due(soon);
  if d is not null and d::date = (now() + interval '30 days')::date
    then passes := passes + 1;
  else fails := fails + 1;
    raise warning 'FAIL: due date is % rather than thirty days out', d; end if;

  perform activate_proposal(pid);
  select id into projid from projects where proposal_id = pid;

  ------------------------------------ a miss cannot be called before the date
  begin
    perform resolve_projection(late, 'missed',
      'I have decided in advance that this one is not going to happen.');
    fails := fails + 1;
    raise warning 'FAIL: a miss was called a year early';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%does not come due%' then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: wrong error on an early miss: %', msg; end if;
  end;

  ------------------------------------- but something that already happened can
  perform resolve_projection(risky, 'held',
    'The plumber found a cracked flue on day two and it came to fourteen hundred.');
  select verdict into v from projections where id = risky;
  if v = 'held' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: an observation arriving early was not recorded'; end if;

  ------------------------------------------------------ a verdict needs a reason
  begin
    perform resolve_projection(soon, 'held', 'yep');
    fails := fails + 1;
    raise warning 'FAIL: a three-character verdict note was accepted';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%your own words%' then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: wrong error on a short note: %', msg; end if;
  end;

  ------------------------------------------------ and it is given exactly once
  begin
    perform resolve_projection(risky, 'missed',
      'On reflection I would rather the record said something else about this.');
    fails := fails + 1;
    raise warning 'FAIL: a verdict was overwritten';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%second answer%' then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: wrong error re-marking: %', msg; end if;
  end;

  ---------------------------------------------- and it cannot be edited around
  begin
    update projections
       set statement = 'Something I would look better having predicted.'
     where id = risky;
    if (select statement from projections where id = risky)
       = 'Something I would look better having predicted.' then
      fails := fails + 1;
      raise warning 'FAIL: a projection was rewritten after the fact';
    else
      passes := passes + 1;
    end if;
  exception when others then passes := passes + 1;
  end;

  ----------------------------------------------- and it cannot be deleted
  delete from projections where id = risky;
  select count(*)::int into n from projections where id = risky;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a projection was deleted'; end if;

  ------------------------- a project does not complete on unmarked due claims
  insert into reflections (project_id, actual_outcome, lesson, created_by)
  values (projid,
          'The boiler was replaced in a week. It cost fourteen hundred rather than twelve, '
          || 'because of a flue nobody had looked at.',
          'Look behind the panel before quoting.', ann);

  insert into t08 values ('pid', pid), ('projid', projid), ('soon', soon),
                         ('late', late), ('risky', risky), ('aij', aij), ('gid', gid);
  delete from t08n;
  insert into t08n values (passes, fails);
end $$;

-- A hundred days, as the owner. The author cannot reach a closed proposal and
-- should not be able to; this is the one line in the suite that is allowed
-- past the policies, and it is here rather than in a helper so it is obvious.
reset role;
update proposals set closed_at = now() - interval '100 days'
 where id = (select id from t08 where k = 'pid');
set role app;

do $$
declare
  ann  uuid := 'f1111111-1111-1111-1111-11111111111f';
  ben  uuid := 'f2222222-2222-2222-2222-22222222222f';
  gid uuid; pid uuid; projid uuid; soon uuid; late uuid; risky uuid; aij uuid;
  msg text; n int; v projection_verdict; rate numeric;
  passes int; fails int;
begin
  select id into pid    from t08 where k = 'pid';
  select id into projid from t08 where k = 'projid';
  select id into soon   from t08 where k = 'soon';
  select id into late   from t08 where k = 'late';
  select id into risky  from t08 where k = 'risky';
  select id into aij    from t08 where k = 'aij';
  select id into gid    from t08 where k = 'gid';
  select t.passes, t.fails into passes, fails from t08n t;

  perform set_config('test.uid', ann::text, true);

  select due_now into n from projection_standing(pid);
  if n = 2 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: expected 2 claims due, got %', n; end if;

  begin
    perform complete_project(projid);
    fails := fails + 1;
    raise warning 'FAIL: completed with predictions due and unmarked';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%came due%' then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: wrong error completing: %', msg; end if;
  end;

  ------------------------------------------------------- mark them, and it does
  perform resolve_projection(soon, 'held',
    'No call-out all winter, which is the first time in four years.');
  perform resolve_projection(aij, 'missed',
    'No other radiator failed. The model was guessing at a pattern that was not there.');

  perform complete_project(projid);
  select status::text into msg from projects where id = projid;
  if msg = 'completed' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: project status is % after completion', msg; end if;

  ------------------------------- the long horizon did not hold the project open
  select verdict into v from projections where id = late;
  if v is null then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the year-out claim was marked to get the project closed'; end if;

  ----------------------------------------------------- the record, by whose words
  select hit_rate into rate from forecast_record(null, null, gid) where source = 'human';
  if rate = 1.000 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: human hit rate is % rather than 1.000', rate; end if;

  select hit_rate into rate from forecast_record(null, null, gid) where source = 'ai';
  if rate = 0.000 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: ai hit rate is % rather than 0.000', rate; end if;

  ------------------------------------------------ and your own, only your own
  select marked into n from my_forecast_record();
  if n = 2 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: own record shows % marked rather than 2', n; end if;

  perform set_config('test.uid', ben::text, true);
  select marked into n from my_forecast_record();
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: somebody else''s record leaked into ben''s (% marked)', n; end if;
  perform set_config('test.uid', ann::text, true);

  ---------------------------------------- what is still waiting to be marked
  select count(*)::int into n from due_projections(gid, null, 20);
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % still listed as due after marking', n; end if;

  --------------------------------------------- every one of them is on the ledger
  select count(*)::int into n
    from ledger_events where group_id = gid and kind like 'projection.%';
  if n >= 6 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: only % projection events on the ledger', n; end if;

  raise notice ' ';
  raise notice '  Impact simulation: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then
    raise exception '% checks failed', fails;
  end if;
end $$;

reset role;
