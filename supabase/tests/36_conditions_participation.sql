-- Participation, not the clock (0042, rule 13). The cases the brief asked for:
-- no window, a window, too few voices, unmet requirements, completion,
-- changes after participation, early closure — plus the bypasses around them.
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

update conditions_epoch set since = '-infinity';

insert into auth.users (id, email) values
  ('a1616161-6161-6161-6161-61616161616a', 'part-steward@example.com'),
  ('b1616161-6161-6161-6161-61616161616b', 'part-two@example.com'),
  ('c1616161-6161-6161-6161-61616161616c', 'part-three@example.com');

create or replace function test_p_ready(p_pid uuid, p_author uuid)
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

create or replace function test_p_vote(p_pid uuid, p_who uuid)
returns void language plpgsql as $$
begin
  perform set_config('test.uid', p_who::text, true);
  insert into proposal_reads (proposal_id, profile_id) values (p_pid, p_who) on conflict do nothing;
  perform cast_resonance(p_pid, 0.9, 0.9, 0.9, null);
end $$;

set role app;

------------------------------------------------------------ no time window
do $$
declare
  s uuid := 'a1616161-6161-6161-6161-61616161616a';
  b uuid := 'b1616161-6161-6161-6161-61616161616b';
  c uuid := 'c1616161-6161-6161-6161-61616161616c';
  gid uuid; code text; p uuid; o decision_outcome; n int; t record;
  passes int := 0; fails int := 0;
begin
  perform set_config('test.uid', s::text, true);
  gid := create_group('Participation Test', 'x', 'local');
  code := create_invite(gid, 5, 14);
  perform set_config('test.uid', b::text, true); perform redeem_invite(code);
  perform set_config('test.uid', c::text, true); perform redeem_invite(code);

  perform set_config('test.uid', s::text, true);
  p := test_propose(s, gid, 'local', null, 'Hall key rota', 'x', 'Agree who holds the hall keys each week.');
  perform test_p_ready(p, s);

  -- Nobody responds before the conditions exist.
  begin
    perform test_p_vote(p, b);
    fails := fails + 1; raise warning 'FAIL: a response landed before the conditions were set';
  exception when others then passes := passes + 1; end;

  perform set_config('test.uid', s::text, true);
  perform record_proposal_conditions(p, 3, null,
    '["Who holds the spare key"]'::jsonb, '["Everyone on the current rota"]'::jsonb,
    'Small and reversible, but everyone on the rota is affected; no window needed.',
    'proposal.conditions', '1.1.0', 'test');
  select * into t from proposal_conditions where proposal_id = p;
  if t.window_hours is null and t.closes_at is null and jsonb_array_length(t.affected) = 1 then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: no-window conditions not recorded as such'; end if;

  -- Early closure, with nothing met: refused, and it stays open.
  begin
    perform close_proposal(p);
    fails := fails + 1; raise warning 'FAIL: a no-window proposal closed with nothing met';
  exception when others then passes := passes + 1; end;
  if (select status from proposals where id = p) in ('in_deliberation', 'voting') then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: the refused close changed the status'; end if;

  perform test_p_vote(p, s);
  perform test_p_vote(p, b);
  perform test_p_vote(p, c);

  -- Voices met, requirement and affected group still open: still refused.
  perform set_config('test.uid', s::text, true);
  begin
    perform close_proposal(p);
    fails := fails + 1; raise warning 'FAIL: closed with an open requirement and an unreached group';
  exception when others then passes := passes + 1; end;

  perform answer_requirement(p, 1, 'The steward keeps the spare in the kitchen drawer at home.');
  begin
    perform close_proposal(p);
    fails := fails + 1; raise warning 'FAIL: closed with an affected group not yet reached';
  exception when others then passes := passes + 1; end;

  -- Reaching an affected group needs a real note, once.
  begin
    perform answer_condition(p, 'affected', 1, 'done');
    fails := fails + 1; raise warning 'FAIL: a group was marked reached with no account of how';
  exception when others then passes := passes + 1; end;
  perform answer_condition(p, 'affected', 1, 'Posted in the rota group chat and on the hall noticeboard on Monday.');
  begin
    perform answer_condition(p, 'affected', 1, 'Marking the same group reached a second time.');
    fails := fails + 1; raise warning 'FAIL: a group was marked reached twice';
  exception when others then passes := passes + 1; end;
  begin
    perform answer_condition(p, 'affected', 2, 'There is no second affected group on this proposal.');
    fails := fails + 1; raise warning 'FAIL: reached a group that is not in the conditions';
  exception when others then passes := passes + 1; end;

  -- Everything met: it decides, and passes.
  o := close_proposal(p);
  if o = 'passed' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a no-window proposal with everything met did not pass (%)', o; end if;

  raise notice ' ';
  raise notice '  Participation (no window): % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;

