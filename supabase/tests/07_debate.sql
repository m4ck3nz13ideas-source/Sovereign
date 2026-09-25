-- Debate: contributions that have a kind, answers that stick, and a split that
-- cannot hide inside a mean.
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
  ('e1111111-1111-1111-1111-11111111111e', 'deb1@example.com'),
  ('e2222222-2222-2222-2222-22222222222e', 'deb2@example.com'),
  ('e3333333-3333-3333-3333-33333333333e', 'deb3@example.com'),
  ('e4444444-4444-4444-4444-44444444444e', 'deb4@example.com');

set role app;

do $$
declare
  ann  uuid := 'e1111111-1111-1111-1111-11111111111e';
  ben  uuid := 'e2222222-2222-2222-2222-22222222222e';
  cara uuid := 'e3333333-3333-3333-3333-33333333333e';
  dan  uuid := 'e4444444-4444-4444-4444-44444444444e';
  gid uuid; pid uuid; split uuid; rid uuid; code text;
  q uuid; cn uuid; am uuid; reply uuid;
  msg text; n int; ok_flag boolean; outcome decision_outcome;
  v_disp numeric; v_pol boolean;
  passes int := 0; fails int := 0;
  all_laws text[] := array[
    'sanctity_of_life','truth_and_transparency','sovereignty_of_the_individual',
    'equity_and_justice','subsidiarity','reciprocity_and_mutual_care',
    'stewardship_of_earth','harmony_of_diversity','right_use_of_power',
    'continuous_evolution'];
  l text;
