-- A law audit is ten readings, written by the server, of the text as it
-- stands (0051, rule 47).
--
-- Runs as `authenticated` with the grants Supabase gives that role, NOT as the
-- `app` fixture role the older suites use: what a signed-in member can do
-- through the API is the thing being tested. Opens with the exploit as it
-- stood on the live database on 12 October 2026 — no signing key, an insert
-- policy, and one row counted as an audit.
\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('a4545454-4545-4545-4545-45454545454a', 'lawint-ann@example.com'),
  ('b4545454-4545-4545-4545-45454545454b', 'lawint-ben@example.com');

create table test45 (slot text primary key, v uuid);
grant select on test45 to authenticated;

-- Setup, as the owner: a group, three proposals, a review on each.
do $$
declare
  ann uuid := 'a4545454-4545-4545-4545-45454545454a';
  ben uuid := 'b4545454-4545-4545-4545-45454545454b';
  gid uuid; code text; p uuid; k text; l text; n int; ok boolean;
  passes int := 0; fails int := 0;
begin
  perform set_config('test.uid', ann::text, true);
  gid := create_group('Law Integrity Test', 'x', 'local');
  code := create_invite(gid, 5, 14);
  perform set_config('test.uid', ben::text, true);
  perform redeem_invite(code);
  perform set_config('test.uid', ann::text, true);
  insert into test45 values ('gid', gid);

  foreach k in array array['main', 'moving', 'partial', 'tense'] loop
    p := test_propose(ann, gid, 'local', null, 'Integrity ' || k, 'Summary of ' || k || '.',
                      'The hall is booked twice a week by the same people (' || k || ').');
    insert into proposal_reviews (proposal_id, prompt_id, prompt_version, model, summary)
    values (p, 'proposal.review', '1.2.0', 'test', 'A reading.');
    update proposals set status = 'in_deliberation' where id = p;
    insert into test45 values (k, p);
  end loop;

  -- A legacy, partial audit: nine readings in force. Written as the owner,
  -- because nobody else can any more.
  select v into p from test45 t where t.slot = 'partial';
  foreach l in array (universal_law_ids())[1:9] loop
    insert into law_assessments (proposal_id, law_id, verdict, reasoning, prompt_id, prompt_version, model)
    values (p, l, 'aligned', 'legacy', 'law.audit', '1.0.0', 'test');
  end loop;

  -- The table itself refuses an eleventh law and a second reading in force.
  begin
    insert into law_assessments (proposal_id, law_id, verdict, reasoning, prompt_id, prompt_version, model)
    values (p, 'the_eleventh_law', 'aligned', 'x', 'law.audit', '1.0.0', 'test');
    fails := fails + 1; raise warning 'FAIL: the table took a law that does not exist';
  exception when check_violation then passes := passes + 1; end;

  begin
    insert into law_assessments (proposal_id, law_id, verdict, reasoning, prompt_id, prompt_version, model)
    values (p, 'sanctity_of_life', 'aligned', 'again', 'law.audit', '1.0.0', 'test');
    fails := fails + 1; raise warning 'FAIL: two readings of one law were in force at once';
  exception when unique_violation then passes := passes + 1; end;

  -- The hash is the database's, whatever the writer claims.
  begin
    insert into law_assessments (proposal_id, law_id, verdict, reasoning, prompt_id, prompt_version, model, audit_hash)
    values (p, 'continuous_evolution', 'aligned', 'x', 'law.audit', '1.0.0', 'test', repeat('0', 64));
    select count(*)::int into n from law_assessments
     where proposal_id = p and law_id = 'continuous_evolution' and audit_hash = proposal_audit_hash(p);
    if n = 1 then passes := passes + 1; else fails := fails + 1;
      raise warning 'FAIL: a writer chose the audit hash'; end if;
    raise exception 'rollback' using errcode = 'P0001';
  exception when sqlstate 'P0001' then null; end;

  raise notice ' ';
  raise notice '  Law audit integrity (table): % passed, % failed', passes, fails;
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;

---------------------------------------------------------------- no key: shut

set role authenticated;

do $$
declare
  ann uuid := 'a4545454-4545-4545-4545-45454545454a';
  ben uuid := 'b4545454-4545-4545-4545-45454545454b';
  pid uuid := (select v from test45 t where t.slot = 'main');
  pp  uuid := (select v from test45 t where t.slot = 'partial');
  clean jsonb; payload text; l text; msg text; s record;
  passes int := 0; fails int := 0;
