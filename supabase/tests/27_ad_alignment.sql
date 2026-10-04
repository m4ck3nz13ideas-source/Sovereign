-- The sponsored slot goes to the best fit for the viewer, not the highest
-- bid (0033, rule 37).
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
  ('a8888888-8888-8888-8888-88888888888a', 'fit-ocean@example.com'),
  ('b8888888-8888-8888-8888-88888888888b', 'fit-bank@example.com'),
  ('c8888888-8888-8888-8888-88888888888c', 'fit-reviewer@example.com'),
  ('d8888888-8888-8888-8888-88888888888d', 'fit-viewer@example.com'),
  ('e8888888-8888-8888-8888-88888888888e', 'fit-blank@example.com');

insert into marketplace_reviewers (profile_id) values ('c8888888-8888-8888-8888-88888888888c');

set role app;

do $$
declare
  ocean  uuid := 'a8888888-8888-8888-8888-88888888888a';
  bank   uuid := 'b8888888-8888-8888-8888-88888888888b';
  rev    uuid := 'c8888888-8888-8888-8888-88888888888c';
  viewer uuid := 'd8888888-8888-8888-8888-88888888888d';
  blank  uuid := 'e8888888-8888-8888-8888-88888888888e';
  v_ocean uuid; v_bank uuid; vet uuid; c_ocean uuid; c_bank uuid;
  picked uuid; why text[]; f numeric;
  readings jsonb;
  passes int := 0; fails int := 0;
begin
  select jsonb_agg(jsonb_build_object('law_id', 'law_' || i, 'verdict', 'aligned', 'reasoning', 'ok'))
    into readings from generate_series(1, 10) i;

  -- A small business that cleans plastic out of the sea, bidding little.
  perform set_config('test.uid', ocean::text, true);
  v_ocean := register_vendor('Tideline Recovery',
    'We pull plastic out of coastal water and turn it into benches for schools.',
    'Crews are paid the living wage, boats run on biodiesel, every kilo recovered is '
    || 'weighed and published monthly on our site with photos of the haul.',
    'https://tideline.example');
  vet := record_vendor_vetting(v_ocean, readings, 'marketplace.vetting', '1.0.0', 'test');
  perform set_config('test.uid', rev::text, true);
  perform sign_off_vetting(vet, 'approved', 'Monthly haul reports checked.');
  perform set_config('test.uid', ocean::text, true);
  c_ocean := create_campaign(v_ocean, null, 'Clean seas, school benches', 'Every bench was once ocean plastic.', 10, 5000);

  -- A bank with an ethical current account, bidding a lot.
  perform set_config('test.uid', bank::text, true);
  v_bank := register_vendor('Fairway Bank',
    'A current account that never lends to arms or fossil fuel companies.',
    'Lending book published quarterly, independent audit each year, staff on the '
    || 'living wage and a cap on executive pay of eight times the lowest salary.',
    'https://fairway.example');
  vet := record_vendor_vetting(v_bank, readings, 'marketplace.vetting', '1.0.0', 'test');
  perform set_config('test.uid', rev::text, true);
  perform sign_off_vetting(vet, 'approved', 'Lending book and audit checked.');
  perform set_config('test.uid', bank::text, true);
  c_bank := create_campaign(v_bank, null, 'Banking that funds no weapons', 'Switch in ten minutes.', 500, 50000);

  -------------------------------- a viewer who cares about the sea gets the sea
  perform set_config('test.uid', viewer::text, true);
  insert into profile_values (profile_id, name, definition, position)
  values (viewer, 'Ocean health', 'Keeping plastic out of the sea and coastal water clean.', 1),
         (viewer, 'Craft', 'Things made well by people who are paid properly.', 2);

  select campaign_id, matched, fit into picked, why, f from pick_ad();
  if picked = c_ocean then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the highest bid beat the best fit for a viewer who values the ocean'; end if;
  if 'Ocean health' = any(why) then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the slot did not say which value it matched (%)', why; end if;
  if f between 0 and 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: fit out of range: %', f; end if;

  ---------------------------------- a viewer with no values: fit ties, bid breaks it
  perform set_config('test.uid', blank::text, true);
  select campaign_id into picked from pick_ad();
  if picked = c_bank then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: with equal fit the bid should break the tie'; end if;

  ---------------------------------- values are private: the fit is per viewer only
  -- The ocean business cannot read the viewer's values.
  perform set_config('test.uid', ocean::text, true);
  if not exists (select 1 from profile_values where profile_id = viewer) then passes := passes + 1;
  else fails := fails + 1; raise warning 'FAIL: an advertiser can read a viewer''s values'; end if;

  raise notice ' ';
  raise notice '  Ad alignment: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;

reset role;

do $$
declare n int; passes int := 0; fails int := 0;
begin
  -- Fit is decided without money.
  select count(*)::int into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public'
     and p.proname in ('ad_fit', 'vendor_document', 'my_values_query', 'vendor_law_fit')
     and pg_get_functiondef(p.oid) ~* '(bid|budget|spent|pence|ad_click|campaign)';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % fit function(s) read the money side', n; end if;

  -- And fit leaves no trace an advertiser could read.
  select count(*)::int into n from information_schema.columns
   where table_schema = 'public' and table_name in ('ad_campaigns', 'ad_clicks')
     and column_name ~* '(fit|match|value)';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: fit is stored where an advertiser can see it'; end if;

  raise notice ' ';
  raise notice '  Ad alignment (absences): % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;
