-- Exercises the rules that define the product, as a non-superuser so RLS applies.
\set ON_ERROR_STOP on
\pset pager off

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'app') then
    create role app login;
  end if;
end $$;

grant usage on schema public, auth to app;
grant select, insert, update, delete on all tables in schema public to app;
grant usage, select on all sequences in schema public to app;
grant execute on all functions in schema public to app;
grant execute on function auth.uid() to app;
grant select on auth.users to app;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ann@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'cara@example.com');

update profiles set display_name = 'Ann'  where id = '11111111-1111-1111-1111-111111111111';
update profiles set display_name = 'Ben'  where id = '22222222-2222-2222-2222-222222222222';
update profiles set display_name = 'Cara' where id = '33333333-3333-3333-3333-333333333333';

set role app;

do $$
declare
  ann   uuid := '11111111-1111-1111-1111-111111111111';
  ben   uuid := '22222222-2222-2222-2222-222222222222';
  cara  uuid := '33333333-3333-3333-3333-333333333333';
  gid   uuid;
  code  text;
  pid   uuid;
  rid   uuid;
  fid   uuid;
  projid uuid;
  n     int;
  msg   text;
  outcome decision_outcome;
  ok_flag boolean;

  passes int := 0;
  fails  int := 0;

  -- Since 0004, close_proposal() refuses a proposal that has not been read
  -- against Universal Law. These tests are about the resonance rules, so they
  -- clear the law gate explicitly and 02_universal_law.sql covers the gate.
  all_laws text[] := array[
    'sanctity_of_life','truth_and_transparency','sovereignty_of_the_individual',
    'equity_and_justice','subsidiarity','reciprocity_and_mutual_care',
    'stewardship_of_earth','harmony_of_diversity','right_use_of_power',
    'continuous_evolution'];
  l text;