----------------------------------------------- a window, and early closure
do $$
declare
  s uuid := 'a1616161-6161-6161-6161-61616161616a';
  b uuid := 'b1616161-6161-6161-6161-61616161616b';
  gid uuid; p uuid; q uuid; r uuid;
  passes int := 0; fails int := 0;
begin
  perform set_config('test.uid', s::text, true);
  select id into gid from groups where name = 'Participation Test';

  p := test_propose(s, gid, 'local', null, 'Repaint the hall', 'x', 'Repaint the hall before the winter fair.');
  perform test_p_ready(p, s);
  perform set_config('test.uid', s::text, true);
  perform record_proposal_conditions(p, 2, 48, '[]'::jsonb, '[]'::jsonb,
    'Visible, hard to undo once done: two days for people to see it.', 'proposal.conditions', '1.1.0', 'test');
  perform test_p_vote(p, s);
  perform test_p_vote(p, b);

  -- The steward cannot close it early, even with everything else met.
  perform set_config('test.uid', s::text, true);
  begin
    perform close_proposal(p);
    fails := fails + 1; raise warning 'FAIL: a steward closed a proposal before its window';
  exception when others then passes := passes + 1; end;

  -- A window under the floor is lifted to it.
  q := test_propose(s, gid, 'local', null, 'Paint the fence', 'x', 'Paint the fence beside the hall too.');
  perform test_p_ready(q, s);
  perform set_config('test.uid', s::text, true);
  perform record_proposal_conditions(q, 1, 2, '["Who buys the paint"]'::jsonb, '[]'::jsonb,
    'Tiny job, quick decision.', 'proposal.conditions', '1.1.0', 'test');
  if (select window_hours = 24 and min_voices = 2 from proposal_conditions where proposal_id = q) then
    passes := passes + 1; else fails := fails + 1; raise warning 'FAIL: floors not applied'; end if;
  perform test_p_vote(q, s);

  -- And one more for unmet requirements after the window.
  r := test_propose(s, gid, 'local', null, 'Paint the gate', 'x', 'Paint the gate in the same colour.');
  perform test_p_ready(r, s);
  perform set_config('test.uid', s::text, true);
  perform record_proposal_conditions(r, 2, 24, '["Who buys the paint"]'::jsonb, '["Neighbours at number 4"]'::jsonb,
    'Small; the gate faces number 4.', 'proposal.conditions', '1.1.0', 'test');
  perform test_p_vote(r, s);
  perform test_p_vote(r, b);

  raise notice ' ';
  raise notice '  Participation (window): % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;

-- Time passes for the three windowed proposals.
reset role;
alter table proposal_conditions disable trigger proposal_conditions_guard;
update proposal_conditions set closes_at = now() - interval '1 minute'
 where proposal_id in (select id from proposals where title in ('Repaint the hall', 'Paint the fence', 'Paint the gate'));
alter table proposal_conditions enable trigger proposal_conditions_guard;
set role app;

do $$
declare
  s uuid := 'a1616161-6161-6161-6161-61616161616a';
  o decision_outcome; passes int := 0; fails int := 0;
begin
  perform set_config('test.uid', s::text, true);

  o := close_proposal((select id from proposals where title = 'Repaint the hall'));
  if o = 'passed' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a windowed proposal with everything met did not pass (%)', o; end if;

  o := close_proposal((select id from proposals where title = 'Paint the fence'));
  if o = 'failed' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: passed with too few voices'; end if;

  o := close_proposal((select id from proposals where title = 'Paint the gate'));
  if o = 'failed' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: passed with an unmet requirement and an unreached group'; end if;

  raise notice ' ';
  raise notice '  Participation (window, after): % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;

