-- Chat: private to two people, with read state that belongs to the reader.
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
  ('d0000001-0000-0000-0000-000000000000', 'chat1@example.com'),
  ('d0000002-0000-0000-0000-000000000000', 'chat2@example.com'),
  ('d0000003-0000-0000-0000-000000000000', 'chat3@example.com');

set role app;

do $$
declare
  ann uuid := 'd0000001-0000-0000-0000-000000000000';
  ben uuid := 'd0000002-0000-0000-0000-000000000000';
  eve uuid := 'd0000003-0000-0000-0000-000000000000';
  n int; msg text; mid uuid; body text; flag boolean;
  passes int := 0; fails int := 0;
begin
  perform set_config('test.uid', ann::text, true);
  update profiles set display_name = 'Ann', handle = 'chatann' where id = ann;
  perform set_config('test.uid', ben::text, true);
  update profiles set display_name = 'Ben', handle = 'chatben' where id = ben;
  perform set_config('test.uid', eve::text, true);
  update profiles set display_name = 'Eve', handle = 'chateve' where id = eve;

  ------------------------------------------- strangers cannot start talking
  perform set_config('test.uid', ann::text, true);
  begin
    perform send_message(ben, 'Hello, we have never agreed to this.');
    fails := fails + 1;
    raise warning 'FAIL: a message was sent without a friendship';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%not friends%' then passes := passes + 1;
    else fails := fails + 1;
      raise warning 'FAIL: wrong error sending to a stranger: %', msg; end if;
  end;

  ------------------------------------- and following alone is not enough
  perform follow_person(ben);
  begin
    perform send_message(ben, 'Following you is not the same as knowing you.');
    fails := fails + 1;
    raise warning 'FAIL: following was enough to open a conversation';
  exception when others then passes := passes + 1;
  end;

  ------------------------------------------------- once both have agreed
  perform request_friendship(ben);
  perform set_config('test.uid', ben::text, true);
  perform accept_friendship(ann);
  perform set_config('test.uid', ann::text, true);

  mid := send_message(ben, 'Are you going to the thing about the wall on Thursday?');
  select count(*)::int into n from conversation_with(ben, 50);
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: expected 1 message, got %', n; end if;

  ---------------------------------------------- your own does not read as unread
  select unread into n from my_conversations() where profile_id = ben;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: your own message sat in your unread count (%)', n; end if;

  ------------------------------------------------- theirs does, for them
  perform set_config('test.uid', ben::text, true);
  select unread into n from my_conversations() where profile_id = ann;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: expected 1 unread for the recipient, got %', n; end if;

  select last_was_mine into flag from my_conversations() where profile_id = ann;
  if not flag then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the recipient is told the last message was theirs'; end if;

  perform mark_conversation_read(ann);
  select unread into n from my_conversations() where profile_id = ann;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: marking read left % unread', n; end if;

  ------------------------------ and the sender cannot tell whether it was read
  perform set_config('test.uid', ann::text, true);
  select count(*)::int into n from chat_marks where profile_id = ben;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: one person read the other''s read marker — that is a read receipt'; end if;

  select count(*)::int into n
    from information_schema.columns
   where table_name = 'messages'
     and column_name in ('read_at', 'delivered_at', 'seen_at', 'typing');
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: messages grew % columns that make people anxious', n; end if;

  ----------------------------------------------- nobody else can read any of it
  perform set_config('test.uid', eve::text, true);
  select count(*)::int into n from messages;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a third person read % private messages', n; end if;

  select count(*)::int into n from conversation_with(ann, 50);
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a third person read the conversation through the function'; end if;

  ------------------------------------------ nor write into somebody's thread
  begin
    insert into messages (lower_id, higher_id, author_id, body)
    values (least(ann, ben), greatest(ann, ben), eve, 'Slipping this in.');
    select count(*)::int into n from messages where author_id = eve;
    if n = 0 then passes := passes + 1; else fails := fails + 1;
      raise warning 'FAIL: a third person wrote into somebody else''s conversation'; end if;
  exception when others then passes := passes + 1;
  end;

  ------------------------------------------ nor forge one between two others
  begin
    insert into messages (lower_id, higher_id, author_id, body)
    values (least(ann, ben), greatest(ann, ben), ann, 'Words Ann never said.');
    select count(*)::int into n from messages where body = 'Words Ann never said.';
    if n = 0 then passes := passes + 1; else fails := fails + 1;
      raise warning 'FAIL: somebody put words in another person''s mouth'; end if;
  exception when others then passes := passes + 1;
  end;

  ------------------------------------------------ you can unsay your own
  perform set_config('test.uid', ann::text, true);
  perform send_message(ben, 'Something said in haste that I would rather not have.');
  select id into mid from conversation_with(ben, 50) where mine order by created_at desc limit 1;
  delete from messages where id = mid;
  select count(*)::int into n from conversation_with(ben, 50);
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: deleting your own message left % behind', n; end if;

  ------------------------------------------------- but not somebody else's
  perform set_config('test.uid', ben::text, true);
  perform send_message(ann, 'Yes, I will be there.');
  perform set_config('test.uid', ann::text, true);
  select id into mid from conversation_with(ben, 50) where not mine order by created_at desc limit 1;
  delete from messages where id = mid;
  select count(*)::int into n from conversation_with(ben, 50) where id = mid;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: one person deleted the other''s message'; end if;

  ------------------------------- ending it stops new ones and keeps the old
  perform end_friendship(ben);

  begin
    perform send_message(ben, 'One more thing, now that we are not friends.');
    fails := fails + 1;
    raise warning 'FAIL: a message was sent after the friendship ended';
  exception when others then passes := passes + 1;
  end;

  select count(*)::int into n from conversation_with(ben, 50);
  if n = 2 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: ending the friendship left % messages instead of 2', n; end if;

  perform set_config('test.uid', ben::text, true);
  select count(*)::int into n from conversation_with(ann, 50);
  if n = 2 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the other person lost the conversation when it ended (% left)', n; end if;

  ------------------------------------ and it drops off the list of conversations
  select count(*)::int into n from my_conversations() where profile_id = ann;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: an ended friendship is still listed as a conversation'; end if;

  ------------------------------------------- nothing here reached the ledger
  select count(*)::int into n from ledger_events where kind like 'message%';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % private messages reached the public record', n; end if;

  raise notice ' ';
  raise notice '  Chat: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then
    raise exception '% checks failed', fails;
  end if;
end $$;

reset role;
