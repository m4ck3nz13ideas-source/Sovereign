-- Each proposal is decided by its own conditions (0039, rule 13).
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
  ('a1313131-3131-3131-3131-31313131313a', 'terms-steward@example.com'),
  ('b1313131-3131-3131-3131-31313131313b', 'terms-member@example.com'),
  ('c1313131-3131-3131-3131-31313131313c', 'terms-third@example.com');

create or replace function test_terms_ready(p_pid uuid, p_author uuid)
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

create or replace function test_terms_vote(p_pid uuid, p_who uuid, p_level numeric)
returns void language plpgsql as $$
begin
  perform set_config('test.uid', p_who::text, true);
  insert into proposal_reads (proposal_id, profile_id) values (p_pid, p_who) on conflict do nothing;
  perform cast_resonance(p_pid, p_level, p_level, p_level, null);
end $$;

set role app;

do $$
declare
  stew uuid := 'a1313131-3131-3131-3131-31313131313a';
  mem  uuid := 'b1313131-3131-3131-3131-31313131313b';
  thr  uuid := 'c1313131-3131-3131-3131-31313131313c';
  gid uuid; code text; p1 uuid; p2 uuid; n int; o decision_outcome; t record;
  passes int := 0; fails int := 0;
begin
  perform set_config('test.uid', stew::text, true);
  gid := create_group('Terms Test', 'x', 'local');
  code := create_invite(gid, 5, 14);
  perform set_config('test.uid', mem::text, true); perform redeem_invite(code);
  perform set_config('test.uid', thr::text, true); perform redeem_invite(code);

  perform set_config('test.uid', stew::text, true);
  p1 := test_propose(stew, gid, 'local', null, 'Paint the hall', 'x',
                     'The community hall needs repainting before winter.');
  perform test_terms_ready(p1, stew);

  -- The AI asks too little; the floors hold.
  perform set_config('test.uid', stew::text, true);
  perform record_proposal_conditions(p1, 1, 1,
    '["Who buys the paint and how much it costs", "Who has the keys on painting day"]'::jsonb,
    'A small, reversible job inside one group.', 'proposal.conditions', '1.0.0', 'test');
  select * into t from proposal_conditions where proposal_id = p1;
  if t.min_voices = 2 and t.window_hours = 24 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: floors not applied (% voices, % hours)', t.min_voices, t.window_hours; end if;

  -- Set once.
  begin
    perform record_proposal_conditions(p1, 2, 24, '[]'::jsonb, 'Trying to soften the terms.', 'proposal.conditions', '1.0.0', 'test');
    fails := fails + 1; raise warning 'FAIL: terms were set twice';
  exception when others then passes := passes + 1; end;

  -- Nobody can write terms directly.
  begin
    update proposal_conditions set min_voices = 2, requirements = '[]'::jsonb where proposal_id = p1;
    select jsonb_array_length(requirements) into n from proposal_conditions where proposal_id = p1;
    if n = 2 then passes := passes + 1; else fails := fails + 1;
      raise warning 'FAIL: terms were rewritten directly'; end if;
  exception when others then passes := passes + 1; end;

  -- Voting opens; the window holds even for the steward.
  perform test_terms_vote(p1, stew, 0.9);
  perform test_terms_vote(p1, mem, 0.9);
  perform set_config('test.uid', stew::text, true);
  begin
    perform close_proposal(p1);
    fails := fails + 1; raise warning 'FAIL: closed before its window ended';
  exception when others then passes := passes + 1; end;

  raise notice ' ';
  raise notice '  Proposal conditions (setting): % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;

-- Time passes.
reset role;
update proposal_conditions set closes_at = now() - interval '1 minute'
 where proposal_id = (select id from proposals where title = 'Paint the hall');
set role app;

do $$
declare
  stew uuid := 'a1313131-3131-3131-3131-31313131313a';
  mem  uuid := 'b1313131-3131-3131-3131-31313131313b';
  thr  uuid := 'c1313131-3131-3131-3131-31313131313c';
  p1 uuid; p2 uuid; gid uuid; o decision_outcome;
  passes int := 0; fails int := 0;
