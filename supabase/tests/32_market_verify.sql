-- A business proves it is real before it is approved (0038, rule 37).
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
  ('a1212121-2121-2121-2121-21212121212a', 'ver-owner@example.com'),
  ('c1212121-2121-2121-2121-21212121212c', 'ver-reviewer@example.com');
insert into marketplace_reviewers (profile_id) values ('c1212121-2121-2121-2121-21212121212c');

set role app;

do $$
declare
  own uuid := 'a1212121-2121-2121-2121-21212121212a';
  rev uuid := 'c1212121-2121-2121-2121-21212121212c';
  v uuid; vet uuid; readings jsonb; ok boolean; r record;
  passes int := 0; fails int := 0;
begin
  select jsonb_agg(jsonb_build_object('law_id', 'law_' || i, 'verdict', 'aligned', 'reasoning', 'ok'))
    into readings from generate_series(1, 10) i;

  perform set_config('test.uid', own::text, true);
  v := register_vendor('Hedge & Hive', 'Native hedging plants and local honey from a family farm.',
    'Two people, both paid the living wage. No pesticides, hives inspected by the county '
    || 'bee inspector, plants grown from local seed.', 'https://www.hedgeandhive.example/shop');
  vet := record_vendor_vetting(v, readings, 'marketplace.vetting', '1.0.0', 'test');

  -- The business cannot vouch for itself.
  begin
    perform record_vendor_verification(v, 'domain', 'hedgeandhive.example', true, 'trust me');
    fails := fails + 1; raise warning 'FAIL: a business verified its own website';
  exception when others then passes := passes + 1; end;

  -- No approval before the website is checked.
  perform set_config('test.uid', rev::text, true);
  begin
    perform sign_off_vetting(vet, 'approved', 'Evidence looks right.');
    fails := fails + 1; raise warning 'FAIL: approved without a website check';
  exception when others then passes := passes + 1; end;

  -- A check of some other domain does not count.
  begin
    perform record_vendor_verification(v, 'domain', 'someone-else.example', true, 'found');
    fails := fails + 1; raise warning 'FAIL: a check of another domain was recorded';
  exception when others then passes := passes + 1; end;

  -- A failed check is recorded, and still blocks.
  perform record_vendor_verification(v, 'domain', 'hedgeandhive.example', false, 'No TXT record found.');
  begin
    perform sign_off_vetting(vet, 'approved', 'Evidence looks right.');
    fails := fails + 1; raise warning 'FAIL: approved after a failed website check';
  exception when others then passes := passes + 1; end;

  -- www. and paths are ignored: the domain is what is checked.
  perform record_vendor_verification(v, 'domain', 'hedgeandhive.example', true, 'TXT record found.');
  select vendor_domain_verified(v) into ok;
  if ok then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a passed website check did not count'; end if;

  perform sign_off_vetting(vet, 'approved', 'Website and evidence checked.');
  if vendor_status(v) = 'approved' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: not approved after a website check'; end if;

  -- Companies House: the business sets the number, a reviewer checks it.
  perform set_config('test.uid', own::text, true);
  perform set_company_number(v, 'ab123456');
  perform set_config('test.uid', rev::text, true);
  perform record_vendor_verification(v, 'companies_house', 'AB123456', true, 'HEDGE & HIVE LTD — active');
  select * into r from vendor_company(v);
  if r.verified and r.detail like 'HEDGE%' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the company check did not read back'; end if;

  -- Change the number and the old check no longer applies.
  perform set_config('test.uid', own::text, true);
  perform set_company_number(v, 'ZZ999999');
  perform set_config('test.uid', rev::text, true);
  if not exists (select 1 from vendor_company(v)) then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a check of an old company number still counts'; end if;

  raise notice ' ';
  raise notice '  Market verification: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;

reset role;
