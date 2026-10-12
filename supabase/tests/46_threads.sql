-- Threads (0052): circles of friends, a group's chat, a proposal's chat.
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
  ('e4600001-0000-0000-0000-000000000000', 'thread1@example.com'),
  ('e4600002-0000-0000-0000-000000000000', 'thread2@example.com'),
  ('e4600003-0000-0000-0000-000000000000', 'thread3@example.com'),
  ('e4600004-0000-0000-0000-000000000000', 'thread4@example.com');

set role app;

do $$
declare
  ann uuid := 'e4600001-0000-0000-0000-000000000000';
  ben uuid := 'e4600002-0000-0000-0000-000000000000';
  cat uuid := 'e4600003-0000-0000-0000-000000000000';
  eve uuid := 'e4600004-0000-0000-0000-000000000000';
  circle uuid; gid uuid; gthread uuid; gthread2 uuid; prop uuid; pthread uuid;
  n int; msg text; flag boolean;
  passes int := 0; fails int := 0;
begin
  perform set_config('test.uid', ann::text, true);
  update profiles set display_name = 'Ann' where id = ann;
  perform set_config('test.uid', ben::text, true);
  update profiles set display_name = 'Ben' where id = ben;
  perform set_config('test.uid', cat::text, true);
  update profiles set display_name = 'Cat' where id = cat;
  perform set_config('test.uid', eve::text, true);
  update profiles set display_name = 'Eve' where id = eve;

  ------------------------------------------- a circle needs friends in it
  perform set_config('test.uid', ann::text, true);
  begin
    perform create_circle('Strangers', array[ben]);
    fails := fails + 1; raise warning 'FAIL: a circle was made with somebody who is not a friend';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%only add friends%' then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: wrong error for a stranger in a circle: %', msg; end if;
  end;

  -- Ann and Ben, Ben and Cat become friends. Ann and Cat do not.
  perform request_friendship(ben);
  perform set_config('test.uid', ben::text, true);
  perform accept_friendship(ann);
  perform request_friendship(cat);
  perform set_config('test.uid', cat::text, true);
  perform accept_friendship(ben);

  perform set_config('test.uid', ann::text, true);
  circle := create_circle('Allotment', array[ben]);
  perform send_thread_message(circle, 'Water rota for August?');

  ---------------------------------------------------- members can read it
  perform set_config('test.uid', ben::text, true);
  select count(*)::int into n from thread_messages_page(circle, 50);
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a member read % messages, expected 1', n; end if;

  select unread into n from my_threads() where thread_id = circle;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: expected 1 unread for the other member, got %', n; end if;

  perform set_config('test.uid', ann::text, true);
  select unread into n from my_threads() where thread_id = circle;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: your own message counted as unread (%)', n; end if;

  ------------------------------------------------- outsiders see nothing
  perform set_config('test.uid', eve::text, true);
  select count(*)::int into n from thread_messages_page(circle, 50);
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: an outsider read % messages through the function', n; end if;

  select count(*)::int into n from thread_messages where thread_id = circle;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: an outsider read % messages through the table', n; end if;

  select count(*)::int into n from threads where id = circle;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: an outsider can see the circle exists'; end if;

  begin
    perform send_thread_message(circle, 'Can I join?');
    fails := fails + 1; raise warning 'FAIL: an outsider wrote into a circle';
  exception when others then passes := passes + 1;
  end;

  -------------------------------------------- the table is not a way in
  begin
    insert into thread_messages (thread_id, author_id, body) values (circle, eve, 'Through the side door.');
    fails := fails + 1; raise warning 'FAIL: a message went straight into the table';
  exception when others then passes := passes + 1;
  end;

  ---------------------------- a member adds their own friend, nobody else's
  perform set_config('test.uid', ann::text, true);
  begin
    perform add_to_circle(circle, cat);
    fails := fails + 1; raise warning 'FAIL: Ann added somebody she is not friends with';
  exception when others then passes := passes + 1;
  end;

  perform set_config('test.uid', ben::text, true);
  perform add_to_circle(circle, cat);
  perform set_config('test.uid', cat::text, true);
  select count(*)::int into n from thread_messages_page(circle, 50);
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a newly added friend read % messages, expected 1', n; end if;

  ---------------------------------------------- leaving takes you out
  perform leave_circle(circle);
  select count(*)::int into n from thread_messages_page(circle, 50);
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: somebody who left still reads the circle'; end if;

  ------------------------------------------------------------ a group's chat
  perform set_config('test.uid', ann::text, true);
  gid := create_group('Threads Street', 'Testing a group''s chat.');

  perform set_config('test.uid', ben::text, true);
  begin
    perform thread_for_group(gid);
    fails := fails + 1; raise warning 'FAIL: a non-member opened a group''s chat';
  exception when others then passes := passes + 1;
  end;

  select count(*)::int into n from my_threads() where kind = 'group' and ref_id = gid;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a group''s chat is listed for a non-member'; end if;

  perform set_config('test.uid', ann::text, true);
  select count(*)::int into n from my_threads() where kind = 'group' and ref_id = gid and thread_id is null;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a member''s group is not listed before anybody spoke'; end if;

  gthread := thread_for_group(gid);
  gthread2 := thread_for_group(gid);
  if gthread = gthread2 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: opening a group''s chat twice made two'; end if;
  perform send_thread_message(gthread, 'Skip day is Saturday.');

  -- Ben joins the group (as its membership would), and is in the chat with
  -- nothing else done.
  reset role;
  insert into group_members (group_id, profile_id) values (gid, ben);
  set role app;
  perform set_config('test.uid', ben::text, true);
  select count(*)::int into n from thread_messages_page(gthread, 50);
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: joining the group did not open its chat (% messages)', n; end if;

  reset role;
  delete from group_members where group_id = gid and profile_id = ben;
  set role app;
  perform set_config('test.uid', ben::text, true);
  select count(*)::int into n from thread_messages_page(gthread, 50);
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: leaving the group did not close its chat'; end if;

  --------------------------------------------------------- a proposal's chat
  perform set_config('test.uid', ann::text, true);
  reset role;
  prop := test_propose(ann, gid, 'local', null, 'Share the threads ladder',
    'One ladder for the street, kept in the shed by number four.', 'threads');
  set role app;

  perform set_config('test.uid', ann::text, true);
  pthread := thread_for_proposal(prop);
  perform send_thread_message(pthread, 'Who has a padlock?');

  perform set_config('test.uid', ben::text, true);
  begin
    perform thread_for_proposal(prop);
    fails := fails + 1; raise warning 'FAIL: somebody with no part in a proposal opened its chat';
  exception when others then passes := passes + 1;
  end;
  select count(*)::int into n from thread_messages_page(pthread, 50);
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a non-backer read a proposal''s chat'; end if;

  -- Backing it, in the open, is what lets you in.
  reset role;
  insert into proposal_needs (id, proposal_id, kind, description, quantity, unit)
  values ('e4600010-0000-0000-0000-000000000000', prop, 'time', 'Fit the hooks', 2, 'hours')
  on conflict do nothing;
  insert into commitments (need_id, proposal_id, profile_id, quantity)
  values ('e4600010-0000-0000-0000-000000000000', prop, ben, 2);
  set role app;

  perform set_config('test.uid', ben::text, true);
  select count(*)::int into n from thread_messages_page(pthread, 50);
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a backer could not read the proposal''s chat (% messages)', n; end if;

  select members into n from thread_info(pthread);
  if n = 2 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the proposal chat counts % people, expected 2', n; end if;

  reset role;
  update commitments set withdrawn_at = now() where proposal_id = prop and profile_id = ben;
  set role app;
  perform set_config('test.uid', ben::text, true);
  select count(*)::int into n from thread_messages_page(pthread, 50);
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: withdrawing a commitment left the chat open'; end if;

  ----------------------------------------------- none of it reached the record
  select count(*)::int into n from ledger_events where kind like 'thread%' or kind like 'circle%';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % chat events reached the public record', n; end if;

  ------------------------------------------------- signed-out: nothing at all
  if not has_function_privilege('anon', 'my_threads()', 'execute')
     and not has_function_privilege('anon', 'send_thread_message(uuid, text)', 'execute')
     and not has_table_privilege('anon', 'public.thread_messages', 'select') then
    passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: a signed-out visitor can reach threads'; end if;

  if has_function_privilege('authenticated', 'my_threads()', 'execute')
     and has_function_privilege('authenticated', 'create_circle(text, uuid[])', 'execute') then
    passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: signed-in members cannot use threads'; end if;

  raise notice ' ';
  raise notice '  Threads: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then
    raise exception '% checks failed', fails;
  end if;
end $$;

reset role;
