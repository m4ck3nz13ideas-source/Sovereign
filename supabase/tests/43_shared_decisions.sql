-- A decision can be shared (0049, rule 45).
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

update conditions_epoch set since = 'infinity';

insert into auth.users (id, email) values
  ('a4343434-4343-4343-4343-43434343434a', 'share-steward@example.com'),
  ('b4343434-4343-4343-4343-43434343434b', 'share-member@example.com'),
  ('c4343434-4343-4343-4343-43434343434c', 'share-member2@example.com'),
  ('d4343434-4343-4343-4343-43434343434d', 'share-member3@example.com'),
  ('e4343434-4343-4343-4343-43434343434e', 'share-member4@example.com'),
  ('f4343434-4343-4343-4343-43434343434f', 'share-outsider@example.com');

create or replace function test_share_ready(p_pid uuid, p_author uuid)
returns void language plpgsql as $$
declare l text; rid uuid;
begin
  perform set_config('test.uid', p_author::text, true);
  insert into proposal_reviews (proposal_id, prompt_id, prompt_version, model, summary)
  values (p_pid, 'proposal.review', '1.2.0', 'test', 'A reading.') returning id into rid;
  foreach l in array array['sanctity_of_life','truth_and_transparency','sovereignty_of_the_individual',
    'equity_and_justice','subsidiarity','reciprocity_and_mutual_care','stewardship_of_earth',
    'harmony_of_diversity','right_use_of_power','continuous_evolution'] loop
    insert into law_assessments (proposal_id, review_id, law_id, verdict, reasoning, prompt_id, prompt_version, model)
    values (p_pid, rid, l, 'aligned', 'clear', 'law.audit', '1.0.0', 'test');
  end loop;
  update proposals set status = 'in_deliberation' where id = p_pid and status = 'in_review';
end $$;

create or replace function test_share_vote(p_pid uuid, p_who uuid, p_level numeric)
returns void language plpgsql as $$
begin
  perform set_config('test.uid', p_who::text, true);
  insert into proposal_reads (proposal_id, profile_id) values (p_pid, p_who) on conflict do nothing;
  perform cast_resonance(p_pid, p_level, p_level, p_level, 'A note that must stay inside.');
end $$;

set role app;

do $$
declare
  st uuid := 'a4343434-4343-4343-4343-43434343434a';
  m1 uuid := 'b4343434-4343-4343-4343-43434343434b';
  m2 uuid := 'c4343434-4343-4343-4343-43434343434c';
  m3 uuid := 'd4343434-4343-4343-4343-43434343434d';
  m4 uuid := 'e4343434-4343-4343-4343-43434343434e';
  outsider uuid := 'f4343434-4343-4343-4343-43434343434f';
  gid uuid; code text; small uuid; big uuid; tok text; tok2 text; n int;
  r record;
  passes int := 0; fails int := 0;
