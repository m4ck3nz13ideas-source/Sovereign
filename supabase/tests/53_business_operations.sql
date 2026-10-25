-- Business operations (0062, rule 55): a team, enquiries, orders and
-- bookings with the customer's approval as the last step, and reviews from
-- completed orders only. And the line from rule 37, extended: nothing that
-- approves, orders or places a business reads an order or a review.
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
  ('e5300001-0000-0000-0000-000000000000', 'ops-ann@example.com'),   -- owner
  ('e5300002-0000-0000-0000-000000000000', 'ops-ben@example.com'),   -- manager
  ('e5300003-0000-0000-0000-000000000000', 'ops-cat@example.com'),   -- staff
  ('e5300004-0000-0000-0000-000000000000', 'ops-dan@example.com'),   -- customer
  ('e5300005-0000-0000-0000-000000000000', 'ops-eve@example.com'),   -- reviewer
  ('e5300006-0000-0000-0000-000000000000', 'ops-fay@example.com');   -- another customer

update profiles set handle = 'opsben' where id = 'e5300002-0000-0000-0000-000000000000';
update profiles set handle = 'opscat' where id = 'e5300003-0000-0000-0000-000000000000';
update profiles set handle = 'opsfay' where id = 'e5300006-0000-0000-0000-000000000000';
insert into marketplace_reviewers (profile_id) values ('e5300005-0000-0000-0000-000000000000');

insert into vendors (id, owner_id, name, description, evidence, website)
values ('e5300010-0000-0000-0000-000000000000', 'e5300001-0000-0000-0000-000000000000',
        'Ops Joinery', 'Furniture made to order from reclaimed timber, and repairs to what you already own.',
        'Timber receipts from two reclamation yards, a living-wage employer accreditation, and three years of accounts.',
        'https://ops-joinery.example');

-- An unapproved business, for the doors that should stay shut.
insert into vendors (id, owner_id, name, description, evidence, website)
values ('e5300011-0000-0000-0000-000000000000', 'e5300006-0000-0000-0000-000000000000',
        'Fay Unvetted', 'Something that has not been read against the laws yet, so not in the market.',
        'Evidence that nobody has read yet, long enough to pass the length check on the evidence column.',
        'https://fay-unvetted.example');

set session_replication_role = replica;
insert into vendor_vettings (vendor_id, content_hash, readings, violations, tensions,
                             prompt_id, prompt_version, model, decision, signed_by, signed_at, sign_note)
select v.id, vendor_content_hash(v), (select jsonb_agg(jsonb_build_object('law_id', 'law_' || i, 'verdict', 'aligned', 'reasoning', 'ok')) from generate_series(1, 10) i), 0, 0, 'marketplace.vetting', '1.0.0', 'test', 'approved',
       'e5300005-0000-0000-0000-000000000000', now(), 'Fixture approval for the operations suite.'
  from vendors v where v.id = 'e5300010-0000-0000-0000-000000000000';
set session_replication_role = origin;

insert into offerings (id, vendor_id, kind, name, description, price, url) values
  ('e5300020-0000-0000-0000-000000000000', 'e5300010-0000-0000-0000-000000000000', 'product',
   'Oak stool', 'A three-legged stool in reclaimed oak, oiled, made to your height.', '£85', 'https://ops-joinery.example/stool'),
  ('e5300021-0000-0000-0000-000000000000', 'e5300010-0000-0000-0000-000000000000', 'service',
   'Chair repair', 'Loose joints re-glued and pinned, seats re-rushed, at your home or ours.', 'from £40', 'https://ops-joinery.example/repair'),
  ('e5300022-0000-0000-0000-000000000000', 'e5300011-0000-0000-0000-000000000000', 'product',
   'Unread thing', 'A product from a business that has not been approved by anybody.', '£1', 'https://fay-unvetted.example/x');

set role app;

do $$
declare
  ann uuid := 'e5300001-0000-0000-0000-000000000000';
  ben uuid := 'e5300002-0000-0000-0000-000000000000';
  cat uuid := 'e5300003-0000-0000-0000-000000000000';
  dan uuid := 'e5300004-0000-0000-0000-000000000000';
  eve uuid := 'e5300005-0000-0000-0000-000000000000';
  fay uuid := 'e5300006-0000-0000-0000-000000000000';
  biz uuid := 'e5300010-0000-0000-0000-000000000000';
  other uuid := 'e5300011-0000-0000-0000-000000000000';
  stool uuid := 'e5300020-0000-0000-0000-000000000000';
  repair uuid := 'e5300021-0000-0000-0000-000000000000';
  unread_thing uuid := 'e5300022-0000-0000-0000-000000000000';
  convo uuid; o1 uuid; o2 uuid; o3 uuid; o4 uuid; rv uuid; oid uuid;
  n int; t text; s order_status; passes int := 0; fails int := 0;