begin
  select jsonb_agg(jsonb_build_object('law_id', x, 'verdict', 'aligned', 'reasoning', 'fine'))
    into clean from unnest(universal_law_ids()) x;

  -- THE EXPLOIT: the author writes their own clean audit.
  perform set_config('test.uid', ann::text, true);
  begin
    insert into law_assessments (proposal_id, law_id, verdict, reasoning, prompt_id, prompt_version, model)
    values (pid, 'sanctity_of_life', 'aligned', 'I checked it myself.', 'law.audit', '9.9.9', 'me');
    fails := fails + 1; raise warning 'FAIL: the author wrote their own law reading';
  exception when insufficient_privilege then passes := passes + 1; end;

  perform set_config('test.uid', ben::text, true);
  begin
    foreach l in array universal_law_ids() loop
      insert into law_assessments (proposal_id, law_id, verdict, reasoning, prompt_id, prompt_version, model)
      values (pid, l, 'aligned', 'Looks fine to me.', 'law.audit', '1.0.0', 'test');
    end loop;
    fails := fails + 1; raise warning 'FAIL: a member wrote ten law readings';
  exception when insufficient_privilege then passes := passes + 1; end;

  perform set_config('test.uid', ann::text, true);
  select * into s from law_standing(pid);
  if not s.audited and not s.lawful and s.laws_assessed = 0 then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: unaudited proposal reported audited/lawful'; end if;

  -- With no key the server cannot be told from a member, so nothing is
  -- recorded at all: unsigned through ai_write, or straight to the door.
  payload := jsonb_build_object('proposal_id', pid, 'readings', clean, 'prompt_id', 'law.audit',
                                'prompt_version', '1.0.0', 'model', 'test',
                                'audit_hash', proposal_audit_hash(pid), 'issued_at', now())::text;
  begin
    perform ai_write('law.audit', payload, null);
    fails := fails + 1; raise warning 'FAIL: an unsigned audit was recorded with no key';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%signing key is not set%' then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: wrong refusal: %', msg; end if;
  end;

  begin
    perform record_law_audit(payload, null);
    fails := fails + 1; raise warning 'FAIL: record_law_audit took an unsigned audit';
  exception when others then passes := passes + 1; end;

  -- The old challenge door, which took readings with no signature, is gone,
  -- and the inner helpers are not reachable by a member.
  if to_regprocedure('record_challenge_audit(uuid, jsonb, text, text, text)') is null
     and not has_function_privilege('authenticated', 'law_insert_readings(uuid, jsonb, uuid)', 'execute')
     and not has_function_privilege('authenticated', 'law_audit_payload(text, text, text)', 'execute')
     and not has_function_privilege('anon', 'record_law_audit(text, text)', 'execute')
     and not has_function_privilege('anon', 'record_challenge_audit(text, text)', 'execute')
     and not has_table_privilege('authenticated', 'law_assessments', 'insert')
     and not has_table_privilege('authenticated', 'law_assessments', 'update')
     and not has_table_privilege('authenticated', 'law_assessments', 'delete')
     and not has_table_privilege('authenticated', 'law_challenges', 'update')
     and not has_table_privilege('authenticated', 'law_challenges', 'delete')
     and not exists (select 1 from pg_policies where tablename = 'law_assessments'
                      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
                      and 'app' <> all (roles)) then
    passes := passes + 1;
  else
    fails := fails + 1; raise warning 'FAIL: a direct write path to law readings is still open';
  end if;

  -- Nine readings are not an audit, and cannot be closed on.
  select * into s from law_standing(pp);
  if not s.audited and s.stale and s.laws_assessed = 9 and not s.lawful then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: a nine-law audit counted (audited %, n %)', s.audited, s.laws_assessed; end if;

  begin
    perform close_proposal(pp);
    fails := fails + 1; raise warning 'FAIL: a proposal with nine readings was closed';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%not been audited%' then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: wrong refusal closing a partial audit: %', msg; end if;
  end;

  raise notice '  Law audit integrity (no key): % passed, % failed', passes, fails;
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;

reset role;

-------------------------------------------------------- key set: the real door

insert into private.ai_signing_key (secret) values ('law-integrity-test-secret-0051-xxxxxxxxx');

set role authenticated;

