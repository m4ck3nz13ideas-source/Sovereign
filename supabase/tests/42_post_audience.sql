-- Who a post is for: the author's choice of audience (0048, rule 44).
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
  ('a4242424-4242-4242-4242-42424242424a', 'aud-author@example.com'),
  ('b4242424-4242-4242-4242-42424242424b', 'aud-neighbour@example.com'),
  ('c4242424-4242-4242-4242-42424242424c', 'aud-region@example.com'),
  ('d4242424-4242-4242-4242-42424242424d', 'aud-nation@example.com'),
  ('e4242424-4242-4242-4242-42424242424e', 'aud-abroad@example.com');

create or replace function test_aud_post(p_author uuid, p_words text, p_audience text, p_group uuid default null)
returns uuid language plpgsql as $$
declare v uuid;
begin
  perform set_config('test.uid', p_author::text, true);
  insert into post_witness (author_id, body_sha256, first_hand, verdict, prompt_id, prompt_version, model)
  values (p_author, post_body_hash(p_words), 0.9, 'First-hand.', 'post.witness', '1.1.0', 'test');
  insert into posts (author_id, body, kind, audience, group_id)
  values (p_author, p_words, 'saw', p_audience, p_group) returning id into v;
  return v;
end $$;

set role app;

do $$
declare
  au uuid := 'a4242424-4242-4242-4242-42424242424a';
  nb uuid := 'b4242424-4242-4242-4242-42424242424b';
  rg uuid := 'c4242424-4242-4242-4242-42424242424c';
  na uuid := 'd4242424-4242-4242-4242-42424242424d';
  ab uuid := 'e4242424-4242-4242-4242-42424242424e';
  p_people uuid; p_region uuid; p_nation uuid; p_world uuid; gid uuid; n int;
  passes int := 0; fails int := 0;
  sees boolean;
begin
  -- The author and a neighbour on one street; one more in the same region;
  -- one more in the same nation only; one somewhere else entirely.
  perform set_config('test.uid', au::text, true);
  update profiles set place_local = 'Audience Street', place_regional = 'Wessex', place_national = 'United Kingdom', place_continental = 'Europe' where id = au;
  perform set_config('test.uid', nb::text, true);
  update profiles set place_local = 'Audience Street', place_regional = 'Wessex', place_national = 'United Kingdom', place_continental = 'Europe' where id = nb;
  perform set_config('test.uid', rg::text, true);
  update profiles set place_local = 'Other Road', place_regional = 'Wessex', place_national = 'United Kingdom', place_continental = 'Europe' where id = rg;
  perform set_config('test.uid', na::text, true);
  update profiles set place_local = 'Far Lane', place_regional = 'Mercia', place_national = 'United Kingdom', place_continental = 'Europe' where id = na;
  perform set_config('test.uid', ab::text, true);
  update profiles set place_local = 'Rue Loin', place_regional = 'Bretagne', place_national = 'France', place_continental = 'Europe' where id = ab;

  p_people := test_aud_post(au, 'Fixed the bench by the pond this morning.', 'people');
  p_region := test_aud_post(au, 'The Wessex river clean-up starts on Saturday.', 'regional');
  p_nation := test_aud_post(au, 'Wrote to my MP about the bus cuts today.', 'national');
  p_world  := test_aud_post(au, 'Learned to graft apple trees. Thread below.', 'global');

  -- Default: the street, not the region.
  perform set_config('test.uid', nb::text, true);
  select count(*)::int into n from posts where id = p_people;
  if n = 1 then passes := passes + 1; else fails := fails + 1; raise warning 'FAIL: a neighbour cannot see the default post'; end if;
  perform set_config('test.uid', rg::text, true);
  select count(*)::int into n from posts where id = p_people;
  if n = 0 then passes := passes + 1; else fails := fails + 1; raise warning 'FAIL: the default post reached beyond the street'; end if;

  -- Regional: the region, not the nation.
  select count(*)::int into n from posts where id = p_region;
  if n = 1 then passes := passes + 1; else fails := fails + 1; raise warning 'FAIL: a regional post missed the region'; end if;
  perform set_config('test.uid', na::text, true);
  select count(*)::int into n from posts where id = p_region;
  if n = 0 then passes := passes + 1; else fails := fails + 1; raise warning 'FAIL: a regional post reached another region'; end if;

  -- National: the nation, not abroad.
  select count(*)::int into n from posts where id = p_nation;
  if n = 1 then passes := passes + 1; else fails := fails + 1; raise warning 'FAIL: a national post missed the nation'; end if;
  perform set_config('test.uid', ab::text, true);
  select count(*)::int into n from posts where id = p_nation;
  if n = 0 then passes := passes + 1; else fails := fails + 1; raise warning 'FAIL: a national post reached another nation'; end if;

  -- Global: everyone signed in. And can_see_post agrees with the policy.
  select count(*)::int into n from posts where id = p_world;
  select can_see_post(p_world) into sees;
  if n = 1 and sees then passes := passes + 1; else fails := fails + 1; raise warning 'FAIL: a global post missed someone abroad'; end if;
  select can_see_post(p_nation) into sees;
  if not sees then passes := passes + 1; else fails := fails + 1; raise warning 'FAIL: can_see_post disagrees with the policy'; end if;

  -- Nobody signed in sees nothing.
  perform set_config('test.uid', '', true);
  select count(*)::int into n from posts where id = p_world;
  if n = 0 then passes := passes + 1; else fails := fails + 1; raise warning 'FAIL: a global post was readable signed out'; end if;

  -- Fixed once published.
  perform set_config('test.uid', au::text, true);
  begin
    update posts set audience = 'global' where id = p_people;
  exception when others then null; end;
  if (select audience from posts where id = p_people) = 'people' then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: a post was widened after publishing'; end if;

  -- A group post is for its group only.
  gid := create_group('Audience Test', 'x', 'local');
  begin
    perform test_aud_post(au, 'Meeting moved to Thursday.', 'global', gid);
    fails := fails + 1; raise warning 'FAIL: a group post was given a wider audience';
  exception when others then passes := passes + 1; end;
  begin
    perform test_aud_post(au, 'Something to everyone.', 'galaxy');
    fails := fails + 1; raise warning 'FAIL: an unknown audience was accepted';
  exception when others then passes := passes + 1; end;

  -- Discover at national scale now carries the national post for somebody
  -- who does not follow the author.
  perform set_config('test.uid', na::text, true);
  select count(*)::int into n from discover_feed(null, 'national', 40) where item_id = p_nation;
  if n = 1 then passes := passes + 1; else fails := fails + 1; raise warning 'FAIL: Discover (national) did not carry a national post'; end if;

  raise notice ' ';
  raise notice '  Post audience: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;

reset role;

-- The audience reaches; it never ranks. No feed function orders by it.
do $$
declare n int;
begin
  select count(*)::int into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname in ('witness_feed', 'discover_feed')
     and p.prosrc ~* 'order by[^;]*audience';
  if n <> 0 then raise exception 'FAIL: a feed orders by audience'; end if;
  raise notice '  Post audience (absences): 1 passed, 0 failed';
end $$;

drop function test_aud_post(uuid, text, text, uuid);

-- Even the database owner cannot widen a published post: the freeze is a
-- trigger, not just a missing policy.
do $$
begin
  begin
    update posts set audience = 'global'
     where author_id = 'a4242424-4242-4242-4242-42424242424a' and audience = 'people';
    raise exception 'FAIL: freeze_post let the audience change';
  exception when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  raise notice '  Post audience (freeze): 1 passed, 0 failed';
end $$;
