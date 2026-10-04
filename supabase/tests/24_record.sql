-- The record (0029): what was said, raised or read stays said, raised or read.
--
-- The hole this closes was an UPDATE policy whose `with check` insisted on a
-- signed answer and could not see what else the same statement changed. So the
-- first check here is the exploit itself: a member sending one update that
-- signs an answer AND rewrites a verdict.
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
  ('4b000001-0000-0000-0000-000000000000', 'rec1@example.com'),
  ('4b000002-0000-0000-0000-000000000000', 'rec2@example.com');

set role app;

do $$
declare
  ann uuid := '4b000001-0000-0000-0000-000000000000';
  ben uuid := '4b000002-0000-0000-0000-000000000000';
  gid uuid; code text; pid uuid; rid uuid; aid uuid; tid uuid; fid uuid;
  cid uuid; cid2 uuid; cid3 uuid; l text;
  n int; t text;
  passes int := 0; fails int := 0;
  signed text := 'We considered this at the meeting and think it is acceptable as written.';
begin
  perform set_config('test.uid', ann::text, true);
  gid := create_group('Record Close', 'Keeping what was said', 'local');
  code := create_invite(gid, 5, 14);
  perform set_config('test.uid', ben::text, true);
  perform redeem_invite(code);

  perform set_config('test.uid', ann::text, true);
  pid := test_propose(ann, gid, 'local', null, 'Close the lane on Sundays',
                      'For the children.', 'The lane is busy and the children play in it on Sundays.');
  insert into proposal_reviews (proposal_id, prompt_id, prompt_version, model, summary)
  values (pid, 'proposal.review', '1.2.0', 'test', 'A reading.') returning id into rid;

  insert into law_assessments (proposal_id, review_id, law_id, verdict, reasoning,
                               prompt_id, prompt_version, model)
  values (pid, rid, 'sovereignty_of_the_individual', 'violation',
          'It stops residents driving to their own homes.', 'law.audit', '1.0.0', 'test')
  returning id into aid;
  insert into law_assessments (proposal_id, review_id, law_id, verdict, reasoning,
                               prompt_id, prompt_version, model)
  values (pid, rid, 'subsidiarity', 'tension',
          'The council may own the lane.', 'law.audit', '1.0.0', 'test')
  returning id into tid;

  insert into proposal_flags (proposal_id, review_id, kind, label, severity, detail)
  values (pid, rid, 'risk', 'Access for emergency vehicles', 'critical', 'Nobody says how.')
  returning id into fid;

  update proposals set status = 'in_deliberation' where id = pid;

  ------------------------------------------------------------- the exploit
  perform set_config('test.uid', ben::text, true);
  begin
    update law_assessments
       set verdict = 'aligned', resolution = signed, resolved_at = now(), resolved_by = ben
     where id = aid;
  exception when others then null;
  end;
  select verdict::text into t from law_assessments where id = aid;
  if t = 'violation' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a member rewrote a violation to % by signing an answer', t; end if;

  begin
    update proposal_flags set label = 'Nothing to see', resolution = signed,
                              resolved_at = now(), resolved_by = ben
     where id = fid;
  exception when others then null;
  end;
  select label into t from proposal_flags where id = fid;
  if t = 'Access for emergency vehicles' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a flag''s label was rewritten to %', t; end if;

  ----------------------------------- the definer paths still do their job
  perform resolve_flag(fid, 'The ambulance service has a key to the bollard.');
  select resolution into t from proposal_flags where id = fid;
  if t like 'The ambulance%' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: resolve_flag() no longer answers a flag'; end if;

  perform resolve_law_tension(tid, signed);
  select resolved_by::text into t from law_assessments where id = tid;
  if t = ben::text then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: resolve_law_tension() no longer answers a tension'; end if;

  -- And an answer, once written, stands.
  begin
    perform resolve_flag(fid, 'Actually a different answer entirely, written later.');
  exception when others then null;
  end;
  select resolution into t from proposal_flags where id = fid;
  if t like 'The ambulance%' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: an answered flag was answered again'; end if;

  ------------------------------------------------------------ the debate
  insert into deliberation_comments (proposal_id, author_id, kind, body)
  values (pid, ben, 'question', 'What happens to deliveries on a Sunday morning?')
  returning id into cid;
  insert into deliberation_comments (proposal_id, author_id, kind, body)
  values (pid, ben, 'concern', 'I worry about the two households with no other access.')
  returning id into cid2;

  perform set_config('test.uid', ann::text, true);
  begin
    update deliberation_comments set body = 'I have no questions.' where id = cid;
  exception when others then null;
  end;
  select body into t from deliberation_comments where id = cid;
  if t like 'What happens%' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: one member rewrote what another said in the debate'; end if;

  perform answer_contribution(cid, 'Deliveries come before ten, the closure starts at eleven.');
  select answered_by::text into t from deliberation_comments where id = cid;
  if t = ann::text then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: answer_contribution() no longer answers'; end if;

  perform set_config('test.uid', ben::text, true);
  begin
    delete from deliberation_comments where id = cid;
  exception when others then null;
  end;
  select count(*)::int into n from deliberation_comments where id = cid;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: an answered question was deleted by its author'; end if;

  -- Something nobody has responded to can still be taken back while it is open.
  delete from deliberation_comments where id = cid2;
  select count(*)::int into n from deliberation_comments where id = cid2;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: an unanswered contribution could not be taken back during the debate'; end if;

  ------------------------------------------------------------ the status
  perform set_config('test.uid', ann::text, true);
  begin
    update proposals set status = 'passed' where id = pid;
  exception when others then null;
  end;
  select status::text into t from proposals where id = pid;
  if t = 'in_deliberation' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the author moved their own proposal to %', t; end if;

  update proposals set status = 'withdrawn', closed_at = now() where id = pid;
  select status::text into t from proposals where id = pid;
  if t = 'withdrawn' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the author could not withdraw before any vote'; end if;

  raise notice ' ';
  raise notice '  The record: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then
    raise exception '% checks failed', fails;
  end if;
end $$;

reset role;

do $$
declare
  passes int := 0; fails int := 0; n int;
begin
  -- The three answer-shaped update policies are gone and must stay gone.
  select count(*)::int into n from pg_policies
   where tablename in ('law_assessments', 'proposal_flags', 'deliberation_comments')
     and cmd in ('UPDATE', 'ALL');
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % update policies on the record tables', n; end if;

  select count(*)::int into n from pg_trigger
   where tgname in ('law_assessments_frozen', 'proposal_flags_frozen',
                    'deliberation_comments_frozen', 'deliberation_comments_guard_delete',
                    'proposals_guard_status');
  if n = 5 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: expected 5 record triggers, found %', n; end if;

  raise notice ' ';
  raise notice '  The record (absences): % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then
    raise exception '% checks failed', fails;
  end if;
end $$;
