-- A group has a charter, and from three members it changes by proposal (0057).
--   * the members_self_insert side door is shut;
--   * founders write the charter directly, and every version is kept;
--   * from three members a direct edit is refused;
--   * a charter-change proposal is checked, fixed once submitted, and enacted
--     the moment it passes, with the proposal on the revision;
--   * the charter's own rules hold: who may propose, who may invite.
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
  ('a5050505-0505-0505-0505-05050505050a', 'charter-ann@example.com'),
  ('b5050505-0505-0505-0505-05050505050b', 'charter-ben@example.com'),
  ('c5050505-0505-0505-0505-05050505050c', 'charter-cat@example.com'),
  ('d5050505-0505-0505-0505-05050505050d', 'charter-dan@example.com');

create table test50 (slot text primary key, v uuid);
grant select, insert on test50 to authenticated, app;

------------------------------------------------------------- the side door
do $$
declare
  ann uuid := 'a5050505-0505-0505-0505-05050505050a';
  gid uuid;
begin
  perform set_config('test.uid', ann::text, true);
  gid := create_group('Charter Close', 'Six houses and a shared garden.', 'local');
  insert into test50 values ('gid', gid);
end $$;

set role authenticated;
do $$
declare
  dan uuid := 'd5050505-0505-0505-0505-05050505050d';
  gid uuid := (select v from test50 where slot = 'gid');
  passes int := 0; fails int := 0;
begin
  perform set_config('test.uid', dan::text, true);
  begin
    insert into group_members (group_id, profile_id, role) values (gid, dan, 'owner');
    fails := fails + 1; raise warning 'FAIL: a stranger made themselves owner of a group';
  exception when others then passes := passes + 1; end;
  raise notice '  Charters (side door): % passed, % failed', passes, fails;
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;
reset role;

set role app;
do $$
declare
  ann uuid := 'a5050505-0505-0505-0505-05050505050a';
  ben uuid := 'b5050505-0505-0505-0505-05050505050b';
  cat uuid := 'c5050505-0505-0505-0505-05050505050c';
  dan uuid := 'd5050505-0505-0505-0505-05050505050d';
  gid uuid := (select v from test50 where slot = 'gid');
  code text; p uuid; l text; n int; o decision_outcome; r record;
  passes int := 0; fails int := 0;
begin
  perform set_config('test.uid', ann::text, true);

  -------------------------------------------------------- revision one
  select count(*)::int into n from charter_revisions where group_id = gid and revision = 1;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a new group has no first charter revision'; end if;

  ----------------------------------------------- founders write it directly
  update groups set goal = 'A garden everyone can use by spring.', proposers = 'stewards',
                    ai_context = 'Small, neighbourly, money is tight.'
   where id = gid;
  if (select proposers from groups where id = gid) = 'stewards' then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: a founder could not write the charter'; end if;
  if (select max(revision) from charter_revisions where group_id = gid) = 2 then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: the edit was not kept as revision two'; end if;

  -- Members only invite where the charter says so.
  code := create_invite(gid, 5, 14);
  perform set_config('test.uid', ben::text, true); perform redeem_invite(code);
  perform set_config('test.uid', cat::text, true); perform redeem_invite(code);
  perform set_config('test.uid', ben::text, true);
  begin
    perform create_invite(gid, 1, 7);
    fails := fails + 1; raise warning 'FAIL: a member invited where only stewards may';
  exception when others then passes := passes + 1; end;

  ------------------------------------------- three members: no direct edit
  perform set_config('test.uid', ann::text, true);
  begin
    update groups set proposers = 'members' where id = gid;
    fails := fails + 1; raise warning 'FAIL: a steward rewrote the charter of a three-member group directly';
  exception when others then passes := passes + 1; end;
  -- A name is not the charter.
  update groups set name = 'Charter Close Garden' where id = gid;
  if (select name from groups where id = gid) = 'Charter Close Garden' then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: renaming the group was caught by the charter guard'; end if;

  ------------------------------------------------- who may propose
  perform set_config('test.uid', ben::text, true);
  begin
    perform test_propose(ben, gid, 'local', null, 'Plant beans', 'x', 'Nobody has planted the south bed this year.');
    fails := fails + 1; raise warning 'FAIL: a member proposed where only stewards may';
  exception when others then passes := passes + 1; end;

  ------------------------------------ a charter change: checked, then fixed
  begin
    insert into proposals (group_id, author_id, title, summary, body, intent, change, constraints, risks, alternatives,
                           scope, charter_change)
    select gid, ben, 'Bad change', 'x', 'x', repeat('i', 60), repeat('c', 60), repeat('k', 40), repeat('r', 60), repeat('a', 60),
           'local', '{"threshold_alignment": 0.1}'::jsonb;
    fails := fails + 1; raise warning 'FAIL: a charter change touching a non-charter field was accepted';
  exception when others then passes := passes + 1; end;

  perform set_config('test.uid', ann::text, true);
  p := test_propose(ann, gid, 'local', null, 'Water butts', 'x',
                    'The garden has no water supply nearer than the end house.');
  -- test_propose has no charter_change argument, and the column is fixed
  -- after insert, so the charter proposal is made in one insert below; this
  -- one shows the freeze.
  begin
    update proposals set charter_change = '{"proposers":"members"}'::jsonb where id = p;
    fails := fails + 1; raise warning 'FAIL: a charter change was attached after submission';
  exception when others then passes := passes + 1; end;

  raise notice '  Charters (founding and guard): % passed, % failed', passes, fails;
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;
reset role;

