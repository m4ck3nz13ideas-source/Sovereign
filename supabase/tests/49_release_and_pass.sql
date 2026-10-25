-- Released by the laws, passed by its own requirements (0056, rule 13).
--   * nothing moves into deliberation until ten current readings exist, none
--     is a violation, the law alignment is at least 0.618 and a review is on
--     file;
--   * a reading's alignment must agree with its verdict;
--   * a proposal with conditions passes once they are met, whatever the
--     average of the responses — and a decision records its law alignment.
-- Proposals from before the gate are released as they always were; every
-- older suite runs with release_epoch at infinity and is the check on that.
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
update release_epoch set since = '-infinity';

insert into auth.users (id, email) values
  ('a4949494-9494-9494-9494-94949494949a', 'release-steward@example.com'),
  ('b4949494-9494-9494-9494-94949494949b', 'release-two@example.com'),
  ('c4949494-9494-9494-9494-94949494949c', 'release-three@example.com'),
  ('d4949494-9494-9494-9494-94949494949d', 'release-outsider@example.com');

-- Ten readings with the given verdict for one law and alignment for every
-- law, written as the fixture stand-in for the signed path (00b_support).
create or replace function test_r_read(p_pid uuid, p_alignment numeric, p_tension_law text default null)
returns void language plpgsql as $$
declare l text;
begin
  foreach l in array array['sanctity_of_life','truth_and_transparency','sovereignty_of_the_individual',
    'equity_and_justice','subsidiarity','reciprocity_and_mutual_care','stewardship_of_earth',
    'harmony_of_diversity','right_use_of_power','continuous_evolution'] loop
    insert into law_assessments (proposal_id, law_id, verdict, reasoning, prompt_id, prompt_version, model, alignment)
    values (p_pid, l,
            case when l = p_tension_law then 'tension'::law_verdict else 'aligned'::law_verdict end,
            'clear', 'law.audit', '1.1.0', 'test', p_alignment);
  end loop;
end $$;

create or replace function test_r_review(p_pid uuid)
returns void language plpgsql as $$
begin
  insert into proposal_reviews (proposal_id, prompt_id, prompt_version, model, summary)
  values (p_pid, 'proposal.review', '1.2.0', 'test', 'A reading.');
end $$;

create or replace function test_r_vote(p_pid uuid, p_who uuid, p_align numeric)
returns void language plpgsql as $$
begin
  perform set_config('test.uid', p_who::text, true);
  insert into proposal_reads (proposal_id, profile_id) values (p_pid, p_who) on conflict do nothing;
  perform cast_resonance(p_pid, p_align, 0.9, 0.5, null);
end $$;

set role app;

do $$
declare
  s uuid := 'a4949494-9494-9494-9494-94949494949a';
  b uuid := 'b4949494-9494-9494-9494-94949494949b';
  c uuid := 'c4949494-9494-9494-9494-94949494949c';
  gid uuid; code text; p uuid; q uuid; o decision_outcome; why text; la numeric;
  passes int := 0; fails int := 0;
