-- The mirror: your own responses read back to you, privately, with no
-- conclusion drawn and nothing read below the floor.
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
  ('a9000001-0000-0000-0000-000000000000', 'mirror1@example.com'),
  ('a9000002-0000-0000-0000-000000000000', 'mirror2@example.com');

set role app;

do $$
declare
  ann uuid := 'a9000001-0000-0000-0000-000000000000';
  ben uuid := 'a9000002-0000-0000-0000-000000000000';
  pid uuid; rid uuid; n int; d numeric; flag boolean; i int;
  passes int := 0; fails int := 0;
  all_laws text[] := array[
    'sanctity_of_life','truth_and_transparency','sovereignty_of_the_individual',
    'equity_and_justice','subsidiarity','reciprocity_and_mutual_care',
    'stewardship_of_earth','harmony_of_diversity','right_use_of_power',
    'continuous_evolution'];
  l text;
  -- Ann is cool on anything the audit flagged for stewardship and warm
  -- otherwise. Four of each, which is exactly the floor.
  cold numeric[] := array[0.30, 0.35, 0.25, 0.30];
  warm numeric[] := array[0.90, 0.85, 0.88, 0.92];
begin
  perform set_config('test.uid', ann::text, true);
  update profiles set place_local = 'Mirror Row', place_national = 'United Kingdom',
                      place_set_at = now()
   where id = ann;
  perform set_config('test.uid', ben::text, true);
  update profiles set place_local = 'Mirror Row', place_national = 'United Kingdom',
                      place_set_at = now()
   where id = ben;
  perform set_config('test.uid', ann::text, true);

  ------------------------------------------------- nothing to read at the start
  select responses into n from my_mirror_standing();
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % responses before anything happened', n; end if;

  select count(*)::int into n from my_law_mirror();
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the mirror read % laws from no responses', n; end if;

  ------------------------------------------- four with a stewardship tension
  for i in 1..4 loop
    pid := test_propose(ann, null, 'local', 'Mirror Row',
                        'Flagged proposal ' || i, 'One of the flagged ones.',
                        'Something about the verge that keeps coming back every year, number ' || i || '.');
    insert into proposal_reviews (proposal_id, prompt_id, prompt_version, model, summary)
    values (pid, 'proposal.review', '1.2.0', 'test', 'A reading.') returning id into rid;
    foreach l in array all_laws loop
      insert into law_assessments (proposal_id, review_id, law_id, verdict, reasoning,
                                   prompt_id, prompt_version, model)
      values (pid, rid, l,
              (case when l = 'stewardship_of_earth' then 'tension' else 'aligned' end)::law_verdict,
              'reasoning', 'law.audit', '1.0.0', 'test');
    end loop;
    update proposals set status = 'in_deliberation' where id = pid;
    insert into proposal_reads (proposal_id, profile_id) values (pid, ann);
    perform cast_resonance(pid, cold[i], 0.70, 0.70, null);
  end loop;

  -------------------------------------------------------- four clean ones
  for i in 1..4 loop
    pid := test_propose(ann, null, 'local', 'Mirror Row',
                        'Clean proposal ' || i, 'One of the clean ones.',
                        'Something uncontroversial about the bench that nobody objects to, number ' || i || '.');
    insert into proposal_reviews (proposal_id, prompt_id, prompt_version, model, summary)
    values (pid, 'proposal.review', '1.2.0', 'test', 'A reading.') returning id into rid;
    foreach l in array all_laws loop
      insert into law_assessments (proposal_id, review_id, law_id, verdict, reasoning,
                                   prompt_id, prompt_version, model)
      values (pid, rid, l, 'aligned', 'reasoning', 'law.audit', '1.0.0', 'test');
    end loop;
    update proposals set status = 'in_deliberation' where id = pid;
    insert into proposal_reads (proposal_id, profile_id) values (pid, ann);
    perform cast_resonance(pid, warm[i], 0.90, 0.90, null);
  end loop;

  ------------------------------------------------- the pattern is readable
  select responses into n from my_law_mirror() where law_id = 'stewardship_of_earth';
  if n = 4 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: expected 4 flagged responses, got %', n; end if;

  select enough into flag from my_law_mirror() where law_id = 'stewardship_of_earth';
  if flag then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: four responses did not reach the floor'; end if;

  -- Cold mean 0.30; baseline across all eight is about 0.59. Negative, and
  -- clearly so.
  select divergence into d from my_law_mirror() where law_id = 'stewardship_of_earth';
  if d < -0.2 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: divergence is % — expected clearly negative', d; end if;

  select your_mean into d from my_law_mirror() where law_id = 'stewardship_of_earth';
  if d = 0.300 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: mean on flagged proposals is % rather than 0.300', d; end if;

  ------------------------------- a law never flagged does not appear at all
  select count(*)::int into n from my_law_mirror() where law_id = 'subsidiarity';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a law that was never in tension appeared in the mirror'; end if;

  ------------------------------------------------- and one below the floor
  pid := test_propose(ann, null, 'local', 'Mirror Row',
                      'One equity tension', 'A single flagged case.',
                      'Something where who pays and who benefits are not the same people at all.');
  insert into proposal_reviews (proposal_id, prompt_id, prompt_version, model, summary)
  values (pid, 'proposal.review', '1.2.0', 'test', 'A reading.') returning id into rid;
  foreach l in array all_laws loop
    insert into law_assessments (proposal_id, review_id, law_id, verdict, reasoning,
                                 prompt_id, prompt_version, model)
    values (pid, rid, l,
            (case when l = 'equity_and_justice' then 'tension' else 'aligned' end)::law_verdict,
            'reasoning', 'law.audit', '1.0.0', 'test');
  end loop;
  update proposals set status = 'in_deliberation' where id = pid;
  insert into proposal_reads (proposal_id, profile_id) values (pid, ann);
  perform cast_resonance(pid, 0.10, 0.50, 0.50, null);

  select enough into flag from my_law_mirror() where law_id = 'equity_and_justice';
  if not flag then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: one response was read as a pattern'; end if;

  select divergence into d from my_law_mirror() where law_id = 'equity_and_justice';
  if d is null then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a divergence of % was reported below the floor', d; end if;

  select responses into n from my_law_mirror() where law_id = 'equity_and_justice';
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the count below the floor is % rather than 1', n; end if;

  ---------------------------------------- it is nobody else's to read, ever
  perform set_config('test.uid', ben::text, true);
  select count(*)::int into n from my_law_mirror();
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: another person read % rows of somebody''s mirror', n; end if;

  select responses into n from my_mirror_standing();
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: my_mirror_standing leaked somebody else''s count'; end if;

  ------------------------------- and there is no version that takes an id
  select count(*)::int into n
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public'
     and p.proname in ('my_law_mirror', 'my_mirror_standing')
     and p.pronargs > 0;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % mirror functions take an argument — one of them will end up taking somebody else''s id', n;
  end if;

  ---------------------------------------------- nothing about it is stored
  select count(*)::int into n
    from information_schema.tables
   where table_schema = 'public' and table_name like '%mirror%';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the mirror grew % tables — it is derived, not recorded', n; end if;

  raise notice ' ';
  raise notice '  Mirror: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then
    raise exception '% checks failed', fails;
  end if;
end $$;

reset role;