-- A charter proposal made the way submitProposal makes one: in one insert.
-- Seated through the app path for the readiness binding.
set role app;
do $$
declare
  ann uuid := 'a5050505-0505-0505-0505-05050505050a';
  ben uuid := 'b5050505-0505-0505-0505-05050505050b';
  cat uuid := 'c5050505-0505-0505-0505-05050505050c';
  gid uuid := (select v from test50 where slot = 'gid');
  p uuid; l text; o decision_outcome; body text; r record;
  passes int := 0; fails int := 0;
begin
  perform set_config('test.uid', ben::text, true);
  body := '## What this is solving' || chr(10) || 'Only stewards can propose here, and members have ideas that never reach anyone.'
       || chr(10) || chr(10) || '## What would change' || chr(10) || 'Any member could put a proposal to the group, read and decided like any other.'
       || chr(10) || chr(10) || '## What it takes' || chr(10) || 'Nothing beyond the time to read proposals.'
       || chr(10) || chr(10) || '## What could go wrong' || chr(10) || 'More proposals than the group has time for; three months would show whether it is too many.'
       || chr(10) || chr(10) || '## What else was considered' || chr(10) || 'Asking a steward to put ideas forward, which has not happened once this year.';
  insert into proposal_readiness (author_id, body_sha256, readiness, verdict, sections, prompt_id, prompt_version, model)
  values (ben, proposal_body_hash(body), 0.82, 'Sharpened in a test.', '[]'::jsonb, 'proposal.sharpen', '1.0.0', 'test');
  insert into proposals (group_id, author_id, title, summary, body, intent, change, constraints, risks, alternatives,
                         scope, charter_change)
  values (gid, ben, 'Let members propose', 'Any member can propose.', body,
          'Only stewards can propose here, and members have ideas that never reach anyone.',
          'Any member could put a proposal to the group, read and decided like any other.',
          'Nothing beyond the time to read proposals.',
          'More proposals than the group has time for; three months would show whether it is too many.',
          'Asking a steward to put ideas forward, which has not happened once this year.',
          'local', '{"proposers":"members"}'::jsonb)
  returning id into p;
  passes := passes + 1;   -- a member may propose a charter change even where only stewards propose

  insert into proposal_reviews (proposal_id, prompt_id, prompt_version, model, summary)
  values (p, 'proposal.review', '1.2.0', 'test', 'A reading.');
  foreach l in array universal_law_ids() loop
    insert into law_assessments (proposal_id, law_id, verdict, reasoning, prompt_id, prompt_version, model)
    values (p, l, 'aligned', 'clear', 'law.audit', '1.1.0', 'test');
  end loop;
  update proposals set status = 'in_deliberation' where id = p;

  perform set_config('test.uid', ann::text, true);
  perform record_proposal_conditions(p, 3, null, '[]'::jsonb, '[]'::jsonb,
    'Every member is affected by who may propose; all three should respond.',
    'proposal.conditions', '1.2.0', 'test');
  foreach l in array array[ann::text, ben::text, cat::text] loop
    perform set_config('test.uid', l, true);
    insert into proposal_reads (proposal_id, profile_id) values (p, l::uuid) on conflict do nothing;
    perform cast_resonance(p, 0.8, 0.8, 0.5, null);
  end loop;

  perform set_config('test.uid', ann::text, true);
  o := close_proposal(p);
  if o = 'passed' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the charter proposal did not pass (%)', o; end if;

  if (select proposers from groups where id = gid) = 'members' then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: passing did not enact the charter change'; end if;

  select * into r from charter_revisions where group_id = gid order by revision desc limit 1;
  if r.proposal_id = p and r.proposers = 'members' then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: the revision does not name the proposal that made it'; end if;

  if (select charter_enacted_at from proposals where id = p) is not null then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: the proposal does not say it was enacted'; end if;

  if exists (select 1 from ledger_events where kind = 'group.charter_changed' and subject_id = p) then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: the change is not on the ledger'; end if;

  -- And now Ben may propose an ordinary proposal.
  perform set_config('test.uid', ben::text, true);
  perform test_propose(ben, gid, 'local', null, 'Plant beans', 'x', 'Nobody has planted the south bed this year.');
  passes := passes + 1;

  raise notice ' ';
  raise notice '  Charters: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;
reset role;

do $$
declare n int;
begin
  select count(*)::int into n from charter_revisions;
  if has_table_privilege('authenticated', 'charter_revisions', 'insert')
     or has_table_privilege('authenticated', 'charter_revisions', 'update')
     or has_table_privilege('authenticated', 'charter_revisions', 'delete') then
    raise exception 'FAIL: charter revisions can be written directly';
  end if;
  raise notice '  Charters (append-only): 1 passed, 0 failed';
end $$;

drop table test50;
update conditions_epoch set since = 'infinity';