begin
  perform set_config('test.uid', s::text, true);
  gid := create_group('Release Test', 'x', 'local');
  code := create_invite(gid, 5, 14);
  perform set_config('test.uid', b::text, true); perform redeem_invite(code);
  perform set_config('test.uid', c::text, true); perform redeem_invite(code);
  perform set_config('test.uid', s::text, true);

  ------------------------------------------------------------- the threshold
  if release_threshold() = 0.618 then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: release threshold is not 0.618'; end if;

  ------------------------------------------------- held without an audit
  p := test_propose(s, gid, 'local', null, 'Release one', 'x', 'Nobody sweeps the hall after Thursday sessions.');
  perform test_r_review(p);
  begin
    update proposals set status = 'in_deliberation' where id = p;
    fails := fails + 1; raise warning 'FAIL: released with no law audit';
  exception when others then passes := passes + 1; end;
  why := release_problem(p);
  if why like '%ten Universal Laws%' then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: wrong reason for holding (%)', why; end if;

  ---------------------------------------------- held below 0.618, with a number
  -- Ten tensions at 0.58: no violation, but not aligned enough to release.
  q := test_propose(s, gid, 'local', null, 'Release two', 'x', 'The hall heating stays on overnight in winter.');
  perform test_r_review(q);
  declare l text; begin
    foreach l in array array['sanctity_of_life','truth_and_transparency','sovereignty_of_the_individual',
      'equity_and_justice','subsidiarity','reciprocity_and_mutual_care','stewardship_of_earth',
      'harmony_of_diversity','right_use_of_power','continuous_evolution'] loop
      insert into law_assessments (proposal_id, law_id, verdict, reasoning, prompt_id, prompt_version, model, alignment)
      values (q, l, 'tension', 'friction', 'law.audit', '1.1.0', 'test', 0.58);
    end loop;
  end;
  la := law_alignment(q);
  if la = 0.580 then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: law alignment should be 0.580, is %', la; end if;
  begin
    update proposals set status = 'in_deliberation' where id = q;
    fails := fails + 1; raise warning 'FAIL: released at 0.580';
  exception when others then passes := passes + 1; end;
  if release_problem(q) like '%0.580%0.618%' then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: the held line does not give the numbers (%)', release_problem(q); end if;

  --------------------------------------------- released at or above 0.618
  perform test_r_read(p, 0.95);
  if release_problem(p) is null then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: a clean audit still held (%)', release_problem(p); end if;
  update proposals set status = 'in_deliberation' where id = p;
  if (select status from proposals where id = p) = 'in_deliberation' then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: a clean audit was not released'; end if;

  ------------------------ a reading with no number is unscored, never 1.000
  -- 0061: what the offline stand-in writes. Released for the pilot, but
  -- recorded as released without an AI reading.
  q := test_propose(s, gid, 'local', null, 'Release three', 'x', 'The noticeboard is out of date by a month.');
  perform test_r_review(q);
  perform test_r_read(q, null);
  if law_alignment(q) is null then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: an unscored audit scored % (it must never read as perfect)', law_alignment(q); end if;
  if law_unscored(q) then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: an audit with no numbers is not marked unscored'; end if;
  update proposals set status = 'in_deliberation' where id = q;
  if (select status from proposals where id = q) = 'in_deliberation' then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: an unscored, unviolated audit could not be released'; end if;
  if exists (select 1 from ledger_events where kind = 'proposal.released' and subject_id = q
               and (payload->>'unscored')::boolean and payload->'law_alignment' = 'null'::jsonb) then
    passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: the release is not on the ledger as unscored'; end if;

  -- Readings from before numbers existed (prompt 1.0.0) still count by verdict.
  q := test_propose(s, gid, 'local', null, 'Release legacy', 'x', 'The hall roof has leaked since the spring.');
  declare l text; begin
    foreach l in array universal_law_ids() loop
      insert into law_assessments (proposal_id, law_id, verdict, reasoning, prompt_id, prompt_version, model)
      values (q, l, 'aligned', 'clear', 'law.audit', '1.0.0', 'test');
    end loop;
  end;
  if law_alignment(q) = 1.000 then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: pre-0056 readings scored %', law_alignment(q); end if;

  ------------------------------- passes on its requirements, not the average
  perform record_proposal_conditions(p, 3, null, '[]'::jsonb, '[]'::jsonb,
    'Three voices; nothing else needed for something this small.',
    'proposal.conditions', '1.1.0', 'test');
  -- Lukewarm, all above 0.382: no average stands in its way (0056).
  perform test_r_vote(p, s, 0.45);
  perform test_r_vote(p, b, 0.40);
  perform test_r_vote(p, c, 0.39);
  perform set_config('test.uid', s::text, true);
  o := close_proposal(p);
  if o = 'passed' then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: conditions met but did not pass (%)', o; end if;
  if (select law_alignment from decisions where proposal_id = p) = 0.950 then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: the decision did not record its law alignment'; end if;
  if (select avg_alignment from decisions where proposal_id = p) is not null then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: the responses were not still recorded on the decision'; end if;

  if (select opposed from decisions where proposal_id = p) = 0 then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: the decision did not record how many were strongly against'; end if;

  ------------------- the safeguard (0059): most strongly against, it fails
  q := test_propose(s, gid, 'local', null, 'Release five', 'x', 'The hall closes at nine on weekdays.');
  perform test_r_review(q);
  perform test_r_read(q, 0.95);
  update proposals set status = 'in_deliberation' where id = q;
  perform record_proposal_conditions(q, 3, null, '[]'::jsonb, '[]'::jsonb,
    'Three voices for a small change.', 'proposal.conditions', '1.2.0', 'test');
  perform test_r_vote(q, s, 0.90);
  perform test_r_vote(q, b, 0.10);
  perform test_r_vote(q, c, 0.20);
  perform set_config('test.uid', s::text, true);
  o := close_proposal(q);
  if o = 'failed' then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: two of three strongly against, and it still passed'; end if;
  if (select opposed from decisions where proposal_id = q) = 2 then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: the decision does not say two were strongly against'; end if;
  if opposition_threshold() = 0.382 then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: the opposition line is not 0.382'; end if;

  -- Exactly half against is not a majority against: it passes.
  q := test_propose(s, gid, 'local', null, 'Release six', 'x', 'The kitchen kettle is broken again.');
  perform test_r_review(q);
  perform test_r_read(q, 0.95);
  update proposals set status = 'in_deliberation' where id = q;
  perform record_proposal_conditions(q, 2, null, '[]'::jsonb, '[]'::jsonb,
    'Two voices for a kettle.', 'proposal.conditions', '1.2.0', 'test');
  perform test_r_vote(q, s, 0.90);
  perform test_r_vote(q, b, 0.10);
  perform set_config('test.uid', s::text, true);
  o := close_proposal(q);
  if o = 'passed' then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: one of two against failed it — a split is not a majority'; end if;

  -------------------------------------------------- the brief's boundaries
  -- Fewer than half strongly against: the other gates decide, and it passes.
  q := test_propose(s, gid, 'local', null, 'Release seven', 'x', 'The bike rack by the hall is broken.');
  perform test_r_review(q);
  perform test_r_read(q, 0.95);
  update proposals set status = 'in_deliberation' where id = q;
  perform record_proposal_conditions(q, 3, null, '[]'::jsonb, '[]'::jsonb,
    'Three voices for a bike rack.', 'proposal.conditions', '1.3.0', 'test');
  perform test_r_vote(q, s, 0.90);
  perform test_r_vote(q, b, 0.80);

  -- Too few responses: refused, and it stays open.
  perform set_config('test.uid', s::text, true);
  begin
    perform close_proposal(q);
    fails := fails + 1; raise warning 'FAIL: closed with two of three voices';
  exception when others then passes := passes + 1; end;

  perform test_r_vote(q, c, 0.10);

  -- A member who is not a steward cannot close it.
  perform set_config('test.uid', b::text, true);
  begin
    perform close_proposal(q);
    fails := fails + 1; raise warning 'FAIL: a member who is not a steward closed a group proposal';
  exception when others then passes := passes + 1; end;

  -- An outsider can neither move it nor give it conditions.
  perform set_config('test.uid', 'd4949494-9494-9494-9494-94949494949d', true);
  update proposals set status = 'withdrawn' where id = q;
  if (select count(*) from proposals where id = q) = 0 then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: an outsider can read a group proposal'; end if;
  perform set_config('test.uid', s::text, true);
  if (select status from proposals where id = q) in ('in_deliberation', 'voting') then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: an outsider changed a proposal''s status'; end if;
  perform set_config('test.uid', 'd4949494-9494-9494-9494-94949494949d', true);
  begin
    perform record_proposal_conditions(q, 2, null, '[]'::jsonb, '[]'::jsonb,
      'An outsider trying to set conditions.', 'proposal.conditions', '1.3.0', 'forged');
    fails := fails + 1; raise warning 'FAIL: an outsider set a proposal''s conditions';
  exception when others then passes := passes + 1; end;

  perform set_config('test.uid', s::text, true);
  o := close_proposal(q);
  if o = 'passed' then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: one of three strongly against failed it (%)', o; end if;

  -- Closing twice: the second is refused and the decision stands.
  begin
    perform close_proposal(q);
    fails := fails + 1; raise warning 'FAIL: a decided proposal closed a second time';
  exception when others then passes := passes + 1; end;
  if (select count(*) from decisions where proposal_id = q) = 1 then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: two decisions for one proposal'; end if;

  raise notice ' ';
  raise notice '  Release and pass: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;