begin
  ------------------------------------------------------------------- team
  perform set_config('test.uid', ben::text, true);
  begin
    perform invite_vendor_member(biz, 'opscat', 'staff');
    fails := fails + 1; raise warning 'FAIL: somebody who is not the owner built the team';
  exception when others then passes := passes + 1; end;

  perform set_config('test.uid', ann::text, true);
  perform invite_vendor_member(biz, '@OpsBen', 'manager');
  perform invite_vendor_member(biz, 'opscat', 'staff');
  begin
    perform invite_vendor_member(biz, 'opsben', 'staff');
    fails := fails + 1; raise warning 'FAIL: the same person was invited twice';
  exception when others then passes := passes + 1; end;
  begin
    perform invite_vendor_member(biz, 'nobody-has-this', 'staff');
    fails := fails + 1; raise warning 'FAIL: an invitation went to a handle nobody holds';
  exception when others then passes := passes + 1; end;

  -- An invitation is not membership until it is accepted.
  perform set_config('test.uid', ben::text, true);
  if vendor_team_role(biz) is null then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: an unaccepted invitation already gave a role'; end if;
  select count(*)::int into n from my_vendor_invites() where vendor_id = biz;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the invitee could not see their invitation'; end if;
  perform accept_vendor_invite(biz);
  if vendor_team_role(biz) = 'manager' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: an accepted manager has role %', vendor_team_role(biz); end if;
  perform set_config('test.uid', cat::text, true);
  perform accept_vendor_invite(biz);

  -- The team sees itself; nobody else does.
  select count(*)::int into n from vendor_team(biz);
  if n = 3 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: staff saw % on the team, expected 3', n; end if;
  perform set_config('test.uid', dan::text, true);
  select count(*)::int into n from vendor_team(biz);
  select n + count(*)::int into n from vendor_members where vendor_id = biz;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a customer read the business''s team'; end if;

  -- Managers list; staff do not; claims stay with the owner.
  perform set_config('test.uid', ben::text, true);
  oid := add_offering(biz, 'product', 'Ash bowl', 'A turned bowl in ash from a felled street tree.', '£30', 'https://ops-joinery.example/bowl');
  perform withdraw_offering(oid);
  passes := passes + 1;
  update vendors set description = 'A manager rewriting what the AI read and a reviewer signed off.' where id = biz;
  get diagnostics n = row_count;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a manager changed the business''s claims'; end if;
  begin
    perform create_campaign(biz, null, 'Stools made to measure', 'Reclaimed oak, your height.', 20, 1000);
    fails := fails + 1; raise warning 'FAIL: a manager spent the business''s money on ads';
  exception when others then passes := passes + 1; end;

  perform set_config('test.uid', cat::text, true);
  begin
    perform add_offering(biz, 'product', 'Staff listing', 'Staff are not meant to change the listings.', '£1', 'https://ops-joinery.example/s');
    fails := fails + 1; raise warning 'FAIL: staff changed the listings';
  exception when others then passes := passes + 1; end;
  select count(*)::int into n from offerings where id = oid;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the team could not see a withdrawn listing of its own'; end if;

  -- A manager posts updates; staff do not.
  perform set_config('test.uid', ben::text, true);
  perform test_page_post(ben, 'Workshop open late on Thursdays.', null, biz);
  passes := passes + 1;
  perform set_config('test.uid', cat::text, true);
  begin
    perform test_page_post(cat, 'Staff speaking for the business.', null, biz);
    fails := fails + 1; raise warning 'FAIL: staff posted as the business';
  exception when others then passes := passes + 1; end;

  ----------------------------------------------------------------- enquiries
  perform set_config('test.uid', dan::text, true);
  convo := open_vendor_conversation(biz);
  if open_vendor_conversation(biz) = convo then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: opening twice made two conversations'; end if;
  perform send_vendor_message(convo, 'Can you make a stool 60cm high?');

  begin
    perform open_vendor_conversation(other);
    fails := fails + 1; raise warning 'FAIL: a customer messaged an unapproved business';
  exception when others then passes := passes + 1; end;

  perform set_config('test.uid', cat::text, true);
  begin
    perform open_vendor_conversation(biz);
    fails := fails + 1; raise warning 'FAIL: the team opened an enquiry with its own business';
  exception when others then passes := passes + 1; end;
  select unread into n from my_vendor_desks() where vendor_id = biz;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: staff saw % unread on the desk, expected 1', n; end if;
  perform send_vendor_message(convo, 'Yes. Order it and say the height in the note.');
  select from_business::text into t from vendor_messages where conversation_id = convo order by created_at desc limit 1;
  if t = 'true' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a staff reply did not speak for the business'; end if;

  -- Ben read nothing, so the customer's message is still new to him; Cat's
  -- reading is her own.
  perform set_config('test.uid', ben::text, true);
  if vendor_conversation_unread(convo) = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: one team member reading cleared it for another'; end if;

  perform set_config('test.uid', dan::text, true);
  select unread into n from my_vendor_chats() where conversation_id = convo;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the customer saw % unread, expected 1', n; end if;

  perform set_config('test.uid', fay::text, true);
  select count(*)::int into n from vendor_messages where conversation_id = convo;
  select n + count(*)::int into n from vendor_messages_page(convo, 50);
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: somebody outside the conversation read it'; end if;
  begin
    perform send_vendor_message(convo, 'Butting in.');
    fails := fails + 1; raise warning 'FAIL: somebody outside the conversation wrote in it';
  exception when others then passes := passes + 1; end;
  begin
    insert into vendor_messages (conversation_id, author_id, from_business, body) values (convo, fay, true, 'Forged.');
    fails := fails + 1; raise warning 'FAIL: a message was written without the function';
  exception when others then passes := passes + 1; end;

  -------------------------------------------------------------------- orders
  perform set_config('test.uid', dan::text, true);
  o1 := place_order(stool, 1, 'Sixty centimetres high, please.', null);
  select status into s from vendor_orders where id = o1;
  if s = 'requested' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a new order is %', s; end if;
  begin
    perform place_order(unread_thing, 1, null, null);
    fails := fails + 1; raise warning 'FAIL: an order went to an unapproved business';
  exception when others then passes := passes + 1; end;
  begin
    perform place_order(repair, 1, null, now() - interval '1 day');
    fails := fails + 1; raise warning 'FAIL: a booking was asked for in the past';
  exception when others then passes := passes + 1; end;

  -- The customer cannot move their own order along.
  begin
    perform accept_order(o1, '£85', null, null);
    fails := fails + 1; raise warning 'FAIL: a customer accepted their own order';
  exception when others then passes := passes + 1; end;
  begin
    update vendor_orders set status = 'completed' where id = o1;
    get diagnostics n = row_count;
    if n = 0 then passes := passes + 1; else fails := fails + 1;
      raise warning 'FAIL: an order was moved by writing to the table'; end if;
  exception when others then passes := passes + 1; end;

  perform set_config('test.uid', cat::text, true);
  begin
    perform place_order(stool, 1, null, null);
    fails := fails + 1; raise warning 'FAIL: the team ordered from its own business';
  exception when others then passes := passes + 1; end;
  begin
    perform accept_order(o1, '', null, null);
    fails := fails + 1; raise warning 'FAIL: an order was accepted without a price';
  exception when others then passes := passes + 1; end;
  perform accept_order(o1, '£90 (taller than standard)', null, 'Ready in two weeks.');
  begin
    perform confirm_order(o1);
    fails := fails + 1; raise warning 'FAIL: an order was confirmed before it was delivered';
  exception when others then passes := passes + 1; end;
  perform deliver_order(o1, 'Collected from the workshop.');

  perform set_config('test.uid', cat::text, true);
  begin
    perform confirm_order(o1);
    fails := fails + 1; raise warning 'FAIL: the business confirmed its own delivery';
  exception when others then passes := passes + 1; end;
  begin
    perform complete_unanswered_order(o1);
    fails := fails + 1; raise warning 'FAIL: the business closed an order before the customer had their 14 days';
  exception when others then passes := passes + 1; end;

  perform set_config('test.uid', dan::text, true);
  begin
    perform write_review(o1, 5, 'Not finished yet, so this should not be allowed in.');
    fails := fails + 1; raise warning 'FAIL: a review was written before completion';
  exception when others then passes := passes + 1; end;
  perform confirm_order(o1);
  select status into s from vendor_orders where id = o1;
  if s = 'completed' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: confirming left the order %', s; end if;

  select count(*)::int into n from vendor_order_events where order_id = o1;
  if n = 4 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the order''s record has % events, expected 4', n; end if;
  select count(*)::int into n from vendor_order_events where order_id = o1 and actor_id = cat;
  if n = 2 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the record does not name who moved the order'; end if;

  -- A booking needs a time; declining needs a reason.
  o2 := place_order(repair, 1, 'Two kitchen chairs, both wobble.', now() + interval '3 days');
  perform set_config('test.uid', ben::text, true);
  begin
    perform accept_order(o2, '£80', null, null);
    fails := fails + 1; raise warning 'FAIL: a booking was accepted without a time';
  exception when others then passes := passes + 1; end;
  begin
    perform decline_order(o2, 'No.');
    fails := fails + 1; raise warning 'FAIL: an order was declined without a reason';
  exception when others then passes := passes + 1; end;
  perform accept_order(o2, '£80', now() + interval '4 days', null);
  begin
    perform cancel_order(o2, null);
    fails := fails + 1; raise warning 'FAIL: an accepted order was cancelled without a reason';
  exception when others then passes := passes + 1; end;
  perform cancel_order(o2, 'Our van is off the road this week.');
  select status into s from vendor_orders where id = o2;
  if s = 'cancelled' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: cancelling left the booking %', s; end if;

  -- A problem goes to a reviewer, who is not on the team.
  perform set_config('test.uid', dan::text, true);
  o3 := place_order(stool, 2, null, null);
  perform set_config('test.uid', ben::text, true);
  perform accept_order(o3, '£170', null, null);
  perform deliver_order(o3, null);
  perform set_config('test.uid', dan::text, true);
  begin
    perform dispute_order(o3, 'Wobbly.');
    fails := fails + 1; raise warning 'FAIL: a problem was reported without saying what';
  exception when others then passes := passes + 1; end;
  perform dispute_order(o3, 'One of the two stools has a split leg.');

  perform set_config('test.uid', eve::text, true);
  select count(*)::int into n from vendor_orders where vendor_id = biz;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a reviewer saw % of the business''s orders, expected only the disputed one', n; end if;
  perform resolve_order_dispute(o3, 'cancelled', 'Agreed with both sides: refunded in full off the app.');
  select status into s from vendor_orders where id = o3;
  if s = 'cancelled' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: settling left the order %', s; end if;

  -- The customer reads who settled it by role, not by name.
  perform set_config('test.uid', dan::text, true);
  select count(*)::int into n from order_timeline(o3)
   where side = 'reviewer' and actor_name = 'A marketplace reviewer' and to_status = 'cancelled';
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the record did not show the settlement as a reviewer''s'; end if;

  perform set_config('test.uid', ann::text, true);
  begin
    perform resolve_order_dispute(o3, 'completed', 'The owner trying to settle their own dispute.');
    fails := fails + 1; raise warning 'FAIL: somebody who is not a reviewer settled a problem';
  exception when others then passes := passes + 1; end;

  -- Nobody outside sees an order.
  perform set_config('test.uid', fay::text, true);
  select count(*)::int into n from vendor_orders where vendor_id = biz;
  select n + count(*)::int into n from vendor_order_events where order_id in (o1, o2, o3);
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: another customer read somebody''s orders'; end if;

  -- The desk counts what needs doing.
  perform set_config('test.uid', dan::text, true);
  o4 := place_order(stool, 1, null, null);
  perform set_config('test.uid', ann::text, true);
  select to_answer into n from my_vendor_desks() where vendor_id = biz;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the desk showed % to answer, expected 1', n; end if;

  -- A customer can withdraw a request without a reason.
  perform set_config('test.uid', dan::text, true);
  perform cancel_order(o4, null);
  passes := passes + 1;

  ------------------------------------------------------------------- reviews
  rv := write_review(o1, 4, 'Exactly the height I asked for. Took a week longer than said.');
  begin
    perform write_review(o1, 5, 'A second review of the same order, which must not go in.');
    fails := fails + 1; raise warning 'FAIL: one order was reviewed twice';
  exception when others then passes := passes + 1; end;
  begin
    perform write_review(o3, 1, 'A review of an order that did not complete, refused.');
    fails := fails + 1; raise warning 'FAIL: a cancelled order was reviewed';
  exception when others then passes := passes + 1; end;
  update vendor_reviews set rating = 5 where id = rv;
  get diagnostics n = row_count;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a review was edited after it was written'; end if;

  perform set_config('test.uid', cat::text, true);
  begin
    perform reply_to_review(rv, 'Staff should not answer for the business here.');
    fails := fails + 1; raise warning 'FAIL: staff replied to a review';
  exception when others then passes := passes + 1; end;
  delete from vendor_reviews where id = rv;
  get diagnostics n = row_count;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the business deleted a review'; end if;

  perform set_config('test.uid', ben::text, true);
  perform reply_to_review(rv, 'Sorry for the wait: the oak needed longer to dry.');
  begin
    perform reply_to_review(rv, 'A second reply, which is refused.');
    fails := fails + 1; raise warning 'FAIL: a review was replied to twice';
  exception when others then passes := passes + 1; end;
  begin
    perform remove_review(rv, 'A manager removing a review of their own business.');
    fails := fails + 1; raise warning 'FAIL: the business removed a review';
  exception when others then passes := passes + 1; end;

  perform set_config('test.uid', fay::text, true);
  select count(*)::int into n from vendor_reviews_page(biz) where reply is not null;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: anyone signed in should read an approved business''s reviews and replies'; end if;
  select reviews + four into n from vendor_review_summary(biz);
  if n = 2 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the summary did not count one four-star review'; end if;

  perform set_config('test.uid', eve::text, true);
  perform remove_review(rv, 'Named a member of staff by their home address.');
  perform set_config('test.uid', fay::text, true);
  select count(*)::int into n from vendor_reviews_page(biz);
  select n + reviews into n from vendor_review_summary(biz);
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a removed review still showed'; end if;

  ----------------------------------------- nobody judges a business they work for
  reset role;
  insert into marketplace_reviewers (profile_id) values (ben);
  set role app;
  perform set_config('test.uid', ben::text, true);
  begin
    perform record_vendor_verification(biz, 'domain', 'ops-joinery.example', true, 'Token found.');
    fails := fails + 1; raise warning 'FAIL: a manager verified their own business';
  exception when others then passes := passes + 1; end;

  ------------------------------------------------------------ leaving the team
  perform set_config('test.uid', ann::text, true);
  perform remove_vendor_member(biz, cat);
  perform set_config('test.uid', cat::text, true);
  if vendor_team_role(biz) is null then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: removed staff kept a role'; end if;
  select count(*)::int into n from vendor_messages where conversation_id = convo;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: removed staff still read the business''s conversations'; end if;

  raise notice ' ';
  raise notice '  Business operations: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;