begin
  perform set_config('test.uid', st::text, true);
  gid := create_group('Share Test', 'x', 'local');
  code := create_invite(gid, 10, 14);
  perform set_config('test.uid', m1::text, true); perform redeem_invite(code);
  perform set_config('test.uid', m2::text, true); perform redeem_invite(code);
  perform set_config('test.uid', m3::text, true); perform redeem_invite(code);
  perform set_config('test.uid', m4::text, true); perform redeem_invite(code);

  -- A proposal by a member, not yet decided.
  perform set_config('test.uid', m1::text, true);
  small := test_propose(m1, gid, 'local', null, 'Plant fruit trees on the green', 'Six trees.',
                        'The green is bare and the school wants an orchard to learn from.');
  perform test_share_ready(small, m1);

  perform set_config('test.uid', st::text, true);
  begin
    perform share_decision(small);
    fails := fails + 1; raise warning 'FAIL: an undecided proposal was shared';
  exception when others then passes := passes + 1; end;

  perform test_share_vote(small, st, 0.9);
  perform test_share_vote(small, m1, 0.8);
  perform test_share_vote(small, m2, 0.7);
  perform set_config('test.uid', st::text, true);
  perform close_proposal(small);

  -- The author is a member, not a steward: the group's decision is the group's.
  perform set_config('test.uid', m1::text, true);
  begin
    perform share_decision(small);
    fails := fails + 1; raise warning 'FAIL: a member who is not a steward shared the group''s decision';
  exception when others then passes := passes + 1; end;

  -- A steward can. Sharing twice gives the same link.
  perform set_config('test.uid', st::text, true);
  tok := share_decision(small);
  tok2 := share_decision(small);
  if tok is not null and tok = tok2 and length(tok) >= 12 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: share gave % then %', tok, tok2; end if;

  -- Signed out: the decision, with no averages under the floor.
  perform set_config('test.uid', '', true);
  select * into r from shared_decision(tok);
  if r.title = 'Plant fruit trees on the green' and r.voices = 3 and r.outcome is not null then
    passes := passes + 1; else fails := fails + 1; raise warning 'FAIL: the shared page did not read signed out'; end if;
  if r.alignment is null and r.spread is null and r.split is null then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: averages shown below the floor (% voices)', r.voices; end if;
  if r.by_group and r.members = 5 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: by_group % members %', r.by_group, r.members; end if;

  select count(*)::int into n from shared_decision('not-a-real-token');
  if n = 0 then passes := passes + 1; else fails := fails + 1; raise warning 'FAIL: a made-up token returned a row'; end if;

  -- Somebody outside cannot see the share row in the table, and cannot stop it.
  perform set_config('test.uid', outsider::text, true);
  select count(*)::int into n from decision_shares where proposal_id = small;
  if n = 0 then passes := passes + 1; else fails := fails + 1; raise warning 'FAIL: an outsider read the share row'; end if;
  begin
    perform unshare_decision(small);
    fails := fails + 1; raise warning 'FAIL: an outsider stopped the share';
  exception when others then passes := passes + 1; end;

  -- A member can see it is shared.
  perform set_config('test.uid', m2::text, true);
  select count(*)::int into n from decision_shares where proposal_id = small;
  if n = 1 then passes := passes + 1; else fails := fails + 1; raise warning 'FAIL: a member cannot see the share'; end if;

  -- Stopping it kills the link at once; sharing again makes a new one.
  perform set_config('test.uid', st::text, true);
  perform unshare_decision(small);
  perform set_config('test.uid', '', true);
  select count(*)::int into n from shared_decision(tok);
  if n = 0 then passes := passes + 1; else fails := fails + 1; raise warning 'FAIL: the old link still worked'; end if;
  perform set_config('test.uid', st::text, true);
  tok2 := share_decision(small);
  if tok2 <> tok then passes := passes + 1; else fails := fails + 1; raise warning 'FAIL: a re-share reused the old token'; end if;

  -- Five voices: the numbers appear.
  perform set_config('test.uid', st::text, true);
  big := test_propose(st, gid, 'local', null, 'A tool library in the hall', 'Lend, don''t buy.',
                      'Everyone owns a drill they use twice a year; one shelf would do.');
  perform test_share_ready(big, st);
  perform test_share_vote(big, st, 0.9);
  perform test_share_vote(big, m1, 0.8);
  perform test_share_vote(big, m2, 0.8);
  perform test_share_vote(big, m3, 0.7);
  perform test_share_vote(big, m4, 0.9);
  perform set_config('test.uid', st::text, true);
  perform close_proposal(big);
  tok := share_decision(big);
  perform set_config('test.uid', '', true);
  select * into r from shared_decision(tok);
  if r.voices = 5 and r.alignment is not null and r.spread is not null then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: five voices but alignment % spread %', r.alignment, r.spread; end if;

  raise notice ' ';
  raise notice '  Shared decisions: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;

reset role;

-- THE ABSENCES. The public function returns nothing that names or identifies,
-- signed-out visitors can run it and nothing else here.
do $$
declare cols text;
begin
  select string_agg(a, ',') into cols
    from (select unnest(p.proargnames) a, unnest(p.proargmodes) m
            from pg_proc p where p.proname = 'shared_decision') x
   where m = 't' and a ~* '(^id$|_id$|profile|name|handle|who|author|voter|note|response|_at$|token|group_name)';
  if cols is not null then raise exception 'FAIL: shared_decision returns an identifying column: %', cols; end if;

  if not has_function_privilege('anon', 'shared_decision(text)', 'execute') then
    raise exception 'FAIL: signed-out visitors cannot read a shared decision';
  end if;
  if has_function_privilege('anon', 'share_decision(uuid)', 'execute')
     or has_function_privilege('anon', 'unshare_decision(uuid)', 'execute') then
    raise exception 'FAIL: signed-out visitors can share or unshare';
  end if;

  raise notice '  Shared decisions (absences): 3 passed, 0 failed';
end $$;

drop function test_share_ready(uuid, uuid);
drop function test_share_vote(uuid, uuid, numeric);