------------------------------------- changing conditions, and challenges
do $$
declare
  s uuid := 'a1616161-6161-6161-6161-61616161616a';
  b uuid := 'b1616161-6161-6161-6161-61616161616b';
  c uuid := 'c1616161-6161-6161-6161-61616161616c';
  gid uuid; p uuid; ch uuid; ch2 uuid; t record; n int;
  passes int := 0; fails int := 0;
begin
  perform set_config('test.uid', s::text, true);
  select id into gid from groups where name = 'Participation Test';
  p := test_propose(s, gid, 'local', null, 'New hall heating', 'x', 'Replace the hall boiler with a heat pump.');
  perform test_p_ready(p, s);
  perform set_config('test.uid', s::text, true);
  perform record_proposal_conditions(p, 3, null, '["Who pays, and is the money there"]'::jsonb, '[]'::jsonb,
    'Costly but inside one group.', 'proposal.conditions', '1.1.0', 'test');

  -- Before anybody responds: a challenge can update the conditions.
  perform set_config('test.uid', b::text, true);
  ch := raise_condition_challenge(p, 'Every hirer of the hall is affected by the heating and nobody has asked them.');

  -- More than one person, and more than one challenge each — none of them stall anything.
  perform set_config('test.uid', c::text, true);
  ch2 := raise_condition_challenge(p, 'We have no idea what this costs to run through a winter.');
  perform raise_condition_challenge(p, 'And a second point from me: who services it each year?');
  select count(*)::int into n from condition_challenges where proposal_id = p;
  if n = 3 then passes := passes + 1; else fails := fails + 1; raise warning 'FAIL: several challenges not allowed (%)', n; end if;

  -- Anybody reached can reply: it is a debate.
  perform set_config('test.uid', s::text, true);
  perform reply_to_condition_challenge(ch, 'Fair — the Tuesday dance class books it every week.');
  select count(*)::int into n from condition_challenge_replies where challenge_id = ch;
  if n = 1 then passes := passes + 1; else fails := fails + 1; raise warning 'FAIL: reply not recorded'; end if;

  -- Only the challenger has their challenge re-read.
  begin
    perform apply_condition_challenge(ch, 3, null, '[]'::jsonb, '[]'::jsonb, 'Steward answering it themselves.', 'proposal.conditions', '1.1.0', 'test');
    fails := fails + 1; raise warning 'FAIL: someone else answered the challenge';
  exception when others then passes := passes + 1; end;

  -- The re-reading tries to weaken as well as add: only the addition sticks.
  perform set_config('test.uid', b::text, true);
  perform apply_condition_challenge(ch, 2, 1,
    '["Who pays, and is the money there", "What it costs to run each winter"]'::jsonb,
    '["Regular hirers of the hall"]'::jsonb,
    'Hirers are affected and the running cost is unknown; added both. Voices stay as they were.',
    'proposal.conditions', '1.1.0', 'test');
  select * into t from proposal_conditions where proposal_id = p;
  if t.min_voices = 3 and jsonb_array_length(t.requirements) = 2
     and t.requirements->>0 = 'Who pays, and is the money there'
     and jsonb_array_length(t.affected) = 1 and t.window_hours = 24 then passes := passes + 1;
  else fails := fails + 1;
    raise warning 'FAIL: challenge not applied strengthen-only (voices %, reqs %, affected %, window %)',
      t.min_voices, t.requirements, t.affected, t.window_hours; end if;

  select count(*)::int into n from condition_revisions where proposal_id = p and challenge_id = ch;
  if n = 1 then passes := passes + 1; else fails := fails + 1; raise warning 'FAIL: no public revision recorded'; end if;

  begin
    perform apply_condition_challenge(ch, 9, null, '[]'::jsonb, '[]'::jsonb, 'Answering it again.', 'proposal.conditions', '1.1.0', 'test');
    fails := fails + 1; raise warning 'FAIL: a challenge was answered twice';
  exception when others then passes := passes + 1; end;

  -- Once people respond, conditions are fixed.
  perform test_p_vote(p, s);

  perform set_config('test.uid', s::text, true);
  begin
    perform record_proposal_conditions(p, 2, null, '[]'::jsonb, '[]'::jsonb, 'Softer, after a vote.', 'proposal.conditions', '1.1.0', 'test');
    fails := fails + 1; raise warning 'FAIL: conditions re-set after participation began';
  exception when others then passes := passes + 1; end;

  update proposal_conditions set min_voices = 2, requirements = '[]'::jsonb where proposal_id = p;
  if (select min_voices = 3 and jsonb_array_length(requirements) = 2 from proposal_conditions where proposal_id = p) then
    passes := passes + 1; else fails := fails + 1; raise warning 'FAIL: a member rewrote conditions directly'; end if;

  -- A challenge raised now is debate only: it cannot change the conditions.
  perform set_config('test.uid', c::text, true);
  begin
    perform apply_condition_challenge(ch2, 5, null, '["Another requirement added after votes"]'::jsonb, '[]'::jsonb,
      'Adding after people responded.', 'proposal.conditions', '1.1.0', 'test');
    fails := fails + 1; raise warning 'FAIL: conditions moved after people responded';
  exception when others then passes := passes + 1; end;
  perform raise_condition_challenge(p, 'Still think the hirers need a proper meeting, not a notice.');
  passes := passes + 1;

  raise notice ' ';
  raise notice '  Participation (changes and challenges): % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;