do $$
declare
  ann uuid := 'a4545454-4545-4545-4545-45454545454a';
  ben uuid := 'b4545454-4545-4545-4545-45454545454b';
  pid uuid := (select v from test45 t where t.slot = 'main');
  mv  uuid := (select v from test45 t where t.slot = 'moving');
  pp  uuid := (select v from test45 t where t.slot = 'partial');
  tp  uuid := (select v from test45 t where t.slot = 'tense');
  clean jsonb; tense jsonb; bad jsonb; base jsonb; sp record; s record; out jsonb;
  msg text; n int; aid uuid; chal uuid; old_hash text;
  passes int := 0; fails int := 0;

  -- what an honest server sends for a proposal
  procedure_base jsonb;
begin
  select jsonb_agg(jsonb_build_object('law_id', x, 'verdict', 'aligned', 'reasoning', 'Not engaged.'))
    into clean from unnest(universal_law_ids()) x;
  select jsonb_agg(jsonb_build_object('law_id', x,
           'verdict', case when x = 'reciprocity_and_mutual_care' then 'tension' else 'aligned' end,
           'reasoning', 'Read against the proposal.'))
    into tense from unnest(universal_law_ids()) x;

  perform set_config('test.uid', ann::text, true);
  base := jsonb_build_object('proposal_id', pid, 'prompt_id', 'law.audit', 'prompt_version', '1.0.0',
                             'model', 'test-model', 'provider', 'test-provider',
                             'audit_hash', proposal_audit_hash(pid));

  -- Every malformed audit is refused, signed or not. --------------------------
  -- 0, 9 and 11 readings
  foreach bad in array array[
      '[]'::jsonb,
      clean - 9,
      clean || jsonb_build_array(jsonb_build_object('law_id', 'sanctity_of_life', 'verdict', 'aligned', 'reasoning', 'x')),
      -- ten, with a duplicate standing in for a missing law
      (clean - 9) || jsonb_build_array(jsonb_build_object('law_id', 'sanctity_of_life', 'verdict', 'aligned', 'reasoning', 'x')),
      -- ten, one of them invented
      (clean - 9) || jsonb_build_array(jsonb_build_object('law_id', 'the_eleventh_law', 'verdict', 'aligned', 'reasoning', 'x')),
      -- ten, with a verdict that is not one
      (clean - 9) || jsonb_build_array(jsonb_build_object('law_id', 'continuous_evolution', 'verdict', 'fine', 'reasoning', 'x')),
      -- ten, one with no reasoning
      (clean - 9) || jsonb_build_array(jsonb_build_object('law_id', 'continuous_evolution', 'verdict', 'aligned', 'reasoning', '  ')),
      -- ten, one not even an object
      (clean - 9) || jsonb_build_array('continuous_evolution'::text)
    ] loop
    select * into sp from test_signed('law.audit', base || jsonb_build_object('readings', bad));
    begin
      perform ai_write('law.audit', sp.payload, sp.sig);
      fails := fails + 1; raise warning 'FAIL: a malformed audit was recorded: %', bad;
    exception when others then passes := passes + 1; end;
  end loop;

  select count(*)::int into n from law_assessments where proposal_id = pid;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: refused audits left % readings behind', n; end if;

  -- Wrong prompt, no model, the wrong text, a forged signature.
  select * into sp from test_signed('law.audit', base || jsonb_build_object('readings', clean, 'prompt_id', 'proposal.review'));
  begin perform ai_write('law.audit', sp.payload, sp.sig);
    fails := fails + 1; raise warning 'FAIL: an audit made with another prompt was recorded';
  exception when others then passes := passes + 1; end;

  select * into sp from test_signed('law.audit', base || jsonb_build_object('readings', clean, 'model', ''));
  begin perform ai_write('law.audit', sp.payload, sp.sig);
    fails := fails + 1; raise warning 'FAIL: an audit with no model was recorded';
  exception when others then passes := passes + 1; end;

  select * into sp from test_signed('law.audit', base || jsonb_build_object('readings', clean,
                                    'audit_hash', proposal_audit_hash(mv)));
  begin perform ai_write('law.audit', sp.payload, sp.sig);
    fails := fails + 1; raise warning 'FAIL: an audit of a different text was recorded';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%changed since it was read%' then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: wrong refusal for a stale hash: %', msg; end if;
  end;

  select * into sp from test_signed('law.audit', base || jsonb_build_object('readings', clean));
  begin perform record_law_audit(sp.payload, repeat('ab', 32));
    fails := fails + 1; raise warning 'FAIL: a forged signature was accepted';
  exception when others then passes := passes + 1; end;

  -- A signature for one kind does not open the other door.
  begin perform record_challenge_audit(sp.payload, sp.sig);
    fails := fails + 1; raise warning 'FAIL: an audit signature opened the challenge door';
  exception when others then passes := passes + 1; end;

  -- The honest audit, with one tension. ----------------------------------------
  select * into sp from test_signed('law.audit', base || jsonb_build_object('readings', tense));
  out := ai_write('law.audit', sp.payload, sp.sig);
  aid := (out->>'audit_id')::uuid;

  select * into s from law_standing(pid);
  if s.audited and s.laws_assessed = 10 and s.unanswered_tensions = 1 and s.violations = 0
     and not s.lawful and not s.stale then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: honest audit standing wrong: %', row_to_json(s); end if;

  -- Provenance came from the signed payload, all ten under one audit id.
  select count(*)::int into n from law_assessments
   where proposal_id = pid and superseded_at is null and audit_id = aid
     and audit_hash = proposal_audit_hash(pid) and prompt_id = 'law.audit'
     and prompt_version = '1.0.0' and model = 'test-model' and provider = 'test-provider'
     and issued_at is not null and challenge_id is null;
  if n = 10 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: provenance missing on % of 10 readings', 10 - n; end if;

  if exists (select 1 from ledger_events where kind = 'law.audited' and subject_id = pid) then
    passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: the audit is not on the ledger'; end if;

  -- A complete audit of the current text is not re-run to get a better answer.
  select * into sp from test_signed('law.audit', base || jsonb_build_object('readings', clean));
  begin perform ai_write('law.audit', sp.payload, sp.sig);
    fails := fails + 1; raise warning 'FAIL: a second audit replaced a complete one';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%challenge a reading instead%' then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: wrong refusal for a second audit: %', msg; end if;
  end;

  -- Nobody edits or removes a reading, author or member.
  begin
    update law_assessments set verdict = 'aligned', resolution = 'It is fine, really, trust me.',
           resolved_at = now(), resolved_by = ann
     where proposal_id = pid and verdict = 'tension';
    fails := fails + 1; raise warning 'FAIL: the author rewrote a tension';
  exception when insufficient_privilege then passes := passes + 1; end;

  begin
    delete from law_assessments where proposal_id = pid and verdict = 'tension';
    fails := fails + 1; raise warning 'FAIL: the author deleted a tension';
  exception when insufficient_privilege then passes := passes + 1; end;

  -- An unanswered tension blocks passage (on its own proposal, so this one
  -- stays open for the challenge below).
  select * into sp from test_signed('law.audit',
    jsonb_build_object('proposal_id', tp, 'prompt_id', 'law.audit', 'prompt_version', '1.0.0',
                       'model', 'test-model', 'audit_hash', proposal_audit_hash(tp), 'readings', tense));
  perform ai_write('law.audit', sp.payload, sp.sig);
  begin
    perform close_proposal(tp);
    select status::text into msg from proposals where id = tp;
    if msg = 'failed' then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: closed with an open tension as %', msg; end if;
  exception when others then
    get stacked diagnostics msg = message_text;
    fails := fails + 1; raise warning 'FAIL: closing with an open tension errored instead of failing: %', msg;
  end;

  -- A text that moves after its audit is no longer audited. -------------------
  select * into sp from test_signed('law.audit',
    jsonb_build_object('proposal_id', mv, 'prompt_id', 'law.audit', 'prompt_version', '1.0.0',
                       'model', 'test-model', 'audit_hash', proposal_audit_hash(mv), 'readings', clean));
  perform ai_write('law.audit', sp.payload, sp.sig);
  select * into s from law_standing(mv);
  if s.audited and s.lawful then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: clean audit of the moving proposal did not count'; end if;

  old_hash := proposal_audit_hash(mv);
  update proposals set summary = 'A different summary, after the audit.' where id = mv;
  if proposal_audit_hash(mv) is distinct from old_hash then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: the summary is not in the audit hash'; end if;

  select * into s from law_standing(mv);
  if not s.audited and s.stale and not s.lawful then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: a stale audit still counted'; end if;

  begin
    perform close_proposal(mv);
    fails := fails + 1; raise warning 'FAIL: closed on a stale audit';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%not been audited%' then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: wrong refusal closing a stale audit: %', msg; end if;
  end;

  -- The old reading cannot be replayed; a fresh one of the new text replaces it.
  begin perform ai_write('law.audit', sp.payload, sp.sig);
    fails := fails + 1; raise warning 'FAIL: the old audit was replayed onto new text';
  exception when others then passes := passes + 1; end;

  select * into sp from test_signed('law.audit',
    jsonb_build_object('proposal_id', mv, 'prompt_id', 'law.audit', 'prompt_version', '1.0.0',
                       'model', 'test-model', 'audit_hash', proposal_audit_hash(mv), 'readings', clean));
  perform ai_write('law.audit', sp.payload, sp.sig);
  select * into s from law_standing(mv);
  select count(*)::int into n from law_assessments where proposal_id = mv and superseded_at is not null;
  if s.audited and n = 10 then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: fresh audit of new text (audited %, superseded %)', s.audited, n; end if;

  -- The partial audit gives way to a complete one, all at once.
  select * into sp from test_signed('law.audit',
    jsonb_build_object('proposal_id', pp, 'prompt_id', 'law.audit', 'prompt_version', '1.0.0',
                       'model', 'test-model', 'audit_hash', proposal_audit_hash(pp), 'readings', clean));
  perform ai_write('law.audit', sp.payload, sp.sig);
  select * into s from law_standing(pp);
  if s.audited and s.laws_assessed = 10 then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: the partial audit was not replaced'; end if;

  -- A challenge re-audits; the challenger never writes a verdict. --------------
  perform set_config('test.uid', ben::text, true);
  insert into law_challenges (assessment_id, proposal_id, challenger_id, argument)
  select id, pid, ben, 'The booking rota already shares the load, so reciprocity is not strained here.'
    from law_assessments where proposal_id = pid and verdict = 'tension' and superseded_at is null
  returning id into chal;

  begin
    update law_challenges set answered_at = now() where id = chal;
    fails := fails + 1; raise warning 'FAIL: the challenger marked their own challenge answered';
  exception when insufficient_privilege then passes := passes + 1; end;

  begin
    update law_assessments set verdict = 'aligned' where proposal_id = pid and verdict = 'tension';
    fails := fails + 1; raise warning 'FAIL: the challenger rewrote the verdict';
  exception when insufficient_privilege then passes := passes + 1; end;

  -- A malformed re-audit is refused and the readings in force stand.
  select * into sp from test_signed('law.challenge',
    jsonb_build_object('challenge_id', chal, 'prompt_id', 'law.audit', 'prompt_version', '1.0.0',
                       'model', 'test-model', 'audit_hash', proposal_audit_hash(pid), 'readings', clean - 0));
  begin perform ai_write('law.challenge', sp.payload, sp.sig);
    fails := fails + 1; raise warning 'FAIL: a nine-law re-audit was accepted';
  exception when others then passes := passes + 1; end;
  select * into s from law_standing(pid);
  if s.unanswered_tensions = 1 then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: a refused re-audit moved the readings'; end if;

  -- Somebody else cannot spend Ben's challenge.
  perform set_config('test.uid', ann::text, true);
  select * into sp from test_signed('law.challenge',
    jsonb_build_object('challenge_id', chal, 'prompt_id', 'law.audit', 'prompt_version', '1.0.0',
                       'model', 'test-model', 'audit_hash', proposal_audit_hash(pid), 'readings', clean));
  begin perform ai_write('law.challenge', sp.payload, sp.sig);
    fails := fails + 1; raise warning 'FAIL: the author spent somebody else''s challenge';
  exception when others then passes := passes + 1; end;

  -- The signed re-audit, which this time reads the law differently.
  perform set_config('test.uid', ben::text, true);
  select * into sp from test_signed('law.challenge',
    jsonb_build_object('challenge_id', chal, 'prompt_id', 'law.audit', 'prompt_version', '1.0.0',
                       'model', 'test-model', 'audit_hash', proposal_audit_hash(pid), 'readings', clean));
  out := ai_write('law.challenge', sp.payload, sp.sig);

  select count(*)::int into n from law_assessments
   where proposal_id = pid and superseded_at is null and challenge_id = chal
     and audit_id = (out->>'audit_id')::uuid;
  if n = 10 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the re-audit is not traceable to its challenge (% of 10)', n; end if;

  select count(*)::int into n from law_assessments
   where proposal_id = pid and audit_id = aid and superseded_at is not null;
  if n = 10 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the first audit was not kept as history'; end if;

  if exists (select 1 from law_challenges where id = chal and answered_at is not null)
     and exists (select 1 from ledger_events where kind = 'law.reaudited' and subject_id = pid) then
    passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: the re-audit is not recorded on the challenge and ledger'; end if;

  begin perform ai_write('law.challenge', sp.payload, sp.sig);
    fails := fails + 1; raise warning 'FAIL: one challenge produced two re-audits';
  exception when others then passes := passes + 1; end;

  raise notice '  Law audit integrity (signed): % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;

reset role;
delete from private.ai_signing_key;
drop table test45;
