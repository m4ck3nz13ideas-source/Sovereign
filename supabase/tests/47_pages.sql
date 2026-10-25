-- Pages (0053): a group's rundown and shared values; a business's mission,
-- values and updates.
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
  ('e4700001-0000-0000-0000-000000000000', 'page1@example.com'),
  ('e4700002-0000-0000-0000-000000000000', 'page2@example.com'),
  ('e4700003-0000-0000-0000-000000000000', 'page3@example.com'),
  ('e4700004-0000-0000-0000-000000000000', 'page4@example.com');

-- A business, approved, owned by Ann.
insert into vendors (id, owner_id, name, description, evidence, website)
values ('e4700010-0000-0000-0000-000000000000', 'e4700001-0000-0000-0000-000000000000',
        'Pages Bakery', 'Sourdough from local flour, baked overnight, sold in the morning from the shop.',
        'Flour invoices from a mill twelve miles away, a food hygiene rating of five, and two years of trading accounts.',
        'https://pages-bakery.example');

set session_replication_role = replica;
insert into vendor_vettings (vendor_id, content_hash, readings, violations, tensions,
                             prompt_id, prompt_version, model, decision, signed_by, signed_at, sign_note)
select v.id, vendor_content_hash(v), (select jsonb_agg(jsonb_build_object('law_id', 'law_' || i, 'verdict', 'aligned', 'reasoning', 'ok')) from generate_series(1, 10) i), 0, 0, 'marketplace.vetting', '1.0.0', 'test', 'approved',
       'e4700004-0000-0000-0000-000000000000', now(), 'Fixture approval for the pages suite.'
  from vendors v where v.id = 'e4700010-0000-0000-0000-000000000000';
set session_replication_role = origin;

create or replace function test_page_post(p_author uuid, p_words text, p_group uuid, p_vendor uuid)
returns uuid language plpgsql as $$
declare v uuid;
begin
  insert into post_witness (author_id, body_sha256, first_hand, verdict, prompt_id, prompt_version, model)
  values (p_author, post_body_hash(p_words), 0.9, 'First-hand.', 'post.witness', '1.1.0', 'test');
  insert into posts (author_id, body, kind, group_id, vendor_id)
  values (p_author, p_words, 'saw', p_group, p_vendor) returning id into v;
  return v;
end $$;

set role app;

do $$
declare
  ann uuid := 'e4700001-0000-0000-0000-000000000000';
  ben uuid := 'e4700002-0000-0000-0000-000000000000';
  cat uuid := 'e4700003-0000-0000-0000-000000000000';
  eve uuid := 'e4700004-0000-0000-0000-000000000000';
  biz uuid := 'e4700010-0000-0000-0000-000000000000';
  gid uuid; pid uuid; n int; t text; msg text; old_hash text;
  passes int := 0; fails int := 0;
begin
  perform set_config('test.uid', ann::text, true);
  gid := create_group('Pages Street', 'Keep the street tidy and the bins out on time.');

  -- Ben joins (as an invitation would). Cat joins after the rundown is set:
  -- from three members the charter changes only by proposal (0057).
  reset role;
  insert into group_members (group_id, profile_id) values (gid, ben);
  set role app;

  ----------------------------------------------- stewards set the rundown
  perform set_config('test.uid', ann::text, true);
  update groups set goal = 'Every bin in by noon on collection day.', group_values = array['Care', 'Honesty']
   where id = gid;
  select goal into t from groups where id = gid;
  if t like 'Every bin%' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a steward could not set the goal'; end if;

  perform set_config('test.uid', ben::text, true);
  update groups set goal = 'Ben decides.' where id = gid;
  select goal into t from groups where id = gid;
  if t like 'Every bin%' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a member who is not a steward rewrote the goal'; end if;

  reset role;
  insert into group_members (group_id, profile_id) values (gid, cat);
  set role app;

  ----------------------------------- shared values: opted-in, two or more
  perform set_config('test.uid', ann::text, true);
  update profiles set share_values = true where id = ann;
  insert into profile_values (profile_id, name) values (ann, 'Honesty'), (ann, 'Thrift');
  perform set_config('test.uid', ben::text, true);
  update profiles set share_values = true where id = ben;
  insert into profile_values (profile_id, name) values (ben, 'honesty '), (ben, 'Courage');
  perform set_config('test.uid', cat::text, true);
  insert into profile_values (profile_id, name) values (cat, 'Honesty'), (cat, 'Thrift');

  perform set_config('test.uid', ben::text, true);
  select holders into n from group_shared_values(gid) where lower(value) = 'honesty';
  if n = 2 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: honesty counted % holders, expected 2 (Cat has not opted in)', n; end if;

  select count(*)::int into n from group_shared_values(gid) where lower(value) in ('thrift', 'courage');
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a value held by one sharer (or by somebody not sharing) was shown'; end if;

  perform set_config('test.uid', eve::text, true);
  select count(*)::int into n from group_shared_values(gid);
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a non-member read a group''s shared values'; end if;

  ------------------------------------------- the group's feed is the group's
  perform set_config('test.uid', ben::text, true);
  pid := test_page_post(ben, 'New bins arrive Tuesday.', gid, null);
  perform set_config('test.uid', cat::text, true);
  select count(*)::int into n from posts where group_id = gid;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a member could not read the group feed'; end if;
  perform set_config('test.uid', eve::text, true);
  select count(*)::int into n from posts where group_id = gid;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: an outsider read the group feed'; end if;

  --------------------------------------------------------------- businesses
  perform set_config('test.uid', eve::text, true);
  if vendor_status(biz) = 'approved' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the fixture business is %, not approved: the new hash moved an existing one', vendor_status(biz); end if;

  perform set_config('test.uid', ben::text, true);
  begin
    perform test_page_post(ben, 'Half price today!', null, biz);
    fails := fails + 1; raise warning 'FAIL: somebody who does not own a business posted as it';
  exception when others then passes := passes + 1;
  end;

  perform set_config('test.uid', ann::text, true);
  pid := test_page_post(ann, 'Rye is back on Thursdays.', null, biz);

  perform set_config('test.uid', eve::text, true);
  select count(*)::int into n from posts where vendor_id = biz;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: anyone signed in should read an approved business''s updates'; end if;

  select count(*)::int into n from witness_feed(80) where item_id = pid;
  select n + count(*)::int into n from discover_feed(null, 'global', 80) where item_id = pid;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a business post reached somebody''s feed'; end if;

  -- Saying what it stands for is a claim, and a claim is read again.
  perform set_config('test.uid', ann::text, true);
  update vendors set mission = 'Bread that feeds the street, not the shareholders.',
                     vendor_values = array['Local', 'Fair pay'] where id = biz;
  if vendor_status(biz) = 'changed' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a new mission did not need reading again (status %)', vendor_status(biz); end if;

  perform set_config('test.uid', eve::text, true);
  select count(*)::int into n from posts where vendor_id = biz;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: an unapproved business''s updates were readable'; end if;

  perform set_config('test.uid', ann::text, true);
  select count(*)::int into n from posts where vendor_id = biz;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the owner lost sight of their own update'; end if;

  begin
    perform test_page_post(ann, 'Both at once.', gid, biz);
    fails := fails + 1; raise warning 'FAIL: a post was both a group''s and a business''s';
  exception when others then passes := passes + 1;
  end;

  if not has_function_privilege('anon', 'group_shared_values(uuid)', 'execute') then
    passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: signed-out visitors can read shared values'; end if;

  raise notice ' ';
  raise notice '  Pages: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then
    raise exception '% checks failed', fails;
  end if;
end $$;

reset role;
