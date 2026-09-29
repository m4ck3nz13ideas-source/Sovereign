-- Contention: two good answers to one question, and a preference that orders
-- without ever passing anything.
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
  ('c0000001-0000-0000-0000-000000000000', 'con1@example.com'),
  ('c0000002-0000-0000-0000-000000000000', 'con2@example.com'),
  ('c0000003-0000-0000-0000-000000000000', 'con3@example.com'),
  ('c0000004-0000-0000-0000-000000000000', 'con4@example.com');

set role app;

-- Everything but the last stretch. The suite splits because a contention
-- resolves on a trigger when the last member closes, and the test needs to
-- look at the world on both sides of that moment.
create temp table t11 (k text primary key, id uuid);
create temp table t11n (passes int not null, fails int not null);
insert into t11n values (0, 0);

do $$
declare
  ann uuid := 'c0000001-0000-0000-0000-000000000000';
  ben uuid := 'c0000002-0000-0000-0000-000000000000';
  cal uuid := 'c0000003-0000-0000-0000-000000000000';
  dot uuid := 'c0000004-0000-0000-0000-000000000000';
  elsewhere uuid;
  bench uuid; trees uuid; cid uuid; rid uuid; n int; msg text;
  ok_flag boolean; outcome decision_outcome;
  passes int := 0; fails int := 0;
  all_laws text[] := array[
    'sanctity_of_life','truth_and_transparency','sovereignty_of_the_individual',
    'equity_and_justice','subsidiarity','reciprocity_and_mutual_care',
    'stewardship_of_earth','harmony_of_diversity','right_use_of_power',
    'continuous_evolution'];
  l text;

  procedure_note text;
  v_when timestamptz;
begin
  --------------------------------------------- four people on the same green
  foreach procedure_note in array array[ann::text, ben::text, cal::text, dot::text] loop
    perform set_config('test.uid', procedure_note, true);
    update profiles set place_local = 'The Green', place_regional = 'Devon',
                        place_national = 'United Kingdom', place_set_at = now()
     where id = procedure_note::uuid;
  end loop;

  perform set_config('test.uid', ann::text, true);

  ---------------------------------- two answers to one question: £900, once
  bench := test_propose(ann, null, 'local', 'The Green',
                        'Put benches round the green', 'Nine hundred.',
                        'There is nowhere to sit on the green and the older residents stop walking there.');
  trees := test_propose(ann, null, 'local', 'The Green',
                        'Plant limes along the path', 'Nine hundred.',
                        'The path across the green has no shade and is unusable by midday in summer.');
  -- And one that has nothing to do with it.
  elsewhere := test_propose(ann, null, 'regional', 'Devon',
                            'A county-wide repair fund', 'Ten thousand.',
                            'Every parish is separately failing to fix the same kinds of small thing.');

  foreach procedure_note in array array[bench::text, trees::text, elsewhere::text] loop
    insert into proposal_reviews (proposal_id, prompt_id, prompt_version, model, summary)
    values (procedure_note::uuid, 'proposal.review', '1.2.0', 'test', 'A reading.')
    returning id into rid;
    foreach l in array all_laws loop
      insert into law_assessments (proposal_id, review_id, law_id, verdict, reasoning,
                                   prompt_id, prompt_version, model)
      values (procedure_note::uuid, rid, l, 'aligned', 'clear', 'law.audit', '1.0.0', 'test');
    end loop;
    update proposals set status = 'in_deliberation' where id = procedure_note::uuid;
  end loop;

  ------------------------------ things addressed to different people cannot contend
  begin
    perform open_contention('The nine hundred pounds', bench, elsewhere);
    fails := fails + 1;
    raise warning 'FAIL: a local and a regional proposal were made alternatives';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%different people%' then passes := passes + 1;
    else fails := fails + 1;
      raise warning 'FAIL: wrong error contending across addresses: %', msg; end if;
  end;

  -------------------------------------------- nor does a proposal contend with itself
  begin
    perform open_contention('The nine hundred pounds', bench, bench);
    fails := fails + 1;
    raise warning 'FAIL: a proposal contended with itself';
  exception when others then passes := passes + 1;
  end;

  ------------------------------------------------------------ declaring it
  cid := open_contention('What the nine hundred on the green goes on', bench, trees,
                         'Both want the whole of it. One of them happens this year.');
  select count(*)::int into n from contention_members where contention_id = cid;
  if n = 2 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: expected 2 members, got %', n; end if;

  ------------------------------------------- a proposal is in one set at a time
  begin
    perform open_contention('Another way of asking it', bench, trees);
    fails := fails + 1;
    raise warning 'FAIL: a proposal joined a second contention';
  exception when others then passes := passes + 1;
  end;

  ------------------------------------------------- read it before you rank it
  perform set_config('test.uid', ben::text, true);
  begin
    perform set_preference(cid, bench);
    fails := fails + 1;
    raise warning 'FAIL: somebody ranked a proposal they had not read';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%read it before%' then passes := passes + 1;
    else fails := fails + 1;
      raise warning 'FAIL: wrong error ranking unread: %', msg; end if;
  end;

  ------------------------------------------------------------ naming choices
  -- Ann wants the benches. The other three want the trees — and Dot says
  -- benches first and changes her mind, which is allowed right up until the
  -- set closes.
  perform set_config('test.uid', ann::text, true);
  insert into proposal_reads (proposal_id, profile_id) values (bench, ann), (trees, ann);
  perform set_preference(cid, bench);

  perform set_config('test.uid', ben::text, true);
  insert into proposal_reads (proposal_id, profile_id) values (bench, ben), (trees, ben);
  perform set_preference(cid, trees);

  perform set_config('test.uid', cal::text, true);
  insert into proposal_reads (proposal_id, profile_id) values (bench, cal), (trees, cal);
  perform set_preference(cid, trees);

  perform set_config('test.uid', dot::text, true);
  insert into proposal_reads (proposal_id, profile_id) values (bench, dot), (trees, dot);
  perform set_preference(cid, bench);
  perform set_preference(cid, trees);

  select count(*)::int into n from preferences where contention_id = cid and profile_id = dot;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: changing your mind left % rows', n; end if;

  ------------------------------------------- nobody can see anybody else's
  select count(*)::int into n from preferences where contention_id = cid;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: one person read % preference rows — expected only their own', n;
  end if;

  ------------------------------------------------ and no count is revealed yet
  select revealed into ok_flag from contention_standing(cid) limit 1;
  if not ok_flag then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the set says it is revealed before anything closed'; end if;

  select count(*)::int into n from contention_standing(cid) where preferences is not null;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % running totals were visible before the set closed', n; end if;

  -------------------------------------- but you can see whether people turned up
  select responded into n from contention_for(bench);
  if n = 4 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: expected 4 people to have named a choice, got %', n; end if;

  ------------------------------------------------------------- close them both
  -- Both pass on their own terms. The contention has no say in that and this
  -- is the test that proves it: the one the group prefers LESS also passes.
  perform set_config('test.uid', ann::text, true);
  perform cast_resonance(bench, 0.90, 0.85, 0.80, null);
  perform cast_resonance(trees, 0.88, 0.85, 0.80, null);
  perform set_config('test.uid', ben::text, true);
  perform cast_resonance(bench, 0.85, 0.80, 0.80, null);
  perform cast_resonance(trees, 0.82, 0.80, 0.80, null);
  perform set_config('test.uid', cal::text, true);
  perform cast_resonance(bench, 0.80, 0.80, 0.80, null);
  perform cast_resonance(trees, 0.90, 0.85, 0.85, null);
  perform set_config('test.uid', dot::text, true);
  perform cast_resonance(bench, 0.80, 0.80, 0.80, null);
  perform cast_resonance(trees, 0.88, 0.85, 0.85, null);

  perform set_config('test.uid', ann::text, true);
  outcome := close_proposal(bench);
  if outcome = 'passed' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the benches did not pass (%)', outcome; end if;

  ------------------------------------- one closed is not the whole set closed
  select resolved_at into v_when from contention_for(bench);
  if v_when is null then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the set resolved with one member still open'; end if;

  outcome := close_proposal(trees);
  if outcome = 'passed' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the trees did not pass (%) — both were meant to', outcome; end if;

  insert into t11 values ('bench', bench), ('trees', trees), ('cid', cid);
  delete from t11n;
  insert into t11n values (passes, fails);
