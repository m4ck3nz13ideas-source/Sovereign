-- What matters to you: rating the Spheres, the tally, and Discover (0047, rule 43).
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

insert into auth.users (id, email)
select ('a2121212-1212-1212-1212-12121212120' || i)::uuid, 'priority-' || i || '@example.com'
  from generate_series(1, 7) i;

set role app;

do $$
declare
  u uuid[] := array(select ('a2121212-1212-1212-1212-12121212120' || i)::uuid from generate_series(1, 7) i);
  gid uuid; code text; n int; r record; x numeric;
  passes int := 0; fails int := 0;
begin
  -- A group of seven.
  perform set_config('test.uid', u[1]::text, true);
  gid := create_group('Priority Test', 'x', 'local');
  code := create_invite(gid, 10, 14);
  for i in 2..7 loop
    perform set_config('test.uid', u[i]::text, true); perform redeem_invite(code);
  end loop;

  ----------------------------------------------------------- yours alone
  perform set_config('test.uid', u[1]::text, true);
  insert into sphere_priorities (sphere_id, rating) values ('ecology', 5), ('health', 4), ('tech', 1);
  update sphere_priorities set rating = 3 where sphere_id = 'tech';
  select rating into n from sphere_priorities where sphere_id = 'tech';
  if n = 3 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: could not change your own rating'; end if;

  begin
    insert into sphere_priorities (sphere_id, rating) values ('justice', 6);
    fails := fails + 1; raise warning 'FAIL: a rating of 6 was accepted';
  exception when others then passes := passes + 1; end;
  begin
    insert into sphere_priorities (sphere_id, rating) values ('defence', 3);
    fails := fails + 1; raise warning 'FAIL: a Sphere that does not exist was rated';
  exception when others then passes := passes + 1; end;

  perform set_config('test.uid', u[2]::text, true);
  select count(*)::int into n from sphere_priorities where profile_id = u[1];
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: somebody else can read your ratings'; end if;
  begin
    insert into sphere_priorities (profile_id, sphere_id, rating) values (u[1], 'justice', 1);
    fails := fails + 1; raise warning 'FAIL: rated in somebody else''s name';
  exception when others then passes := passes + 1; end;
  update sphere_priorities set rating = 1 where profile_id = u[1];
  delete from sphere_priorities where profile_id = u[1];
  perform set_config('test.uid', u[1]::text, true);
  select count(*)::int into n from sphere_priorities;
  if n = 3 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: somebody else changed or removed your ratings'; end if;

  ----------------------------------------------------------- the floor
  -- Four have rated: below the floor, so a count and no averages.
  for i in 2..4 loop
    perform set_config('test.uid', u[i]::text, true);
    insert into sphere_priorities (sphere_id, rating) values ('ecology', 4), ('health', 2);
  end loop;
  perform set_config('test.uid', u[1]::text, true);
  select count(*)::int into n from sphere_priority_tally(gid, null) where average is not null;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: averages shown with only four raters'; end if;
  select max(people) into n from sphere_priority_tally(gid, null);
  if n = 4 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: expected people = 4 below the floor, got %', n; end if;

  -- The fifth crosses it.
  perform set_config('test.uid', u[5]::text, true);
  insert into sphere_priorities (sphere_id, rating) values ('ecology', 5);
  perform set_config('test.uid', u[1]::text, true);
  select average into x from sphere_priority_tally(gid, null) where sphere_id = 'ecology';
  if x = 4.40 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: ecology average was %, expected 4.40', x; end if;
  select sphere_id into r from sphere_priority_tally(gid, null) limit 1;
  if r.sphere_id = 'ecology' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the tally was not ordered by average'; end if;
  select count(*)::int into n from sphere_priority_tally(gid, null);
  if n = 8 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the tally should list all eight Spheres, got %', n; end if;

  -- Not a member: refused.
  perform set_config('test.uid', 'f2121212-1212-1212-1212-12121212120f', true);
  begin
    perform * from sphere_priority_tally(gid, null);
    fails := fails + 1; raise warning 'FAIL: an outsider read a group''s tally';
  exception when others then passes := passes + 1; end;

  ----------------------------------------------------------- discover
  perform set_config('test.uid', u[4]::text, true);
  perform test_propose(u[4], gid, 'local', null, 'Paint the noticeboard', 'x',
                       'The noticeboard is peeling and nobody reads it any more.');
  perform set_config('test.uid', u[2]::text, true);
  select count(*)::int into n from discover_feed(gid, null, 40)
   where actor_id = u[4] and kind = 'proposal.submitted';
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: Discover did not show a proposal submitted here by somebody you do not follow'; end if;
  perform set_config('test.uid', u[2]::text, true);
  insert into follows (follower_id, followed_id) values (u[2], u[3]);
  select count(*)::int into n from discover_feed(gid, null, 40) where actor_id in (u[2], u[3]);
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: Discover showed you, or somebody you already follow'; end if;

  raise notice ' ';
  raise notice '  Sphere priorities: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;

reset role;

-- THE ABSENCES. Nothing that decides, reaches, orders a feed, picks an ad
-- or mints reads a rating. Only the tally does, and it returns no person.
do $$
declare n int; names text; cols text;
begin
  select count(*)::int, string_agg(p.proname, ', ') into n, names
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.prosrc ~* 'sphere_priorities'
     and p.proname <> 'sphere_priority_tally';
  if n <> 0 then raise exception 'FAIL: % function(s) read ratings: %', n, names; end if;

  select string_agg(a, ',') into cols
    from (select unnest(p.proargnames) a, unnest(p.proargmodes) m
            from pg_proc p where p.proname = 'sphere_priority_tally') x
   where m = 't' and a ~* '(profile|who|author|_by$)';
  if cols is not null then raise exception 'FAIL: the tally returns a person: %', cols; end if;

  if not exists (select 1 from private.data_map where table_name = 'sphere_priorities') then
    raise exception 'FAIL: ratings are not in the data map';
  end if;

  raise notice '  Sphere priorities (absences): 3 passed, 0 failed';
end $$;
