-- To-dos are yours alone; a search shows an ad only when one is relevant (0035).
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
  ('aaaa0000-0000-0000-0000-00000000000a', 'todo-a@example.com'),
  ('bbbb0000-0000-0000-0000-00000000000b', 'todo-b@example.com'),
  ('cccc0000-0000-0000-0000-00000000000c', 'todo-rev@example.com');
insert into marketplace_reviewers (profile_id) values ('cccc0000-0000-0000-0000-00000000000c');

set role app;

do $$
declare
  a uuid := 'aaaa0000-0000-0000-0000-00000000000a';
  b uuid := 'bbbb0000-0000-0000-0000-00000000000b';
  r uuid := 'cccc0000-0000-0000-0000-00000000000c';
  t uuid; v uuid; vet uuid; c uuid; n int; picked uuid;
  readings jsonb;
  passes int := 0; fails int := 0;
begin
  ------------------------------------------------------------------ to-dos
  perform set_config('test.uid', a::text, true);
  insert into todos (body) values ('Ring the council about the bins') returning id into t;
  select count(*)::int into n from todos where id = t;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the owner cannot see their own to-do'; end if;

  perform set_config('test.uid', b::text, true);
  select count(*)::int into n from todos where id = t;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: somebody else can read a to-do'; end if;
  update todos set done_at = now() where id = t;
  begin
    insert into todos (profile_id, body) values (a, 'Planted in somebody else''s list');
    fails := fails + 1; raise warning 'FAIL: a to-do was written into somebody else''s list';
  exception when others then passes := passes + 1; end;

  perform set_config('test.uid', a::text, true);
  select count(*)::int into n from todos where id = t and done_at is null;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: somebody else ticked off a to-do'; end if;

  --------------------------------------------------------------- search ads
  select jsonb_agg(jsonb_build_object('law_id', 'law_' || i, 'verdict', 'aligned', 'reasoning', 'ok'))
    into readings from generate_series(1, 10) i;
  perform set_config('test.uid', a::text, true);
  v := register_vendor('Refill Station', 'Plastic-free refills of soap, oats and rice in your own jars.',
    'Bulk suppliers within the county, staff on the living wage, deliveries by cargo bike, '
    || 'and a published list of every supplier with their audit dates.', 'https://refill.example');
  vet := record_vendor_vetting(v, readings, 'marketplace.vetting', '1.0.0', 'test');
  perform set_config('test.uid', r::text, true);
  perform sign_off_vetting(vet, 'approved', 'Supplier list checked.');
  perform set_config('test.uid', a::text, true);
  c := create_campaign(v, null, 'Refill, not rebuy', 'Bring your jars.', 20, 2000);

  perform set_config('test.uid', b::text, true);
  select campaign_id into picked from search_ad('plastic free soap');
  if picked = c then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a relevant search did not show the relevant ad'; end if;

  select count(*)::int into n from search_ad('zebra crossing');
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: an unrelated search showed an ad anyway'; end if;

  perform set_config('test.uid', a::text, true);
  select count(*)::int into n from search_ad('plastic free soap');
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: an advertiser was shown their own ad'; end if;

  raise notice ' ';
  raise notice '  To-dos and search ads: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;

reset role;