reset role;

---------------------------------------------------------------- absences
do $$
declare passes int := 0; fails int := 0; n int; f text;
begin
  -- Nothing that approves, orders or places a business reads an order, a
  -- review, an enquiry or the team.
  select count(*)::int into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public'
     and p.proname in ('vendor_status', 'vendor_approved', 'offering_listed', 'market_offerings',
                       'market_vendors', 'vendor_content_hash', 'ad_fit', 'vendor_law_fit',
                       'vendor_document', 'pick_ad', 'search_ad', 'campaign_live')
     and pg_get_functiondef(p.oid) ~* '(vendor_orders|vendor_reviews|vendor_messages|vendor_conversations|vendor_members|rating)';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % approval, ordering or ad functions read orders, reviews, enquiries or the team', n; end if;

  -- No average is stored anywhere.
  select count(*)::int into n from information_schema.columns
   where table_schema = 'public' and table_name in ('vendors', 'offerings', 'vendor_reviews')
     and column_name ~* '(average|avg|score|rank|stars)';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % stored scores on businesses or reviews', n; end if;

  -- No write policy on any of the new tables: the functions are the way in.
  select count(*)::int into n from pg_policies
   where tablename in ('vendor_members', 'vendor_conversations', 'vendor_messages',
                       'vendor_conversation_marks', 'vendor_orders', 'vendor_order_events', 'vendor_reviews')
     and cmd <> 'SELECT';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % write policies on business tables', n; end if;

  -- Internal helpers stay internal (rule 54); signed-out visitors reach none of it.
  foreach f in array array['move_order(uuid,order_status,text)', 'order_note_required(text,integer,text)'] loop
    if has_function_privilege('authenticated', f::regprocedure, 'execute') then
      fails := fails + 1; raise warning 'FAIL: % is callable through the API', f;
    else passes := passes + 1; end if;
  end loop;
  foreach f in array array['place_order(uuid,integer,text,timestamp with time zone)', 'vendor_reviews_page(uuid)',
                           'open_vendor_conversation(uuid)', 'vendor_team_role(uuid)'] loop
    if has_function_privilege('anon', f::regprocedure, 'execute') then
      fails := fails + 1; raise warning 'FAIL: signed-out visitors can call %', f;
    else passes := passes + 1; end if;
  end loop;

  -- Signed-in users write none of these tables directly.
  if not has_table_privilege('authenticated', 'vendor_orders', 'update')
     and not has_table_privilege('authenticated', 'vendor_reviews', 'delete')
     and not has_table_privilege('authenticated', 'vendor_messages', 'insert') then
    passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: signed-in users hold write grants on business tables'; end if;

  raise notice ' ';
  raise notice '  Business operations (absences): % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;
