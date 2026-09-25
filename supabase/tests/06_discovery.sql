-- Discovery: what is waiting on you, and what deserves another look.
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
  ('d1111111-1111-1111-1111-11111111111d', 'disc1@example.com'),
  ('d2222222-2222-2222-2222-22222222222d', 'disc2@example.com'),
  ('d3333333-3333-3333-3333-33333333333d', 'disc3@example.com');

-- The rule at local scale ships at one voice so a new instance can get through
-- a decision on day one. This suite is about what happens when a proposal is
-- below the floor, so raise it here — as the owner, because scope_rules has no
-- update policy and no member of an instance can change it.
update scope_rules set min_voices = 3 where scope = 'local';

set role app;

do $$
declare
  ann  uuid := 'd1111111-1111-1111-1111-11111111111d';
  ben  uuid := 'd2222222-2222-2222-2222-22222222222d';
  cara uuid := 'd3333333-3333-3333-3333-33333333333d';
  unaudited uuid; flagged uuid; unread uuid; answered uuid;
  dormant uuid; rejected uuid; revived uuid;
  rid uuid; msg text; n int; ok_flag boolean; outcome decision_outcome;
  passes int := 0; fails int := 0;
  all_laws text[] := array[
    'sanctity_of_life','truth_and_transparency','sovereignty_of_the_individual',
    'equity_and_justice','subsidiarity','reciprocity_and_mutual_care',
    'stewardship_of_earth','harmony_of_diversity','right_use_of_power',
    'continuous_evolution'];
  l text;