begin
  perform set_config('test.uid', stew::text, true);
  select id, group_id into p1, gid from proposals where title = 'Paint the hall';

  -- Requirements answered by anyone it reaches; one only.
  perform set_config('test.uid', mem::text, true);
  perform answer_requirement(p1, 1, 'Mem buys it: four tins, about sixty pounds, from the co-op.');
  begin
    perform answer_requirement(p1, 1, 'A second answer to the same requirement.');
    fails := fails + 1; raise warning 'FAIL: a requirement was answered twice';
  exception when others then passes := passes + 1; end;
  begin
    perform answer_requirement(p1, 3, 'There is no third requirement on this proposal.');
    fails := fails + 1; raise warning 'FAIL: answered a requirement that does not exist';
  exception when others then passes := passes + 1; end;

  -- Second proposal: same group, same votes, but a requirement left open.
  perform set_config('test.uid', stew::text, true);
  p2 := test_propose(stew, gid, 'local', null, 'Paint the gate', 'x',
                     'The front gate needs repainting before winter too.');
  perform test_terms_ready(p2, stew);
  perform set_config('test.uid', stew::text, true);
  perform record_proposal_conditions(p2, 2, 24, '["Who buys the paint"]'::jsonb,
    'Small and reversible.', 'proposal.conditions', '1.0.0', 'test');
  perform test_terms_vote(p2, stew, 0.9);
  perform test_terms_vote(p2, mem, 0.9);

  -- Terms cannot be added once anybody has responded.
  perform set_config('test.uid', stew::text, true);

  -- p1: one requirement still open -> fails.
  o := close_proposal(p1);
  if o = 'failed' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: passed with an unanswered requirement'; end if;

  raise notice ' ';
  raise notice '  Proposal conditions (deciding): % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;

reset role;
update proposal_conditions set closes_at = now() - interval '1 minute'
 where proposal_id = (select id from proposals where title = 'Paint the gate');
set role app;

do $$
declare
  stew uuid := 'a1313131-3131-3131-3131-31313131313a';
  mem  uuid := 'b1313131-3131-3131-3131-31313131313b';
  thr  uuid := 'c1313131-3131-3131-3131-31313131313c';
  p2 uuid; p3 uuid; gid uuid; o decision_outcome;
  passes int := 0; fails int := 0;
begin
  perform set_config('test.uid', stew::text, true);
  select id, group_id into p2, gid from proposals where title = 'Paint the gate';
  perform answer_requirement(p2, 1, 'The steward buys it from the hardware shop on Friday.');

  -- Every requirement answered, two voices of two, past the window: passes —
  -- even though two of three members is below the old 60% participation rule
  -- only by coincidence; the point is the terms decide, not the preset.
  o := close_proposal(p2);
  if o = 'passed' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: did not pass on its own conditions (%)', o; end if;

  -- Too few voices for its terms fails.
  p3 := test_propose(stew, gid, 'local', null, 'Rebuild the hall', 'x',
                     'Knock the hall down and rebuild it with a second floor for the youth club.');
  perform test_terms_ready(p3, stew);
  perform set_config('test.uid', stew::text, true);
  perform record_proposal_conditions(p3, 3, 24, '[]'::jsonb,
    'A large, irreversible change: everyone in the group should respond.', 'proposal.conditions', '1.0.0', 'test');
  perform test_terms_vote(p3, stew, 0.9);
  perform test_terms_vote(p3, mem, 0.9);

  -- And terms cannot be set after a vote.
  perform set_config('test.uid', stew::text, true);
  begin
    perform record_proposal_conditions(p3, 2, 24, '[]'::jsonb, 'Lowering it after votes.', 'proposal.conditions', '1.0.0', 'test');
    fails := fails + 1; raise warning 'FAIL: terms changed after voting began';
  exception when others then passes := passes + 1; end;

  raise notice ' ';
  raise notice '  Proposal conditions (passing): % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;

reset role;
update proposal_conditions set closes_at = now() - interval '1 minute'
 where proposal_id = (select id from proposals where title = 'Rebuild the hall');
set role app;

do $$
declare
  stew uuid := 'a1313131-3131-3131-3131-31313131313a';
  p3 uuid; o decision_outcome;
begin
  perform set_config('test.uid', stew::text, true);
  select id into p3 from proposals where title = 'Rebuild the hall';
  o := close_proposal(p3);
  if o <> 'failed' then raise exception 'FAIL: passed with 2 voices when its terms asked for 3'; end if;
  raise notice '  Proposal conditions (voices): 1 passed, 0 failed';
end $$;

reset role;
drop function test_terms_ready(uuid, uuid);
drop function test_terms_vote(uuid, uuid, numeric);