----------------------------------------- the payload must agree with itself
reset role;
insert into private.ai_signing_key (secret) values ('release-and-pass-test-secret-0056-xxxxxxxxxxxx');
set role app;
do $$
declare
  s uuid := 'a4949494-9494-9494-9494-94949494949a';
  gid uuid; p uuid; d jsonb; x record; l text; rs jsonb := '[]'::jsonb;
  passes int := 0; fails int := 0;
begin
  perform set_config('test.uid', s::text, true);
  select id into gid from groups where name = 'Release Test';
  p := test_propose(s, gid, 'local', null, 'Release four', 'x', 'Bins are left out after the Saturday market.');

  foreach l in array universal_law_ids() loop
    rs := rs || jsonb_build_array(jsonb_build_object('law_id', l, 'verdict', 'aligned',
            'reasoning', 'Not engaged.', 'alignment', case when l = 'subsidiarity' then 0.40 else 0.90 end));
  end loop;
  d := jsonb_build_object('proposal_id', p, 'prompt_id', 'law.audit', 'prompt_version', '1.1.0',
         'model', 'test', 'audit_hash', proposal_audit_hash(p), 'readings', rs);
  select * into x from test_signed('law.audit', d);
  begin
    perform record_law_audit(x.payload, x.sig);
    fails := fails + 1; raise warning 'FAIL: "aligned" at 0.40 was accepted';
  exception when others then passes := passes + 1; end;

  rs := '[]'::jsonb;
  foreach l in array universal_law_ids() loop
    rs := rs || jsonb_build_array(jsonb_build_object('law_id', l, 'verdict', 'aligned',
            'reasoning', 'Not engaged.', 'alignment', 0.90));
  end loop;
  d := jsonb_set(d, '{readings}', rs);
  select * into x from test_signed('law.audit', d);
  perform record_law_audit(x.payload, x.sig);
  if law_alignment(p) = 0.900 then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: signed alignment not stored (%)', law_alignment(p); end if;

  raise notice '  Release and pass (signed): % passed, % failed', passes, fails;
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;

reset role;
delete from private.ai_signing_key;
drop function test_r_read(uuid, numeric, text);
drop function test_r_review(uuid);
drop function test_r_vote(uuid, uuid, numeric);
update conditions_epoch set since = 'infinity';
update release_epoch set since = 'infinity';