begin
  ---------------------------------------------------------------- a street
  perform set_config('test.uid', ann::text, true);
  update profiles set place_local = 'Peckham', place_set_at = now() where id = ann;
  perform set_config('test.uid', ben::text, true);
  update profiles set place_local = 'Peckham', place_set_at = now() where id = ben;
  perform set_config('test.uid', cara::text, true);
  update profiles set place_local = 'Deptford', place_set_at = now() where id = cara;

  perform set_config('test.uid', ann::text, true);

  -------------------------------------------- one of each thing that can wait
  unaudited := test_propose(ann, null, 'local', 'Peckham', 'No audit yet', 'x',
                            'The gate at the end sticks and nobody can shut it.');

  unread := test_propose(ann, null, 'local', 'Peckham', 'Reviewed, unread', 'x',
                         'The recycling bins are never brought back in.');
  insert into proposal_reviews (proposal_id, prompt_id, prompt_version, model, summary)
  values (unread, 'proposal.review', '1.2.0', 'test', 'A reading.');
  foreach l in array all_laws loop
    insert into law_assessments (proposal_id, law_id, verdict, reasoning,
                                 prompt_id, prompt_version, model)
    values (unread, l, 'aligned', 'clear', 'law.audit', '1.0.0', 'test');
  end loop;

  flagged := test_propose(ann, null, 'local', 'Peckham', 'Has an open flag', 'x',
                          'The lighting on the path fails every winter.');
  insert into proposal_reviews (proposal_id, prompt_id, prompt_version, model, summary)
  values (flagged, 'proposal.review', '1.2.0', 'test', 'A reading.') returning id into rid;
  foreach l in array all_laws loop
    insert into law_assessments (proposal_id, review_id, law_id, verdict, reasoning,
                                 prompt_id, prompt_version, model)
    values (flagged, rid, l, 'aligned', 'clear', 'law.audit', '1.0.0', 'test');
  end loop;
  insert into proposal_flags (proposal_id, review_id, kind, label, severity, detail)
  values (flagged, rid, 'risk', 'Nobody has agreed to maintain it', 'high', 'n');

  answered := test_propose(ann, null, 'local', 'Peckham', 'Answered already', 'x',
                           'The noticeboard is out of date every single week.');
  insert into proposal_reviews (proposal_id, prompt_id, prompt_version, model, summary)
  values (answered, 'proposal.review', '1.2.0', 'test', 'A reading.');
  foreach l in array all_laws loop
    insert into law_assessments (proposal_id, law_id, verdict, reasoning,
                                 prompt_id, prompt_version, model)
    values (answered, l, 'aligned', 'clear', 'law.audit', '1.0.0', 'test');
  end loop;
  update proposals set status = 'in_deliberation' where id = answered;
  insert into proposal_reads (proposal_id, profile_id) values (answered, ann);
  perform cast_resonance(answered, 0.8, 0.8, 0.8, null);

  ---------------------------------------- the queue is ordered by what blocks
  select proposal_id into unaudited from attention_queue(null, 'local') limit 1;
  if unaudited is not null then
    select reason into msg from attention_queue(null, 'local') limit 1;
    if msg = 'not audited yet' then passes := passes + 1; else fails := fails + 1;
      raise warning 'FAIL: the queue led with "%" rather than the unaudited one', msg; end if;
  else
    fails := fails + 1; raise warning 'FAIL: the attention queue is empty';
  end if;

  ------------------------------------- everything open is in it, once each
  select count(*) into n from attention_queue(null, 'local');
  if n = 4 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % rows in the queue, expected 4', n; end if;

  ------------------------------------- a proposal you answered sinks, with a
  ------------------------------------- reason that says so
  select reason, weight into msg, n from attention_queue(null, 'local')
   where proposal_id = answered;
  if msg = 'waiting on other people' and n = 9 then passes := passes + 1;
  else fails := fails + 1;
    raise warning 'FAIL: an answered proposal read "%" at weight %', msg, n; end if;

  ------------------------------------- the flagged one names the flag
  select reason into msg from attention_queue(null, 'local') where proposal_id = flagged;
  if msg like '%critical flag%' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the flagged proposal read "%"', msg; end if;

  ------------------------------------- the reviewed-but-unread one says so
  select reason into msg from attention_queue(null, 'local') where proposal_id = unread;
  if msg like '%not read the review%' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the unread proposal read "%"', msg; end if;

  ------------------------------------- another street sees none of it
  perform set_config('test.uid', cara::text, true);
  select count(*) into n from attention_queue(null, 'local');
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: Deptford had % Peckham proposals in its queue', n; end if;
  perform set_config('test.uid', ann::text, true);

  ------------------------------------------------------------------ dormant
  -- Nobody turned up, and the one person who did was in favour.
  dormant := test_propose(ann, null, 'local', 'Peckham', 'Nobody came', 'x',
                          'The corner is used for flytipping and it has got worse.');
  insert into proposal_reviews (proposal_id, prompt_id, prompt_version, model, summary)
  values (dormant, 'proposal.review', '1.2.0', 'test', 'A reading.');
  foreach l in array all_laws loop
    insert into law_assessments (proposal_id, law_id, verdict, reasoning,
                                 prompt_id, prompt_version, model)
    values (dormant, l, 'aligned', 'clear', 'law.audit', '1.0.0', 'test');
  end loop;
  update proposals set status = 'in_deliberation' where id = dormant;
  insert into proposal_reads (proposal_id, profile_id) values (dormant, ann);
  perform cast_resonance(dormant, 0.90, 0.80, 0.70, null);

  -- One voice, and the floor at this scale is three.
  outcome := close_proposal(dormant);
  if outcome = 'failed' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a proposal below the voice floor did not fail'; end if;

  select count(*) into n from dormant_proposals(null, 'local');
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % dormant proposals, expected 1', n; end if;

  select why into msg from dormant_proposals(null, 'local') limit 1;
  if msg like '%Not enough people%' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the dormant reason read "%"', msg; end if;

  ---------------------------- a proposal people considered and declined is NOT
  rejected := test_propose(ann, null, 'local', 'Peckham', 'Considered and declined', 'x',
                           'The parking bay should be given over to a planter instead.');
  insert into proposal_reviews (proposal_id, prompt_id, prompt_version, model, summary)
  values (rejected, 'proposal.review', '1.2.0', 'test', 'A reading.');
  foreach l in array all_laws loop
    insert into law_assessments (proposal_id, law_id, verdict, reasoning,
                                 prompt_id, prompt_version, model)
    values (rejected, l, 'aligned', 'clear', 'law.audit', '1.0.0', 'test');
  end loop;
  update proposals set status = 'in_deliberation' where id = rejected;
  insert into proposal_reads (proposal_id, profile_id) values (rejected, ann);
  perform cast_resonance(rejected, 0.20, 0.90, 0.30, 'Not this.');
  perform set_config('test.uid', ben::text, true);
  insert into proposal_reads (proposal_id, profile_id) values (rejected, ben);
  perform cast_resonance(rejected, 0.15, 0.90, 0.20, 'Agreed, no.');
  perform set_config('test.uid', ann::text, true);

  -- Two voices, still under the floor — but read and declined, which is why it
  -- does not come back as dormant.
  outcome := close_proposal(rejected);

  select count(*) into n from dormant_proposals(null, 'local')
   where proposal_id = rejected;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a proposal people read and declined was offered back as dormant'; end if;

  ------------------------------- you cannot re-aim it at a different audience
  perform set_config('test.uid', cara::text, true);
  begin
    insert into proposal_readiness (author_id, body_sha256, readiness, verdict,
                                    prompt_id, prompt_version, model)
    values (cara, proposal_body_hash('Deptford take on the Peckham corner.'), 0.900,
            'Sharpened in a test.', 'proposal.sharpen', '1.0.0', 'test');

    insert into proposals (author_id, title, summary, body,
                           intent, change, constraints, risks, alternatives,
                           scope, place, supersedes)
    values (cara, 'Moved to Deptford', 'x', 'Deptford take on the Peckham corner.',
            'A problem stated at sufficient length to clear the section constraint here.',
            'A change stated at sufficient length to clear the section constraint here.',
            'It takes 4 hours and £40, and depends on nobody.',
            'It might not work, and three months of nothing would say so clearly.',
            'Doing nothing was considered and rejected.',
            'local', 'Deptford', dormant);
    fails := fails + 1;
    raise warning 'FAIL: a dormant proposal was taken up in a different place';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%same people%' or msg like '%not addressed to you%' then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: wrong error re-aiming a revival: %', msg; end if;
  end;
  perform set_config('test.uid', ann::text, true);

  --------------------------------- a taken-up proposal drops out of dormant
  insert into proposal_readiness (author_id, body_sha256, readiness, verdict,
                                  prompt_id, prompt_version, model)
  values (ann, proposal_body_hash('The corner again, with somebody to empty it.'), 0.880,
          'Sharpened in a test.', 'proposal.sharpen', '1.0.0', 'test');

  insert into proposals (author_id, title, summary, body,
                         intent, change, constraints, risks, alternatives,
                         scope, place, supersedes)
  values (ann, 'The corner, again', 'Second attempt.',
          'The corner again, with somebody to empty it.',
          'A problem stated at sufficient length to clear the section constraint here.',
          'A change stated at sufficient length to clear the section constraint here.',
          'It takes 4 hours and £40, and depends on nobody.',
          'It might not work, and three months of nothing would say so clearly.',
          'Doing nothing was considered and rejected.',
          'local', 'Peckham', dormant)
  returning id into revived;

  select count(*) into n from dormant_proposals(null, 'local') where proposal_id = dormant;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a proposal already taken up again was still offered as dormant'; end if;

  select supersedes = dormant into ok_flag from proposals where id = revived;
  if ok_flag then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the thread back to the first attempt was not kept'; end if;

  ------------------------------------------------------------- signal feed
  select count(*) into n from signal_feed(null, 'local');
  if n >= 2 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % events in the signal feed, expected the decisions', n; end if;

  select count(*) into n from signal_feed(null, 'local') where kind = 'proposal.decided';
  if n = 2 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % decisions in the signal feed, expected 2', n; end if;

  perform set_config('test.uid', cara::text, true);
  select count(*) into n from signal_feed(null, 'local');
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: Deptford saw % of Peckham''s record', n; end if;

  raise notice ' ';
  raise notice '  Discovery: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then
    raise exception '% checks failed', fails;
  end if;
end $$;

reset role;

-- Put it back, so a suite run out of order finds the shipped rule.
update scope_rules set min_voices = 1 where scope = 'local';