begin
  -- tiny assertion helpers, inline
  -- (a real suite would use pgTAP; this is a smoke test that must not need one)

  perform set_config('test.uid', ann::text, true);

  ------------------------------------------------------------------ profiles
  -- RLS means Ann, who is in no group yet, can see only herself. That is the
  -- policy working; the trigger is verified from outside the role below.
  select count(*) into n from profiles;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: expected to see only my own profile before joining a group, saw %', n; end if;

  -------------------------------------------------------------------- groups
  gid := create_group('Thursday Studio', 'A weekly making session', 'local');
  code := create_invite(gid, 5, 14);

  perform set_config('test.uid', ben::text, true);
  if redeem_invite(code) = gid then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: Ben could not join by invite'; end if;

  perform set_config('test.uid', cara::text, true);
  perform redeem_invite(code);

  select count(*) into n from group_members where group_id = gid;
  if n = 3 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: expected 3 members, got %', n; end if;

  --------------------------------------------------- individual data private
  perform set_config('test.uid', ann::text, true);
  insert into entries (profile_id, mode, body) values (ann, 'journal', 'Something private.');

  perform set_config('test.uid', ben::text, true);
  select count(*) into n from entries;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a group member could read % private entries', n; end if;

  ------------------------------------------------------- values, opt-in only
  perform set_config('test.uid', ann::text, true);
  insert into profile_values (profile_id, name, definition, position) values
    (ann, 'Hospitality', 'Nobody is turned away over money.', 0),
    (ann, 'Restraint',   'Only what we can sustain.',         1);

  perform set_config('test.uid', ben::text, true);
  select count(*) into n from profile_values where profile_id = ann;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: unshared values were visible'; end if;

  perform set_config('test.uid', ann::text, true);
  update profiles set share_values = true where id = ann;

  perform set_config('test.uid', ben::text, true);
  select count(*) into n from profile_values where profile_id = ann;
  if n = 2 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: shared values not visible, got %', n; end if;

  ------------------------------------------------------------------ proposal
  perform set_config('test.uid', ann::text, true);
  insert into proposals (group_id, author_id, title, summary, body, budget_amount, term_days)
  values (gid, ann, 'Rent the room above the pub', 'Twelve weeks at 480.',
          'The hall keeps being double-booked and people stop coming.', 480, 84)
  returning id into pid;

  ------------------------------------------- gate 1: no resonance, no review
  begin
    perform cast_resonance(pid, 0.8, 0.8, 0.8, null);
    fails := fails + 1;
    raise warning 'FAIL: resonance was allowed before a review existed';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%review has not landed%' then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: wrong error before review: %', msg; end if;
  end;

  ------------------------------------------------------------------- review
  insert into proposal_reviews (
    proposal_id, prompt_id, prompt_version, model,
    clarity, evidence, feasibility, reversibility,
    values_alignment, risks, questions, memory_used, summary
  ) values (
    pid, 'proposal.review', '1.2.0', 'test',
    0.8, 0.6, 0.7, 0.4,
    '{"Hospitality": 0.28, "Restraint": 0.55}'::jsonb,
    '[{"title":"Committed before collected","severity":"high","note":"n"}]'::jsonb,
    '["Who is liable?"]'::jsonb, '[]'::jsonb, 'A reading.'
  ) returning id into rid;

  foreach l in array all_laws loop
    insert into law_assessments (proposal_id, review_id, law_id, verdict, reasoning,
                                 prompt_id, prompt_version, model)
    values (pid, rid, l, 'aligned', 'cleared for this test', 'law.audit', '1.0.0', 'test');
  end loop;

  update proposals set status = 'in_deliberation' where id = pid;

  insert into proposal_flags (proposal_id, review_id, kind, label, severity, detail)
  values (pid, rid, 'values', 'Scores 0.28 against Hospitality', 'high', 'Below the floor.')
  returning id into fid;

  insert into proposal_flags (proposal_id, review_id, kind, label, severity, detail)
  values (pid, rid, 'risk', 'Committed before collected', 'high', 'n');

  --------------------------------------- gate 2: no resonance without a read
  perform set_config('test.uid', ben::text, true);
  begin
    perform cast_resonance(pid, 0.8, 0.8, 0.8, null);
    fails := fails + 1;
    raise warning 'FAIL: resonance was allowed without reading the review';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%read the review%' then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: wrong error before read: %', msg; end if;
  end;

  ----------------------------------------------------- resonance, once read
  perform set_config('test.uid', ann::text, true);
  insert into proposal_reads (proposal_id, profile_id) values (pid, ann);
  perform cast_resonance(pid, 0.90, 0.80, 0.85, 'Only option that keeps Thursdays.');

  perform set_config('test.uid', ben::text, true);
  insert into proposal_reads (proposal_id, profile_id) values (pid, ben);
  perform cast_resonance(pid, 0.74, 0.68, 0.55, 'Yes at six weeks.');

  perform set_config('test.uid', cara::text, true);
  insert into proposal_reads (proposal_id, profile_id) values (pid, cara);
  perform cast_resonance(pid, 0.71, 0.52, 0.41, null);

  select status::text into msg from proposals where id = pid;
  if msg = 'voting' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: first resonance did not move status to voting, got %', msg; end if;

  ------------------------------------------ averages hidden before it closes
  perform set_config('test.uid', ben::text, true);
  select count(*) into n from resonance_votes where proposal_id = pid;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: Ben could read % resonance rows before close (expected only his own)', n; end if;

  select voter_count, avg_alignment is null
    into n, ok_flag
    from resonance_summary(pid);
  if n = 3 and ok_flag then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: summary leaked averages before close (count %, hidden %)', n, ok_flag; end if;

  ------------------------------------------------ a flag cannot be dismissed
  begin
    perform resolve_flag(fid, 'fine');
    fails := fails + 1;
    raise warning 'FAIL: a four-character answer resolved a critical flag';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%what changed%' then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: wrong error on short resolution: %', msg; end if;
  end;

  ------------------------------- an unanswered flag fails the proposal alone
  perform set_config('test.uid', ann::text, true);
  outcome := close_proposal(pid);
  if outcome = 'failed' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: proposal passed with two unanswered critical flags'; end if;

  ---------------------------------------------- now the same again, answered
  insert into proposals (group_id, author_id, title, summary, body, budget_amount, term_days)
  values (gid, ann, 'Rent the room, six weeks', 'Six weeks at 240.',
          'Halved after the review. Two places from the fund.', 240, 42)
  returning id into pid;

  insert into proposal_reviews (
    proposal_id, prompt_id, prompt_version, model,
    clarity, evidence, feasibility, reversibility, values_alignment, summary
  ) values (
    pid, 'proposal.review', '1.2.0', 'test', 0.85, 0.7, 0.8, 0.7,
    '{"Hospitality": 0.62, "Restraint": 0.71}'::jsonb, 'Better.'
  ) returning id into rid;

  foreach l in array all_laws loop
    insert into law_assessments (proposal_id, review_id, law_id, verdict, reasoning,
                                 prompt_id, prompt_version, model)
    values (pid, rid, l, 'aligned', 'cleared for this test', 'law.audit', '1.0.0', 'test');
  end loop;

  update proposals set status = 'in_deliberation' where id = pid;

  insert into proposal_flags (proposal_id, review_id, kind, label, severity, detail)
  values (pid, rid, 'risk', 'Fronted before collected', 'high', 'n')
  returning id into fid;

  perform resolve_flag(fid,
    'Tom is fronting 240 and the fund covers any shortfall up to 80, agreed in the thread.');

  select resolved_by = ann and resolved_at is not null into ok_flag
    from proposal_flags where id = fid;
  if ok_flag then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: answering a flag did not attribute it'; end if;

  insert into proposal_reads (proposal_id, profile_id) values (pid, ann);
  perform cast_resonance(pid, 0.89, 0.80, 0.82, null);
  perform set_config('test.uid', ben::text, true);
  insert into proposal_reads (proposal_id, profile_id) values (pid, ben);
  perform cast_resonance(pid, 0.74, 0.68, 0.55, null);
  perform set_config('test.uid', cara::text, true);
  insert into proposal_reads (proposal_id, profile_id) values (pid, cara);
  perform cast_resonance(pid, 0.71, 0.52, 0.41, null);

  perform set_config('test.uid', ann::text, true);
  outcome := close_proposal(pid);
  if outcome = 'passed' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: proposal did not pass with the rule satisfied'; end if;

  ------------------------------------------ passing creates a project, and
  ------------------------------------------ closing reveals the numbers
  select id into projid from projects where proposal_id = pid;
  if projid is not null then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a passed proposal did not create a project'; end if;

  perform set_config('test.uid', ben::text, true);
  select count(*) into n from resonance_votes where proposal_id = pid;
  if n = 3 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: Ben saw % votes after close, expected 3', n; end if;

  select avg_alignment is not null into ok_flag from resonance_summary(pid);
  if ok_flag then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: averages still hidden after close'; end if;

  ------------------------------------- no completion without a reflection
  begin
    perform complete_project(projid);
    fails := fails + 1;
    raise warning 'FAIL: a project completed with no reflection';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%write the reflection first%' then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: wrong error completing: %', msg; end if;
  end;

  ------------------------------------- a reflection has to say something
  begin
    insert into reflections (project_id, actual_outcome, created_by)
    values (projid, 'It went fine.', ben);
    fails := fails + 1;
    raise warning 'FAIL: a thirteen-character reflection was accepted';
  exception when check_violation then
    passes := passes + 1;
  end;

  insert into reflections (project_id, actual_outcome, assumption_wrong, lesson, created_by)
  values (projid,
    'Six Thursdays ran without a cancellation. Attendance settled at nine rather than the eleven we budgeted for, and the lockable cupboard mattered more than the room did.',
    'We assumed the problem was reliability. It was not.',
    'Ask the people who left why they left, before proposing the fix.',
    ben);

  perform complete_project(projid);
  select status::text into msg from projects where id = projid;
  if msg = 'completed' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: project not completed after reflection, status %', msg; end if;

  ---------------------------------------------------------------- retrieval
  select count(*) into n
    from related_decisions(gid, array['Hospitality','Restraint'], 6);
  if n = 2 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: retrieval returned % decisions, expected 2', n; end if;

  select r.lesson is not null into ok_flag
    from related_decisions(gid, array['Hospitality','Restraint'], 6) r
    where r.proposal_id = pid;
  if ok_flag then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: retrieval did not carry the lesson through to the reviewer'; end if;

  ------------------------------------------------------------------- ledger
  select v.ok, v.checked into ok_flag, n from verify_ledger(gid) v;
  if ok_flag and n > 6 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: ledger did not verify (ok %, checked %)', ok_flag, n; end if;

  raise notice '';
  raise notice '  % passed, % failed', passes, fails;
  if fails > 0 then
    raise exception '% checks failed', fails;
  end if;
end $$;

reset role;

-- The chain must notice tampering. Done as superuser, because that is exactly
-- the threat model: someone with direct database access editing the record.
\echo ''
\echo '=== tamper detection'
do $$
declare
  gid uuid;
  ok_flag boolean;
  broken bigint;
begin
  select id into gid from groups limit 1;
  perform set_config('test.uid', (select profile_id::text from group_members where group_id = gid limit 1), true);

  update ledger_events
     set payload = jsonb_set(payload, '{outcome}', '"passed"')
   where kind = 'proposal.decided'
     and payload->>'outcome' = 'failed';

  select ok, broken_at into ok_flag, broken from verify_ledger(gid);

  if ok_flag then
    raise exception 'FAIL: an edited decision went undetected';
  else
    raise notice '  pass: tampering detected at entry %', broken;
  end if;
end $$;
