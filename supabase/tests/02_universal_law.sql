-- The Universal Law layer: a violation invalidates, and nothing overrides it.
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
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'lawann@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'lawben@example.com');

set role app;

do $$
declare
  ann uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  ben uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  gid uuid; pid uuid; rid uuid; aid uuid; code text;
  msg text; n int; ok_flag boolean; outcome decision_outcome;
  passes int := 0; fails int := 0;

  procedure_laws text[] := array[
    'sanctity_of_life','truth_and_transparency','sovereignty_of_the_individual',
    'equity_and_justice','subsidiarity','reciprocity_and_mutual_care',
    'stewardship_of_earth','harmony_of_diversity','right_use_of_power',
    'continuous_evolution'];
  l text;
begin
  perform set_config('test.uid', ann::text, true);
  gid := create_group('Law Test', 'x', 'local');
  code := create_invite(gid, 5, 14);

  perform set_config('test.uid', ben::text, true);
  perform redeem_invite(code);
  perform set_config('test.uid', ann::text, true);

  pid := test_propose(ann, gid, 'local', null, 'A proposal', 'Summary.',
                      'The room keeps being double-booked.');

  insert into proposal_reviews (proposal_id, prompt_id, prompt_version, model, summary)
  values (pid, 'proposal.review', '1.2.0', 'test', 'A reading.') returning id into rid;
  update proposals set status = 'in_deliberation' where id = pid;

  ------------------------------------------- no audit at all is not "lawful"
  select lawful into ok_flag from law_standing(pid);
  if not ok_flag then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: an unaudited proposal reported lawful'; end if;

  --------------------------------------- resonance is closed before an audit
  insert into proposal_reads (proposal_id, profile_id) values (pid, ann);
  -- (a review exists, so the gate that should bite is the law one)

  ------------------------------------------------ audit: one clear violation
  foreach l in array procedure_laws loop
    insert into law_assessments (proposal_id, review_id, law_id, verdict, reasoning,
                                 prompt_id, prompt_version, model)
    values (pid, rid, l,
            case when l = 'right_use_of_power' then 'violation'::law_verdict
                 else 'aligned'::law_verdict end,
            'test reading', 'law.audit', '1.0.0', 'test')
    returning id into aid;
  end loop;

  select violations, lawful into n, ok_flag from law_standing(pid);
  if n = 1 and not ok_flag then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: violation not counted (violations %, lawful %)', n, ok_flag; end if;

  --------------------------------------- a violation closes resonance itself
  begin
    perform cast_resonance(pid, 0.9, 0.9, 0.9, null);
    fails := fails + 1;
    raise warning 'FAIL: resonance was allowed on a proposal violating Universal Law';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%violates Universal Law%' then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: wrong error: %', msg; end if;
  end;

  ------------------------------------- a violation cannot be "answered" away
  select id into aid from law_assessments
   where proposal_id = pid and verdict = 'violation' and superseded_at is null;
  begin
    perform resolve_law_tension(aid, 'We have considered this and think it is fine really.');
    fails := fails + 1;
    raise warning 'FAIL: a violation was answered away';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%cannot be answered%' then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: wrong error answering a violation: %', msg; end if;
  end;

  ----------------------------- and a steward closing it cannot make it pass
  outcome := close_proposal(pid);
  if outcome = 'failed' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a proposal violating Universal Law passed'; end if;

  ------------------------------------------------------------ tensions now
  pid := test_propose(ann, gid, 'local', null, 'Second', 'Summary.',
                      'The rota falls on the same four people.');
  insert into proposal_reviews (proposal_id, prompt_id, prompt_version, model, summary)
  values (pid, 'proposal.review', '1.2.0', 'test', 'A reading.') returning id into rid;
  update proposals set status = 'in_deliberation' where id = pid;

  foreach l in array procedure_laws loop
    insert into law_assessments (proposal_id, review_id, law_id, verdict, reasoning,
                                 prompt_id, prompt_version, model)
    values (pid, rid, l,
            case when l = 'reciprocity_and_mutual_care' then 'tension'::law_verdict
                 else 'aligned'::law_verdict end,
            'test reading', 'law.audit', '1.0.0', 'test');
  end loop;

  select unanswered_tensions, lawful into n, ok_flag from law_standing(pid);
  if n = 1 and not ok_flag then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: open tension not blocking (n %, lawful %)', n, ok_flag; end if;

  --------------------------------------- an unanswered tension blocks a pass
  insert into proposal_reads (proposal_id, profile_id) values (pid, ann);
  perform cast_resonance(pid, 0.95, 0.95, 0.95, null);
  perform set_config('test.uid', ben::text, true);
  insert into proposal_reads (proposal_id, profile_id) values (pid, ben);
  perform cast_resonance(pid, 0.95, 0.95, 0.95, null);
  perform set_config('test.uid', ann::text, true);

  -- resonance is well above 0.618 and participation is 100%, so only the
  -- tension can fail this
  outcome := close_proposal(pid);
  if outcome = 'failed' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: passed with an unanswered tension at 0.95 resonance'; end if;

  ------------------------------------------- answering one, and passing
  pid := test_propose(ann, gid, 'local', null, 'Third', 'Summary.',
                      'The bins are left out all week.');
  insert into proposal_reviews (proposal_id, prompt_id, prompt_version, model, summary)
  values (pid, 'proposal.review', '1.2.0', 'test', 'A reading.') returning id into rid;
  update proposals set status = 'in_deliberation' where id = pid;

  foreach l in array procedure_laws loop
    insert into law_assessments (proposal_id, review_id, law_id, verdict, reasoning,
                                 prompt_id, prompt_version, model)
    values (pid, rid, l,
            case when l = 'stewardship_of_earth' then 'tension'::law_verdict
                 else 'aligned'::law_verdict end,
            'test reading', 'law.audit', '1.0.0', 'test')
    returning id into aid;
  end loop;

  select id into aid from law_assessments
   where proposal_id = pid and verdict = 'tension' and superseded_at is null;

  -- too short an answer is refused
  begin
    perform resolve_law_tension(aid, 'fine');
    fails := fails + 1; raise warning 'FAIL: a four-character answer resolved a tension';
  exception when others then passes := passes + 1;
  end;

  perform resolve_law_tension(aid,
    'We are sourcing the timber from the reclaimed yard on Mill Lane rather than new stock.');

  select unanswered_tensions, lawful into n, ok_flag from law_standing(pid);
  if n = 0 and ok_flag then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: answered tension still blocking (n %, lawful %)', n, ok_flag; end if;

  insert into proposal_reads (proposal_id, profile_id) values (pid, ann);
  perform cast_resonance(pid, 0.90, 0.90, 0.90, null);
  perform set_config('test.uid', ben::text, true);
  insert into proposal_reads (proposal_id, profile_id) values (pid, ben);
  perform cast_resonance(pid, 0.80, 0.80, 0.80, null);
  perform set_config('test.uid', ann::text, true);

  outcome := close_proposal(pid);
  if outcome = 'passed' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: lawful, well-resonated proposal did not pass'; end if;

  ------------------------------------------- the golden ratio is the threshold
  select threshold_alignment = 0.618 into ok_flag from groups where id = gid;
  if ok_flag then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: threshold is not the golden ratio'; end if;

  --------------------------------- resonance below 0.618 fails a lawful one
  pid := test_propose(ann, gid, 'local', null, 'Fourth', 'Summary.',
                      'Nobody knows who holds the spare key.');
  insert into proposal_reviews (proposal_id, prompt_id, prompt_version, model, summary)
  values (pid, 'proposal.review', '1.2.0', 'test', 'A reading.') returning id into rid;
  update proposals set status = 'in_deliberation' where id = pid;
  foreach l in array procedure_laws loop
    insert into law_assessments (proposal_id, review_id, law_id, verdict, reasoning,
                                 prompt_id, prompt_version, model)
    values (pid, rid, l, 'aligned', 'clear', 'law.audit', '1.0.0', 'test');
  end loop;
  insert into proposal_reads (proposal_id, profile_id) values (pid, ann);
  perform cast_resonance(pid, 0.60, 0.60, 0.60, null);
  perform set_config('test.uid', ben::text, true);
  insert into proposal_reads (proposal_id, profile_id) values (pid, ben);
  perform cast_resonance(pid, 0.60, 0.60, 0.60, null);
  perform set_config('test.uid', ann::text, true);

  outcome := close_proposal(pid);
  if outcome = 'failed' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: 0.60 passed against a 0.618 threshold'; end if;

  raise notice '';
  raise notice '  Universal Law: % passed, % failed', passes, fails;
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;

reset role;