begin
  perform set_config('test.uid', ann::text, true);
  gid := create_group('Debate Test', 'x', 'local');
  code := create_invite(gid, 9, 14);
  perform set_config('test.uid', ben::text,  true); perform redeem_invite(code);
  perform set_config('test.uid', cara::text, true); perform redeem_invite(code);
  perform set_config('test.uid', dan::text,  true); perform redeem_invite(code);
  perform set_config('test.uid', ann::text, true);

  pid := test_propose(ann, gid, 'local', null, 'Buy the good ladder', 'Four hundred.',
                      'The ladder we have is the wrong height for the high windows.');
  insert into proposal_reviews (proposal_id, prompt_id, prompt_version, model, summary)
  values (pid, 'proposal.review', '1.2.0', 'test', 'A reading.') returning id into rid;
  foreach l in array all_laws loop
    insert into law_assessments (proposal_id, review_id, law_id, verdict, reasoning,
                                 prompt_id, prompt_version, model)
    values (pid, rid, l, 'aligned', 'clear', 'law.audit', '1.0.0', 'test');
  end loop;
  update proposals set status = 'in_deliberation' where id = pid;

  --------------------------------------------- a top-level thing says what it is
  perform set_config('test.uid', ben::text, true);
  insert into deliberation_comments (proposal_id, author_id, kind, body)
  values (pid, ben, 'question', 'Who stores it, and where?')
  returning id into q;

  insert into deliberation_comments (proposal_id, author_id, kind, body)
  values (pid, ben, 'concern', 'Four hundred is most of what is left in the fund.')
  returning id into cn;

  perform set_config('test.uid', cara::text, true);
  insert into deliberation_comments (proposal_id, author_id, kind, body)
  values (pid, cara, 'amendment', 'Buy the shorter one at two hundred and hire the tall one twice a year.')
  returning id into am;

  select count(*) into n from deliberation_comments where proposal_id = pid;
  if n = 3 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % contributions, expected 3', n; end if;

  ------------------------------------- a top-level contribution cannot be a reply
  begin
    insert into deliberation_comments (proposal_id, author_id, kind, body)
    values (pid, cara, 'reply', 'Just chiming in.');
    fails := fails + 1;
    raise warning 'FAIL: a reply with nothing to reply to was accepted';
  exception when check_violation then
    passes := passes + 1;
  end;

  ---------------------------------------------- and a reply cannot be a question
  begin
    insert into deliberation_comments (proposal_id, author_id, kind, body, parent_id)
    values (pid, cara, 'question', 'A question, but nested.', q);
    fails := fails + 1;
    raise warning 'FAIL: a nested question was accepted as a top-level kind';
  exception when check_violation then
    passes := passes + 1;
  end;

  insert into deliberation_comments (proposal_id, author_id, kind, body, parent_id)
  values (pid, cara, 'reply', 'The shed has the space.', q)
  returning id into reply;

  ------------------------------------------------------------- where it stands
  select open_questions into n from debate_standing(pid);
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % open questions, expected 1', n; end if;

  select contributions into n from debate_standing(pid);
  if n = 4 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % contributions counted, expected 4', n; end if;

  ---------------------------------- a reply is not an answer, however good it is
  select answered_at is null into ok_flag from deliberation_comments where id = q;
  if ok_flag then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a reply marked a question answered'; end if;

  ------------------------------------------------- an answer says something
  perform set_config('test.uid', ann::text, true);
  begin
    perform answer_contribution(q, 'the shed');
    fails := fails + 1;
    raise warning 'FAIL: an eight-character answer was accepted';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%an answer says something%' then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: wrong error on a short answer: %', msg; end if;
  end;

  perform answer_contribution(q, 'It lives in the shed, on the brackets Tom put up last spring.');

  select answered_by = ann and answered_at is not null
    into ok_flag from deliberation_comments where id = q;
  if ok_flag then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: answering did not attribute it'; end if;

  select open_questions into n from debate_standing(pid);
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % open questions after answering, expected 0', n; end if;

  ----------------------------------------------- and cannot be answered twice
  begin
    perform answer_contribution(q, 'Actually it lives somewhere else entirely now.');
    fails := fails + 1;
    raise warning 'FAIL: a question was answered twice';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%answered already%' then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: wrong error answering twice: %', msg; end if;
  end;

  --------------------------------------- an amendment is adopted, not answered
  begin
    perform answer_contribution(am, 'That is a reasonable change and we will make it.');
    fails := fails + 1;
    raise warning 'FAIL: an amendment was answered as though it were a question';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%question or a concern%' then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: wrong error answering an amendment: %', msg; end if;
  end;

  ---------------------------------------- and only the author or a steward adopts
  perform set_config('test.uid', dan::text, true);
  begin
    perform adopt_amendment(am);
    fails := fails + 1;
    raise warning 'FAIL: any member could adopt an amendment';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%author, or a steward%' then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: wrong error adopting: %', msg; end if;
  end;

  perform set_config('test.uid', ann::text, true);
  perform adopt_amendment(am);
  select adopted into n from debate_standing(pid);
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % adopted amendments, expected 1', n; end if;

  ------------------------------- adopting changes nothing about the proposal
  select body like '%wrong height%' into ok_flag from proposals where id = pid;
  if ok_flag then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: adopting an amendment altered the proposal text'; end if;

  -------------------------------------- an unanswered concern does NOT block
  insert into proposal_reads (proposal_id, profile_id) values (pid, ann);
  perform cast_resonance(pid, 0.80, 0.80, 0.60, null);
  perform set_config('test.uid', ben::text, true);
  insert into proposal_reads (proposal_id, profile_id) values (pid, ben);
  perform cast_resonance(pid, 0.78, 0.75, 0.55, null);
  perform set_config('test.uid', cara::text, true);
  insert into proposal_reads (proposal_id, profile_id) values (pid, cara);
  perform cast_resonance(pid, 0.82, 0.70, 0.60, null);
  perform set_config('test.uid', dan::text, true);
  insert into proposal_reads (proposal_id, profile_id) values (pid, dan);
  perform cast_resonance(pid, 0.76, 0.72, 0.50, null);

  perform set_config('test.uid', ann::text, true);
  outcome := close_proposal(pid);
  if outcome = 'passed' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: an unanswered concern blocked a proposal, got %', outcome; end if;

  ------------------------------------- but it is on the record that it was open
  select open_concerns into n from decisions where proposal_id = pid;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the decision recorded % open concerns, expected 1', n; end if;

  ------------------------------------ four people who agreed are not polarized
  select dispersion, polarized into v_disp, v_pol from decisions where proposal_id = pid;
  if not v_pol and v_disp < 0.1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a group that agreed was recorded as split (%, %)', v_disp, v_pol; end if;

  ---------------------------------------------------------------- a real split
  split := test_propose(ann, gid, 'local', null, 'Paint the front door red', 'x',
                        'The door is the first thing anyone sees and it is peeling.');
  insert into proposal_reviews (proposal_id, prompt_id, prompt_version, model, summary)
  values (split, 'proposal.review', '1.2.0', 'test', 'A reading.') returning id into rid;
  foreach l in array all_laws loop
    insert into law_assessments (proposal_id, review_id, law_id, verdict, reasoning,
                                 prompt_id, prompt_version, model)
    values (split, rid, l, 'aligned', 'clear', 'law.audit', '1.0.0', 'test');
  end loop;
  update proposals set status = 'in_deliberation' where id = split;

  -- Two at each end. The mean is 0.64, over the threshold, and it describes
  -- nobody in the room.
  insert into proposal_reads (proposal_id, profile_id) values (split, ann);
  perform cast_resonance(split, 0.95, 0.90, 0.60, 'Obviously yes.');
  perform set_config('test.uid', ben::text, true);
  insert into proposal_reads (proposal_id, profile_id) values (split, ben);
  perform cast_resonance(split, 0.98, 0.90, 0.60, 'Long overdue.');
  perform set_config('test.uid', cara::text, true);
  insert into proposal_reads (proposal_id, profile_id) values (split, cara);
  perform cast_resonance(split, 0.30, 0.95, 0.20, 'Absolutely not red.');
  perform set_config('test.uid', dan::text, true);
  insert into proposal_reads (proposal_id, profile_id) values (split, dan);
  perform cast_resonance(split, 0.32, 0.95, 0.20, 'Agreed, not red.');
  perform set_config('test.uid', ann::text, true);

  select dispersion, polarized into v_disp, v_pol from alignment_shape(split);
  if v_pol then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: two at each end was not detected as a split (spread %)', v_disp; end if;

  outcome := close_proposal(split);

  --------------------------------- a split proposal still passes on the rule
  if outcome = 'passed' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the split proposal was failed by something other than the rule, got %', outcome; end if;

  ------------------------------------- and the record says the group was split
  select polarized, dispersion into v_pol, v_disp from decisions where proposal_id = split;
  if v_pol and v_disp > 0.25 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the decision did not record the split (%, %)', v_disp, v_pol; end if;

  ---------------------------- the mean alone would have hidden it, and does not
  select avg_alignment > 0.618 into ok_flag from decisions where proposal_id = split;
  if ok_flag then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the split proposal did not clear the threshold on its mean'; end if;

  ------------------------------------------- a summary belongs to its proposal
  insert into debate_summaries (proposal_id, covers, polarization, reading,
                                prompt_id, prompt_version, model, created_by)
  values (pid, 4, 'converging', 'The disagreement is about the fund, not the ladder.',
          'debate.summary', '1.0.0', 'test', ann);

  perform set_config('test.uid', ben::text, true);
  select count(*) into n from debate_summaries where proposal_id = pid;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a member could not read the summary'; end if;

  ---------------------------------------- and cannot be edited after the fact
  begin
    update debate_summaries set polarization = 'splitting' where proposal_id = pid;
    if found then
      fails := fails + 1;
      raise warning 'FAIL: a summary was rewritten after it was published';
    else
      passes := passes + 1;
    end if;
  exception when insufficient_privilege then
    passes := passes + 1;
  end;

  raise notice ' ';
  raise notice '  Debate: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then
    raise exception '% checks failed', fails;
  end if;
end $$;

reset role;
