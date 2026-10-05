-- A challenge can clear a violation, all at once or not at all (0034, rule 8).
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
  ('a9999999-9999-9999-9999-99999999999a', 'chal-author@example.com'),
  ('b9999999-9999-9999-9999-99999999999b', 'chal-member@example.com');

set role app;

do $$
declare
  ann uuid := 'a9999999-9999-9999-9999-99999999999a';
  ben uuid := 'b9999999-9999-9999-9999-99999999999b';
  laws text[] := array['sanctity_of_life','truth_and_transparency','sovereignty_of_the_individual',
    'equity_and_justice','subsidiarity','reciprocity_and_mutual_care','stewardship_of_earth',
    'harmony_of_diversity','right_use_of_power','continuous_evolution'];
  gid uuid; code text; pid uuid; viol_id uuid; chal uuid; chal2 uuid; l text;
  clean jsonb; n int; v int;
  passes int := 0; fails int := 0;
begin
  perform set_config('test.uid', ann::text, true);
  gid := create_group('Challenge Test', 'x', 'local');
  code := create_invite(gid, 5, 14);
  perform set_config('test.uid', ben::text, true);
  perform redeem_invite(code);

  perform set_config('test.uid', ann::text, true);
  pid := test_propose(ann, gid, 'local', null, 'Fence the common', 'x',
                      'Put a fence around the common so dogs stay off the pitch.');
  foreach l in array laws loop
    insert into law_assessments (proposal_id, law_id, verdict, reasoning, prompt_id, prompt_version, model)
    values (pid, l, case when l = 'sovereignty_of_the_individual' then 'violation' else 'aligned' end::law_verdict,
            'first reading', 'law.audit', '1.0.0', 'test');
  end loop;
  select id into viol_id from law_assessments where proposal_id = pid and verdict = 'violation';

  select violations into n from law_standing(pid);
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: setup should have one violation, has %', n; end if;

  select jsonb_agg(jsonb_build_object('law_id', x, 'verdict', 'aligned', 'reasoning', 'on re-reading'))
    into clean from unnest(laws) x;

  -- Ben challenges the violation.
  perform set_config('test.uid', ben::text, true);
  insert into law_challenges (assessment_id, proposal_id, challenger_id, argument)
  values (viol_id, pid, ben, 'The fence has a gate that is never locked, so nobody is kept out of anything.')
  returning id into chal;

  -- Somebody else cannot run the re-audit on Ben's challenge.
  perform set_config('test.uid', ann::text, true);
  begin
    perform record_challenge_audit(chal, clean, 'law.audit', '1.0.0', 'test');
    fails := fails + 1; raise warning 'FAIL: someone re-audited a challenge they did not raise';
  exception when others then passes := passes + 1; end;

  -- A broken re-audit changes nothing: the violation must still count.
  perform set_config('test.uid', ben::text, true);
  begin
    perform record_challenge_audit(chal, clean - 0, 'law.audit', '1.0.0', 'test');
    fails := fails + 1; raise warning 'FAIL: a nine-law re-audit was accepted';
  exception when others then passes := passes + 1; end;
  select violations into n from law_standing(pid);
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a failed re-audit cleared the violation anyway (%)', n; end if;

  -- The real re-audit clears it.
  v := record_challenge_audit(chal, clean, 'law.audit', '1.0.0', 'test');
  select violations, laws_assessed into n, v from law_standing(pid);
  if n = 0 and v = 10 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the challenge did not clear the violation (violations %, readings in force %)', n, v; end if;

  -- The old reading is kept, superseded.
  select count(*)::int into n from law_assessments where id = viol_id and superseded_at is not null;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the superseded reading was not kept as history'; end if;

  -- And the challenge cannot be spent twice.
  begin
    perform record_challenge_audit(chal, clean, 'law.audit', '1.0.0', 'test');
    fails := fails + 1; raise warning 'FAIL: one challenge produced two re-audits';
  exception when others then passes := passes + 1; end;

  raise notice ' ';
  raise notice '  Law challenge: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;

reset role;
