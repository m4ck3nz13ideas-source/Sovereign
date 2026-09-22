-- Readiness: nothing is put to anyone until it has been thought through.
--
-- Written out by hand rather than through test_propose(), because the point of
-- every case here is the refusal, and a helper that always satisfies the rule
-- cannot show the rule biting.
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
  ('a1111111-1111-1111-1111-11111111111a', 'ready1@example.com'),
  ('b2222222-2222-2222-2222-22222222222b', 'ready2@example.com');

set role app;

do $$
declare
  ida  uuid := 'a1111111-1111-1111-1111-11111111111a';
  idb  uuid := 'b2222222-2222-2222-2222-22222222222b';
  gid uuid; pid uuid; code text;
  msg text; n int; ok_flag boolean;
  passes int := 0; fails int := 0;

  good_intent  text := 'The alley behind the terrace is used as a cut-through and somebody is nearly hit most weeks.';
  good_change  text := 'Two bollards at the north end, so it stays walkable and stops being a road. Fitted before the end of March.';
  good_costs   text := 'About £240 for the bollards and 6 hours of fitting. It depends on the council not objecting.';
  good_risks   text := 'The council may refuse, and the cut-through may simply move to the next street. If either happens by June this has not worked.';
  good_alts    text := 'Doing nothing was considered: the problem recurs weekly, so it was rejected. Signage alone was considered and is ignored elsewhere.';

  body_of      text;
  body_b       text;
  body_c       text;

  -- Each case needs its own text: a reading is bound to a body, and the lowest
  -- reading of a body governs, so a refusal recorded against one draft would
  -- otherwise follow every later case using the same words.
  drafted      text;
