-- People: two relationships, two jobs, and neither of them touching what
-- anybody is allowed to decide.
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
  ('b0000001-0000-0000-0000-000000000000', 'ppl1@example.com'),
  ('b0000002-0000-0000-0000-000000000000', 'ppl2@example.com'),
  ('b0000003-0000-0000-0000-000000000000', 'ppl3@example.com');

set role app;

do $$
declare
  ann uuid := 'b0000001-0000-0000-0000-000000000000';
  ben uuid := 'b0000002-0000-0000-0000-000000000000';
  zoe uuid := 'b0000003-0000-0000-0000-000000000000';
  pid uuid; rid uuid; n int; msg text; ok_flag boolean; found_id uuid; state text;
  passes int := 0; fails int := 0;
  all_laws text[] := array[
    'sanctity_of_life','truth_and_transparency','sovereignty_of_the_individual',
    'equity_and_justice','subsidiarity','reciprocity_and_mutual_care',
    'stewardship_of_earth','harmony_of_diversity','right_use_of_power',
    'continuous_evolution'];
  l text;
begin
  ------------------------------------------------- three people, two streets
  perform set_config('test.uid', ann::text, true);
  update profiles set handle = 'ann', display_name = 'Ann',
                      place_local = 'Fore Street', place_national = 'United Kingdom',
                      place_set_at = now()
   where id = ann;

  perform set_config('test.uid', ben::text, true);
  update profiles set handle = 'ben', display_name = 'Ben',
                      place_local = 'Fore Street', place_national = 'United Kingdom',
                      place_set_at = now()
   where id = ben;

  perform set_config('test.uid', zoe::text, true);
  update profiles set handle = 'zoe', display_name = 'Zoe',
                      place_local = 'Mill Lane', place_national = 'United Kingdom',
                      place_set_at = now()
   where id = zoe;

  ------------------------------------------------- a handle has a shape
  perform set_config('test.uid', zoe::text, true);
  begin
    update profiles set handle = 'Zoe With Spaces' where id = zoe;
    fails := fails + 1;
    raise warning 'FAIL: a handle with capitals and spaces was accepted';
  exception when others then passes := passes + 1;
  end;

  ------------------------------------- a stranger is invisible until there is a reason
  perform set_config('test.uid', ann::text, true);
  select count(*)::int into n from profiles where id = zoe;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a stranger on another street was readable'; end if;

  ------------------------------------------- but a handle is an address
  select id into found_id from find_person('zoe');
  if found_id = zoe then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: an exact handle did not find the person'; end if;

  select id into found_id from find_person('ZOE  ');
  if found_id = zoe then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a handle was not matched case- and space-insensitively'; end if;

  ------------------------------------------------- and there is no directory
  select count(*)::int into n from find_person('z');
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a partial handle returned % people', n; end if;

  ------------------------------------------------------------- following
  perform follow_person(zoe);
  if follows_person(zoe) then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: following did not take'; end if;

  select count(*)::int into n from profiles where id = zoe;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: following someone did not make them readable'; end if;

  ------------------------------------------------ it is not mutual and not friendship
  if not is_friend(zoe) then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: following made them a friend'; end if;

  perform set_config('test.uid', zoe::text, true);
  if not follows_person(ann) then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: following was mutual'; end if;

  ------------------------------------ and Zoe cannot see who else Ann follows
  select count(*)::int into n from follows where follower_id = ann;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: Zoe saw % of Ann''s follows — expected only the edge to herself', n;
  end if;

  perform set_config('test.uid', ben::text, true);
  select count(*)::int into n from follows;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: an unrelated person read % rows of the follow graph', n; end if;

  ------------------------------------------------------------ nobody follows themselves
  perform set_config('test.uid', ann::text, true);
  begin
    perform follow_person(ann);
    fails := fails + 1;
    raise warning 'FAIL: somebody followed themselves';
  exception when others then passes := passes + 1;
  end;

  ------------------------------------------------------ asking to be friends
  perform request_friendship(ben);
  if not is_friend(ben) then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: asking made them a friend without an answer'; end if;

  ------------------------------------------------ you cannot accept your own ask
  begin
    perform accept_friendship(ben);
    fails := fails + 1;
    raise warning 'FAIL: somebody accepted their own friend request';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%they have to answer%' then passes := passes + 1;
    else fails := fails + 1;
      raise warning 'FAIL: wrong error accepting your own request: %', msg; end if;
  end;

  ------------------------------------------------- and they can see they were asked
  perform set_config('test.uid', ben::text, true);
  select direction into state from friendship_requests() where profile_id = ann;
  if state = 'they asked' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the request reads as "%" to the person asked', state; end if;

  perform accept_friendship(ann);
  if is_friend(ann) then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: accepting did not take'; end if;

  perform set_config('test.uid', ann::text, true);
  if is_friend(ben) then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: friendship was one-directional'; end if;

  ------------------------------------ one row per pair, whichever way round
  select count(*)::int into n from friendships
   where (lower_id = ann and higher_id = ben) or (lower_id = ben and higher_id = ann);
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % friendship rows for one pair', n; end if;

  ------------------------------------------ asking back is an acceptance
  perform set_config('test.uid', zoe::text, true);
  perform request_friendship(ann);
  perform set_config('test.uid', ann::text, true);
  perform request_friendship(zoe);
  if is_friend(zoe) then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: two people asking each other did not become friends'; end if;

  ---------------------------------------- friendship gives no private access
  perform set_config('test.uid', ben::text, true);
  insert into entries (profile_id, mode, body)
  values (ben, 'journal', 'Something Ben wrote for himself and nobody else.');

  perform set_config('test.uid', ann::text, true);
  select count(*)::int into n from entries where profile_id = ben;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a friend read % of Ben''s private entries', n; end if;

  ------------------------------------ nor any say in what anybody may decide
  -- Zoe lives on Mill Lane. Ann is now her friend AND follows her. Neither
  -- puts Zoe anywhere near a Fore Street proposal.
  pid := test_propose(ann, null, 'local', 'Fore Street',
                      'Fix the gate', 'It does not shut.',
                      'The gate at the end has not latched since the winter.');
  insert into proposal_reviews (proposal_id, prompt_id, prompt_version, model, summary)
  values (pid, 'proposal.review', '1.2.0', 'test', 'A reading.') returning id into rid;
  foreach l in array all_laws loop
    insert into law_assessments (proposal_id, review_id, law_id, verdict, reasoning,
                                 prompt_id, prompt_version, model)
    values (pid, rid, l, 'aligned', 'clear', 'law.audit', '1.0.0', 'test');
  end loop;
  update proposals set status = 'in_deliberation' where id = pid;

  perform set_config('test.uid', zoe::text, true);
  select count(*)::int into n from proposals where id = pid;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a friend on another street could read the proposal'; end if;

  begin
    insert into proposal_reads (proposal_id, profile_id) values (pid, zoe);
    perform cast_resonance(pid, 0.9, 0.9, 0.9, null);
    fails := fails + 1;
    raise warning 'FAIL: friendship got somebody into a decision they are not part of';
  exception when others then passes := passes + 1;
  end;

  ------------------------------------------------- the feed carries what they did
  perform set_config('test.uid', ben::text, true);
  select count(*)::int into n from people_feed(30)
   where kind = 'proposal.submitted' and subject_id = pid;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a friend''s submitted proposal is not in the feed (% rows)', n;
  end if;

  ---------------------------------- and does not carry who resonated on what
  insert into proposal_reads (proposal_id, profile_id) values (pid, ben);
  perform cast_resonance(pid, 0.85, 0.85, 0.85, null);

  perform set_config('test.uid', ann::text, true);
  select count(*)::int into n from people_feed(50) where kind = 'resonance.recorded';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the feed reported % resonance events', n; end if;

  ------------------------------- and carries nothing from a place you are not in
  perform set_config('test.uid', zoe::text, true);
  select count(*)::int into n from people_feed(50) where subject_id = pid;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the feed leaked a Fore Street proposal to Mill Lane'; end if;

  ------------------------------------------------- a public record, not a score
  perform set_config('test.uid', ben::text, true);
  select proposals_written into n from person_standing(ann);
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: expected 1 proposal written, got %', n; end if;

  select you_are_friends into ok_flag from person_standing(ann);
  if ok_flag then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: person_standing does not know they are friends'; end if;

  select count(*)::int into n
    from information_schema.columns
   where table_name = 'friendships' and column_name in ('score', 'rank', 'weight');
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the friendship table grew something that weights people'; end if;

  ------------------------------------------------------------- ending it
  perform end_friendship(ann);
  if not is_friend(ann) then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: ending a friendship did not take'; end if;

  perform set_config('test.uid', ann::text, true);
  if not is_friend(ben) then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: it only ended on one side'; end if;

  raise notice ' ';
  raise notice '  People: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then
    raise exception '% checks failed', fails;
  end if;
end $$;

reset role;
