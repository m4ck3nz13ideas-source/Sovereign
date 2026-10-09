-- Open tallies, secret ballots (0046, rule 3).
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
  ('a2020202-0202-0202-0202-02020202020a', 'ballot-a@example.com'),
  ('b2020202-0202-0202-0202-02020202020b', 'ballot-b@example.com'),
  ('c2020202-0202-0202-0202-02020202020c', 'ballot-c@example.com'),
  ('d2020202-0202-0202-0202-02020202020d', 'ballot-outsider@example.com');

create or replace function test_ballot_ready(p_pid uuid, p_author uuid)
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

create or replace function test_ballot_vote(p_pid uuid, p_who uuid, p_level numeric, p_note text)
returns void language plpgsql as $$
begin
  perform set_config('test.uid', p_who::text, true);
  insert into proposal_reads (proposal_id, profile_id) values (p_pid, p_who) on conflict do nothing;
  perform cast_resonance(p_pid, p_level, p_level, p_level, p_note);
end $$;

set role app;

do $$
declare
  a uuid := 'a2020202-0202-0202-0202-02020202020a';
  b uuid := 'b2020202-0202-0202-0202-02020202020b';
  c uuid := 'c2020202-0202-0202-0202-02020202020c';
  outsider uuid := 'd2020202-0202-0202-0202-02020202020d';
  gid uuid; code text; pid uuid; n int; t text;
  passes int := 0; fails int := 0;
begin
  perform set_config('test.uid', a::text, true);
  gid := create_group('Ballot Test', 'x', 'local');
  code := create_invite(gid, 5, 14);
  perform set_config('test.uid', b::text, true); perform redeem_invite(code);
  perform set_config('test.uid', c::text, true); perform redeem_invite(code);

  perform set_config('test.uid', a::text, true);
  pid := test_propose(a, gid, 'local', null, 'A bench by the pond', 'x',
                      'There is nowhere to sit by the pond and older neighbours stop coming.');
  perform test_ballot_ready(pid, a);

  perform test_ballot_vote(pid, a, 0.90, 'Long overdue.');
  perform test_ballot_vote(pid, b, 0.80, null);
  perform test_ballot_vote(pid, c, 0.20, 'It will block the view.');

  -- While open: your own row, nothing more, and no anonymous tally yet.
  perform set_config('test.uid', b::text, true);
  select count(*)::int into n from resonance_votes where proposal_id = pid;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % response rows readable while open, expected only your own', n; end if;
  select count(*)::int into n from closed_responses(pid);
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the tally showed % responses before close', n; end if;
  select count(*)::int into n from closed_response_notes(pid);
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: notes showed before close'; end if;

  -- Close it.
  perform set_config('test.uid', a::text, true);
  perform close_proposal(pid);

  -- After close: still only your own row.
  perform set_config('test.uid', b::text, true);
  select count(*)::int into n from resonance_votes where proposal_id = pid;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % response rows readable after close, expected only your own', n; end if;
  select count(*)::int into n from resonance_votes where proposal_id = pid and profile_id <> b;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: somebody else''s response is readable after close'; end if;

  -- The tally is open: every response, no names, sorted by the numbers.
  select count(*)::int into n from closed_responses(pid);
  if n = 3 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the open tally had % responses, expected 3', n; end if;
  select string_agg(alignment::text, ',') into t from closed_responses(pid);
  if t = '0.900,0.800,0.200' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the tally was not sorted by the numbers: %', t; end if;

  select count(*)::int into n from closed_response_notes(pid);
  if n = 2 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: expected 2 notes, got %', n; end if;

  -- Somebody the proposal was not addressed to gets nothing.
  perform set_config('test.uid', outsider::text, true);
  begin
    perform * from closed_responses(pid);
    fails := fails + 1; raise warning 'FAIL: an outsider read the tally';
  exception when others then passes := passes + 1; end;
  begin
    perform * from closed_response_notes(pid);
    fails := fails + 1; raise warning 'FAIL: an outsider read the notes';
  exception when others then passes := passes + 1; end;

  raise notice ' ';
  raise notice '  Secret responses: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;

reset role;

-- THE ABSENCES. No select policy on resonance_votes lets anybody read a row
-- that is not theirs, and neither anonymous function can return who.
do $$
declare n int; cols text;
begin
  select count(*)::int into n from pg_policies
   where tablename = 'resonance_votes' and cmd in ('SELECT', 'ALL')
     and qual is distinct from '(profile_id = auth.uid())';
  if n <> 0 then raise exception 'FAIL: a select policy on resonance_votes reads beyond its author'; end if;

  select string_agg(a, ',') into cols
    from (select unnest(p.proargnames) a, unnest(p.proargmodes) m
            from pg_proc p where p.proname in ('closed_responses', 'closed_response_notes')) x
   where m = 't' and a ~* '(^id$|_id$|profile|name|who|author|voter|_at$)';
  if cols is not null then raise exception 'FAIL: an anonymous tally function returns an identifying column: %', cols; end if;

  raise notice '  Secret responses (absences): 2 passed, 0 failed';
end $$;

drop function test_ballot_ready(uuid, uuid);
drop function test_ballot_vote(uuid, uuid, numeric, text);