end $$;

do $$
declare
  ann uuid := 'c0000001-0000-0000-0000-000000000000';
  bench uuid; trees uuid; cid uuid;
  n int; msg text; ok_flag boolean; pos int;
  passes int; fails int;
begin
  select id into bench from t11 where k = 'bench';
  select id into trees from t11 where k = 'trees';
  select id into cid   from t11 where k = 'cid';
  select t.passes, t.fails into passes, fails from t11n t;

  perform set_config('test.uid', ann::text, true);

  --------------------------------- the last close resolves the set, by itself
  select revealed into ok_flag from contention_standing(cid) limit 1;
  if ok_flag then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the set did not resolve when its last member closed'; end if;

  ------------------------------------------------- and now the counts are real
  select preferences into n from contention_standing(cid) where proposal_id = bench;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: benches show % preferences, expected 1', n; end if;

  select preferences into n from contention_standing(cid) where proposal_id = trees;
  if n = 3 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: trees show % preferences, expected 3', n; end if;

  select order_position into pos from contention_standing(cid) where proposal_id = trees;
  if pos = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the preferred answer is in position %', pos; end if;

  ---------------------------------------------------- nothing can be changed now
  begin
    perform set_preference(cid, trees);
    fails := fails + 1;
    raise warning 'FAIL: a preference was changed after the set resolved';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%already settled%' then passes := passes + 1;
    else fails := fails + 1;
      raise warning 'FAIL: wrong error setting a preference late: %', msg; end if;
  end;

  --------------------------- BOTH passed. The preference passed nothing at all.
  select status::text into msg from proposals where id = bench;
  if msg = 'passed' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the less-preferred proposal is % — a preference is not a verdict', msg;
  end if;

  ------------------------------------------- but it does not go first
  begin
    perform activate_proposal(bench);
    fails := fails + 1;
    raise warning 'FAIL: the less-preferred answer activated ahead of the preferred one';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%preferred another answer%' then passes := passes + 1;
    else fails := fails + 1;
      raise warning 'FAIL: wrong error activating out of order: %', msg; end if;
  end;

  ------------------------------------------------- the preferred one is free to
  perform activate_proposal(trees);
  select status::text into msg from proposals where id = trees;
  if msg = 'executing' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the preferred answer did not activate (%)', msg; end if;

  ---------------------------- and activating it does not release the other one
  -- The nine hundred is spent. The question has been answered.
  begin
    perform activate_proposal(bench);
    fails := fails + 1;
    raise warning 'FAIL: both answers to one question activated';
  exception when others then passes := passes + 1;
  end;

  raise notice ' ';
  raise notice '  Contention: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then
    raise exception '% checks failed', fails;
  end if;
end $$;

reset role;
