-- Fixture for the concurrency harness.
--
-- Builds, idempotently, everything the four racing functions need and nothing
-- else: a group with a steward and two members, an invite with one use left, a
-- proposal that is open and closeable, and a second proposal for the
-- resonance-versus-close case.
--
-- It is a separate file rather than inline strings in the harness because the
-- shape has to match what 01_rules.sql builds — if a review or a law audit
-- stops being enough to close a proposal, this should fail the same way that
-- suite does.
--
-- Run as the owner. The harness then connects as `app` and the policies apply
-- to everything it does, which is the whole point.

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
  ('c0c00001-0000-0000-0000-000000000000', 'race1@example.com'),
  ('c0c00002-0000-0000-0000-000000000000', 'race2@example.com'),
  ('c0c00003-0000-0000-0000-000000000000', 'race3@example.com'),
  ('c0c00004-0000-0000-0000-000000000000', 'race4@example.com'),
  ('c0c00005-0000-0000-0000-000000000000', 'race5@example.com'),
  ('c0c00006-0000-0000-0000-000000000000', 'race6@example.com'),
  ('c0c00007-0000-0000-0000-000000000000', 'race7@example.com'),
  ('c0c00008-0000-0000-0000-000000000000', 'race8@example.com'),
  ('c0c00009-0000-0000-0000-000000000000', 'race9@example.com'),
  ('c0c0000a-0000-0000-0000-000000000000', 'race10@example.com')
on conflict (id) do nothing;

do $$
declare
  steward uuid := 'c0c00001-0000-0000-0000-000000000000';
  member2 uuid := 'c0c00002-0000-0000-0000-000000000000';
  member3 uuid := 'c0c00003-0000-0000-0000-000000000000';
  gid uuid;
  pid uuid;
  rid uuid;
  qid uuid;
  sid uuid;
  l   text;
  all_laws text[] := array[
    'sanctity_of_life','truth_and_transparency','sovereignty_of_the_individual',
    'equity_and_justice','subsidiarity','reciprocity_and_mutual_care',
    'stewardship_of_earth','harmony_of_diversity','right_use_of_power',
    'evolution_by_design'
  ];
begin
  perform set_config('test.uid', steward::text, true);

  -- A group, and a threshold that one voice can clear so the outcome of a
  -- close turns on the race rather than on arithmetic.
  insert into groups (name, slug, created_by, threshold_alignment, threshold_participation)
  values ('Race Conditions Collective', 'race-conditions', steward, 0.50, 0.00)
  returning id into gid;

  insert into group_members (group_id, profile_id, role) values
    (gid, steward, 'steward'),
    (gid, member2, 'member'),
    (gid, member3, 'member')
  on conflict do nothing;

  -- One use left. Ten people are about to go for it at once.
  insert into group_invites (group_id, code, created_by, max_uses, uses)
  values (gid, 'one-seat-left', steward, 1, 0);

  -- A second invite for the deterministic two-transaction case, so the thrash
  -- test and the interleaving test cannot interfere with each other.
  insert into group_invites (group_id, code, created_by, max_uses, uses)
  values (gid, 'one-seat-left-b', steward, 1, 0);

  -- ---------------------------------------------------------------- proposal
  -- Closeable: reviewed, audited clean, no open flags, one vote on the record.
  pid := test_propose(steward, gid, 'local', null,
          'Whether to buy the long ladder',
          'One ladder, kept at the hall.',
          'Everybody owns a ladder and uses it twice a year.');

  insert into proposal_reviews (
    proposal_id, prompt_id, prompt_version, model,
    clarity, evidence, feasibility, reversibility,
    values_alignment, risks, questions, memory_used, summary
  ) values (
    pid, 'proposal.review', '1.2.0', 'test',
    0.8, 0.7, 0.7, 0.6,
    '{"Restraint": 0.72}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
    'A reading.'
  ) returning id into rid;

  foreach l in array all_laws loop
    insert into law_assessments (proposal_id, review_id, law_id, verdict, reasoning,
                                 prompt_id, prompt_version, model)
    values (pid, rid, l, 'aligned', 'cleared for this fixture', 'law.audit', '1.0.0', 'test');
  end loop;

  update proposals set status = 'in_deliberation' where id = pid;

  insert into proposal_reads (proposal_id, profile_id) values
    (pid, steward), (pid, member2), (pid, member3)
  on conflict do nothing;

  perform set_config('test.uid', member2::text, true);
  perform cast_resonance(pid, 0.90, 0.80, 0.70, null);
  perform set_config('test.uid', steward::text, true);

  -- --------------------------------------------- the one the vote races with
  qid := test_propose(steward, gid, 'local', null,
          'Whether to repaint the hall door',
          'One coat, one Saturday.',
          'The door has been bare since the storm.');

  insert into proposal_reviews (
    proposal_id, prompt_id, prompt_version, model,
    clarity, evidence, feasibility, reversibility,
    values_alignment, risks, questions, memory_used, summary
  ) values (
    qid, 'proposal.review', '1.2.0', 'test',
    0.8, 0.7, 0.7, 0.6,
    '{"Restraint": 0.70}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
    'A reading.'
  ) returning id into sid;

  foreach l in array all_laws loop
    insert into law_assessments (proposal_id, review_id, law_id, verdict, reasoning,
                                 prompt_id, prompt_version, model)
    values (qid, sid, l, 'aligned', 'cleared for this fixture', 'law.audit', '1.0.0', 'test');
  end loop;

  update proposals set status = 'in_deliberation' where id = qid;

  insert into proposal_reads (proposal_id, profile_id) values
    (qid, steward), (qid, member2), (qid, member3)
  on conflict do nothing;

  perform set_config('test.uid', member2::text, true);
  perform cast_resonance(qid, 0.90, 0.80, 0.70, null);
  perform set_config('test.uid', steward::text, true);

  -- Hand the ids to the harness.
  create table if not exists race_fixture (k text primary key, v uuid);
  delete from race_fixture;
  insert into race_fixture (k, v) values
    ('group', gid), ('closeable', pid), ('vote_race', qid),
    ('steward', steward), ('member3', member3);
end $$;

grant select on race_fixture to app;