-------------------------------------------------- challenges never stall it
do $$
declare
  s uuid := 'a1616161-6161-6161-6161-61616161616a';
  b uuid := 'b1616161-6161-6161-6161-61616161616b';
  c uuid := 'c1616161-6161-6161-6161-61616161616c';
  gid uuid; p uuid; o decision_outcome; passes int := 0; fails int := 0;
begin
  perform set_config('test.uid', s::text, true);
  select id into gid from groups where name = 'Participation Test';
  p := test_propose(s, gid, 'local', null, 'Tea rota', 'x', 'Agree who brings milk to the hall each week.');
  perform test_p_ready(p, s);
  perform set_config('test.uid', s::text, true);
  perform record_proposal_conditions(p, 2, null, '[]'::jsonb, '[]'::jsonb, 'Trivial and reversible.', 'proposal.conditions', '1.1.0', 'test');
  perform test_p_vote(p, s);
  perform test_p_vote(p, b);

  perform set_config('test.uid', c::text, true);
  perform raise_condition_challenge(p, 'Two voices is too few: there are three of us and I was away all week.');
  perform raise_condition_challenge(p, 'And milk should be oat milk, which nobody asked about.');

  perform set_config('test.uid', s::text, true);
  o := close_proposal(p);
  if o = 'passed' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: open challenges held up a decision whose conditions were met (%)', o; end if;

  raise notice ' ';
  raise notice '  Participation (challenges never stall): % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;

reset role;

----------------------------------------------- the guard, and the signature
do $$
declare p uuid; passes int := 0; fails int := 0;
begin
  select id into p from proposals where title = 'New hall heating';

  -- Even the owner cannot weaken conditions.
  begin
    update proposal_conditions set min_voices = 2 where proposal_id = p;
    fails := fails + 1; raise warning 'FAIL: voices lowered directly';
  exception when others then passes := passes + 1; end;
  begin
    update proposal_conditions set requirements = '["What it costs to run each winter"]'::jsonb where proposal_id = p;
    fails := fails + 1; raise warning 'FAIL: a requirement removed directly';
  exception when others then passes := passes + 1; end;
  begin
    update proposal_conditions set window_hours = null, closes_at = null where proposal_id = p;
    fails := fails + 1; raise warning 'FAIL: a window removed directly';
  exception when others then passes := passes + 1; end;

  raise notice ' ';
  raise notice '  Participation (guard): % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;

-- With signing on, a challenge cannot be applied except through ai_write().
insert into private.ai_signing_key (secret) values ('participation-test-secret-0042-xxxxxxxx');
set role app;
do $$
declare ch uuid;
begin
  perform set_config('test.uid', 'c1616161-6161-6161-6161-61616161616c', true);
  select id into ch from condition_challenges where answered_at is null limit 1;
  begin
    perform apply_condition_challenge(ch, 2, null, '[]'::jsonb, '[]'::jsonb, 'Unsigned re-reading.', 'proposal.conditions', '1.1.0', 'forged');
    raise exception 'FAIL: an unsigned challenge re-reading was accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  raise notice '  Participation (signed): 1 passed, 0 failed';
end $$;
reset role;
delete from private.ai_signing_key;

drop function test_p_ready(uuid, uuid);
drop function test_p_vote(uuid, uuid);
update conditions_epoch set since = 'infinity';