begin
  perform set_config('test.uid', ida::text, true);
  gid := create_group('Readiness Test', 'x', 'local');
  code := create_invite(gid, 5, 14);
  perform set_config('test.uid', idb::text, true);
  perform redeem_invite(code);
  perform set_config('test.uid', ida::text, true);

  body_of :=
    '## What this is solving'      || chr(10) || good_intent || chr(10) || chr(10) ||
    '## What would change'         || chr(10) || good_change || chr(10) || chr(10) ||
    '## What it takes'             || chr(10) || good_costs  || chr(10) || chr(10) ||
    '## What could go wrong'       || chr(10) || good_risks  || chr(10) || chr(10) ||
    '## What else was considered'  || chr(10) || good_alts;

  body_b := body_of || chr(10) || chr(10) || 'A second draft, otherwise identical.';
  body_c := body_of || chr(10) || chr(10) || 'A third draft, otherwise identical.';

  ------------------------------------------ nothing goes in unsharpened
  begin
    insert into proposals (group_id, author_id, title, summary, body,
                           intent, change, constraints, risks, alternatives)
    values (gid, ida, 'Bollards', 'Two of them.', body_of,
            good_intent, good_change, good_costs, good_risks, good_alts);
    fails := fails + 1;
    raise warning 'FAIL: a proposal was submitted with no sharpening at all';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%has not been sharpened%' then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: wrong error with no sharpening: %', msg; end if;
  end;

  ------------------------------------------ a low score is not a submission
  insert into proposal_readiness (author_id, body_sha256, readiness, verdict,
                                  prompt_id, prompt_version, model)
  values (ida, proposal_body_hash(body_of), 0.550,
          'Not ready: the costs are not numbered.', 'proposal.sharpen', '1.0.0', 'test');

  begin
    insert into proposals (group_id, author_id, title, summary, body,
                           intent, change, constraints, risks, alternatives)
    values (gid, ida, 'Bollards', 'Two of them.', body_of,
            good_intent, good_change, good_costs, good_risks, good_alts);
    fails := fails + 1;
    raise warning 'FAIL: a draft scoring 0.55 was submitted';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%0.550%' and msg like '%0.700%' then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: wrong error below threshold: %', msg; end if;
  end;

  ------------------------------- a reading of a different text does not count
  insert into proposal_readiness (author_id, body_sha256, readiness, verdict,
                                  prompt_id, prompt_version, model)
  values (ida, proposal_body_hash('Some entirely different draft that was sharpened instead.'),
          0.910, 'Ready.', 'proposal.sharpen', '1.0.0', 'test');

  begin
    insert into proposals (group_id, author_id, title, summary, body,
                           intent, change, constraints, risks, alternatives)
    values (gid, ida, 'Bollards', 'Two of them.', body_b,
            good_intent, good_change, good_costs, good_risks, good_alts);
    fails := fails + 1;
    raise warning 'FAIL: a sharpening of a different draft was accepted';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%has not been sharpened%' then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: wrong error on a mismatched hash: %', msg; end if;
  end;

  ------------------------------------- somebody else's reading does not count
  perform set_config('test.uid', idb::text, true);
  insert into proposal_readiness (author_id, body_sha256, readiness, verdict,
                                  prompt_id, prompt_version, model)
  values (idb, proposal_body_hash(body_c), 0.950, 'Ready.',
          'proposal.sharpen', '1.0.0', 'test');
  perform set_config('test.uid', ida::text, true);

  begin
    insert into proposals (group_id, author_id, title, summary, body,
                           intent, change, constraints, risks, alternatives)
    values (gid, ida, 'Bollards', 'Two of them.', body_c,
            good_intent, good_change, good_costs, good_risks, good_alts);
    fails := fails + 1;
    raise warning 'FAIL: one member submitted on another member''s sharpening';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%has not been sharpened%' then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: wrong error on another author''s reading: %', msg; end if;
  end;

  ---------------------------------------- nobody can record it for you either
  begin
    insert into proposal_readiness (author_id, body_sha256, readiness, verdict,
                                    prompt_id, prompt_version, model)
    values (idb, proposal_body_hash(body_c), 0.990, 'Ready.',
            'proposal.sharpen', '1.0.0', 'test');
    fails := fails + 1;
    raise warning 'FAIL: a sharpening was recorded in another member''s name';
  exception when insufficient_privilege then
    passes := passes + 1;
  end;

  ------------------------------------------------- an empty section is refused
  insert into proposal_readiness (author_id, body_sha256, readiness, verdict,
                                  prompt_id, prompt_version, model)
  values (ida, proposal_body_hash('short'), 0.990, 'Ready.',
          'proposal.sharpen', '1.0.0', 'test');

  begin
    insert into proposals (group_id, author_id, title, summary, body,
                           intent, change, constraints, risks, alternatives)
    values (gid, ida, 'Bollards', 'Two of them.', 'short',
            good_intent, good_change, good_costs, good_risks, '');
    fails := fails + 1;
    raise warning 'FAIL: a proposal with no alternatives section was accepted';
  exception when check_violation then
    passes := passes + 1;
  end;

  ----------------------------- asking twice cannot raise where you stand
  insert into proposal_readiness (author_id, body_sha256, readiness, verdict,
                                  prompt_id, prompt_version, model)
  values (ida, proposal_body_hash(body_of), 0.990,
          'Ready, on a second ask.', 'proposal.sharpen', '1.0.0', 'test');

  begin
    insert into proposals (group_id, author_id, title, summary, body,
                           intent, change, constraints, risks, alternatives)
    values (gid, ida, 'Bollards', 'Two of them.', body_of,
            good_intent, good_change, good_costs, good_risks, good_alts);
    fails := fails + 1;
    raise warning 'FAIL: re-sharpening the same text talked past a 0.55';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%0.550%' then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: wrong error on a re-roll: %', msg; end if;
  end;

  -------------------------------------------------------- and now, properly
  drafted := body_of || chr(10) || chr(10) || 'Rewritten after the first reading.';

  insert into proposal_readiness (author_id, body_sha256, readiness, verdict,
                                  sections, prompt_id, prompt_version, model)
  values (ida, proposal_body_hash(drafted), 0.860,
          'Ready. The costs are numbered and doing nothing was weighed.',
          '[{"section":"intent","ready":true,"note":"A real problem.","questions":[]}]'::jsonb,
          'proposal.sharpen', '1.0.0', 'test');

  insert into proposals (group_id, author_id, title, summary, body,
                         intent, change, constraints, risks, alternatives)
  values (gid, ida, 'Bollards', 'Two of them.', drafted,
          good_intent, good_change, good_costs, good_risks, good_alts)
  returning id into pid;

  if pid is not null then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a sharpened proposal was refused'; end if;

  ------------------------------------------ the score is stamped on the record
  select readiness = 0.860 and body_sha256 = proposal_body_hash(drafted)
    into ok_flag from proposals where id = pid;
  if ok_flag then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the readiness was not stamped onto the proposal'; end if;

  ------------------------------------------------ and the reading is attached
  select count(*) into n from proposal_readiness where proposal_id = pid;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % readings attached to the proposal, expected 1', n; end if;

  ------------------------------- it cannot be spent twice on a second proposal
  begin
    insert into proposals (group_id, author_id, title, summary, body,
                           intent, change, constraints, risks, alternatives)
    values (gid, ida, 'Bollards again', 'The same thing.', drafted,
            good_intent, good_change, good_costs, good_risks, good_alts);
    fails := fails + 1;
    raise warning 'FAIL: one sharpening was spent on two proposals';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%has not been sharpened%' then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: wrong error reusing a reading: %', msg; end if;
  end;

  ----------------------------------------- the text is fixed after submission
  begin
    update proposals set intent = 'Something else entirely, now that people have read it.'
     where id = pid;
    fails := fails + 1;
    raise warning 'FAIL: the author rewrote a submitted proposal';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%fixed at submission%' then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: wrong error editing the text: %', msg; end if;
  end;

  begin
    update proposals set readiness = 0.999 where id = pid;
    fails := fails + 1;
    raise warning 'FAIL: the author raised their own readiness score after the fact';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%fixed at submission%' then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: wrong error editing readiness: %', msg; end if;
  end;

  ----------------------------------- withdrawing still works, which is the
  ----------------------------------- point of freezing text and not status
  update proposals set status = 'withdrawn', closed_at = now() where id = pid;
  select status = 'withdrawn' into ok_flag from proposals where id = pid;
  if ok_flag then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: freezing the text also blocked withdrawal'; end if;

  ------------------------------ an unattached reading stays private to its author
  perform set_config('test.uid', idb::text, true);
  select count(*) into n from proposal_readiness where proposal_id is null and author_id = ida;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: another member read % of an author''s draft sharpenings', n; end if;

  ------------------------------------ but an attached one is part of the record
  select count(*) into n from proposal_readiness where proposal_id = pid;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a group member could not read the sharpening on a submitted proposal'; end if;

  raise notice ' ';
  raise notice '  Readiness: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then
    raise exception '% checks failed', fails;
  end if;
end $$;

reset role;
