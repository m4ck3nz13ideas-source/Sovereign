-- The marketplace as trade (rule 37): approval is the AI's reading of the
-- Universal Laws plus a reviewer's sign-off, for the words the business stands
-- on now; advertising is pay per click; and paying never buys approval.
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
  ('a6666666-6666-6666-6666-66666666666a', 'trade-owner@example.com'),
  ('b6666666-6666-6666-6666-66666666666b', 'trade-buyer@example.com'),
  ('c6666666-6666-6666-6666-66666666666c', 'trade-reviewer@example.com'),
  ('d6666666-6666-6666-6666-66666666666d', 'trade-rival@example.com');

-- Only the owner of the project can make somebody a reviewer.
insert into marketplace_reviewers (profile_id) values ('c6666666-6666-6666-6666-66666666666c');

create or replace function test_readings(p_violations int, p_tensions int default 0)
returns jsonb language sql immutable as $$
  select jsonb_agg(jsonb_build_object(
           'law_id', 'law_' || i,
           'verdict', case when i <= p_violations then 'violation'
                           when i <= p_violations + p_tensions then 'tension'
                           else 'aligned' end,
           'reasoning', 'A reading.') order by i)
  from generate_series(1, 10) i;
$$;

set role app;

do $$
declare
  owner_  uuid := 'a6666666-6666-6666-6666-66666666666a';
  buyer   uuid := 'b6666666-6666-6666-6666-66666666666b';
  rev     uuid := 'c6666666-6666-6666-6666-66666666666c';
  rival   uuid := 'd6666666-6666-6666-6666-66666666666d';
  v uuid; v2 uuid; vet uuid; o uuid; o2 uuid; camp uuid; camp2 uuid; camp3 uuid; conc uuid;
  st text; n int; url text; spent int;
  passes int := 0; fails int := 0;
  evidence text := 'All clay is dug within forty miles, glazes are lead-free and tested yearly, '
                || 'and the two potters are paid above the living wage.';
begin
  ------------------------------------------------------------ a business
  perform set_config('test.uid', owner_::text, true);
  v := register_vendor('Corner Pottery', 'Hand-thrown mugs and bowls from a two-person studio.',
                       evidence, 'https://corner-pottery.example');
  st := vendor_status(v);
  if st = 'unvetted' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: new business should be unvetted, got %', st; end if;

  o := add_offering(v, 'product', 'Breakfast mug', 'A 300ml stoneware mug, dishwasher safe.',
                    '£18', 'https://corner-pottery.example/mug');

  -- Not visible to anyone else until approved.
  perform set_config('test.uid', buyer::text, true);
  select count(*)::int into n from vendors where id = v;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: an unapproved business is visible to a buyer'; end if;
  select count(*)::int into n from market_offerings() where id = o;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: an unapproved business has listings in the market'; end if;

  -- Somebody else cannot vet it, add to it, or advertise it.
  begin
    perform record_vendor_vetting(v, test_readings(0), 'marketplace.vetting', '1.0.0', 'test');
    fails := fails + 1; raise warning 'FAIL: a stranger recorded a vetting';
  exception when others then passes := passes + 1; end;
  begin
    perform add_offering(v, 'product', 'Fake', 'Something the owner never listed.', '£1', 'https://x.example');
    fails := fails + 1; raise warning 'FAIL: a stranger added a listing to a business';
  exception when others then passes := passes + 1; end;

  -------------------------------------------- the AI finds a violation
  perform set_config('test.uid', owner_::text, true);
  vet := record_vendor_vetting(v, test_readings(1, 2), 'marketplace.vetting', '1.0.0', 'test');
  st := vendor_status(v);
  if st = 'refused_by_ai' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a violation should refuse, got %', st; end if;

  perform set_config('test.uid', rev::text, true);
  begin
    perform sign_off_vetting(vet, 'approved', 'Looks fine to me overall.');
    fails := fails + 1; raise warning 'FAIL: a reviewer passed what the AI refused';
  exception when others then passes := passes + 1; end;

  -------------------------------------- fixed, read again, signed off
  perform set_config('test.uid', owner_::text, true);
  update vendors set evidence = vendors.evidence || ' Kiln runs on a renewable tariff.' where id = v;
  vet := record_vendor_vetting(v, test_readings(0, 1), 'marketplace.vetting', '1.0.0', 'test');
  st := vendor_status(v);
  if st = 'awaiting_sign_off' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a clean reading should await sign-off, got %', st; end if;

  -- Not by somebody who is not a reviewer.
  perform set_config('test.uid', buyer::text, true);
  begin
    perform sign_off_vetting(vet, 'approved', 'I would like this one in.');
    fails := fails + 1; raise warning 'FAIL: a non-reviewer signed off';
  exception when others then passes := passes + 1; end;

  -- Nobody can make themselves a reviewer.
  begin
    insert into marketplace_reviewers (profile_id) values (buyer);
    fails := fails + 1; raise warning 'FAIL: somebody made themselves a reviewer';
  exception when others then passes := passes + 1; end;

  -- Advertising before approval is refused: approval comes first.
  perform set_config('test.uid', owner_::text, true);
  begin
    perform create_campaign(v, o, 'Mugs that last', 'Hand-thrown, lead-free, local.', 50, 5000);
    fails := fails + 1; raise warning 'FAIL: an unapproved business started a campaign';
  exception when others then passes := passes + 1; end;

  perform set_config('test.uid', rev::text, true);
  perform sign_off_vetting(vet, 'approved', 'Evidence checked against their website.');
  st := vendor_status(v);
  if st = 'approved' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: expected approved after sign-off, got %', st; end if;

  begin
    perform sign_off_vetting(vet, 'refused', 'Changing my mind after the fact.');
    fails := fails + 1; raise warning 'FAIL: a vetting was signed twice';
  exception when others then passes := passes + 1; end;

  perform set_config('test.uid', buyer::text, true);
  select count(*)::int into n from market_offerings() where id = o;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: an approved listing is missing from the market'; end if;
  select count(*)::int into n from market_vendors() where id = v;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: an approved business is missing'; end if;
  select count(*)::int into n from market_offerings('service') where id = o;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the kind filter let a product through as a service'; end if;
  select count(*)::int into n from market_offerings(null, 'mug') where id = o;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: search did not find "mug"'; end if;

  -- The buyer sees the status, never the reading.
  select count(*)::int into n from vendor_vettings where vendor_id = v;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a buyer can read the vetting itself'; end if;

  ------------------------------------------------- a reviewer's own business
  perform set_config('test.uid', rev::text, true);
  v2 := register_vendor('Reviewer Rugs', 'Rugs woven by the reviewer, who should not judge them.',
                        evidence, 'https://rugs.example');
  vet := record_vendor_vetting(v2, test_readings(0), 'marketplace.vetting', '1.0.0', 'test');
  begin
    perform sign_off_vetting(vet, 'approved', 'My own rugs are excellent.');
    fails := fails + 1; raise warning 'FAIL: a reviewer signed off their own business';
  exception when others then passes := passes + 1; end;

  ---------------------------------------------------------- advertising
  perform set_config('test.uid', owner_::text, true);
  camp := create_campaign(v, o, 'Mugs that last', 'Hand-thrown, lead-free, local.', 50, 120);
  camp2 := create_campaign(v, null, 'Visit the studio', 'Open Saturdays, come and see the kiln.', 20, 5000);

  -- The vendor never sees their own ad in the slot.
  select count(*)::int into n from pick_ad();
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a vendor was shown their own ad'; end if;

  perform set_config('test.uid', buyer::text, true);
  select count(*)::int into n from pick_ad() where campaign_id = camp;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the highest live bid did not take the slot'; end if;

  url := record_ad_click(camp);
  perform record_ad_click(camp);
  spent := campaign_spent(camp);
  if url = 'https://corner-pottery.example/mug' and spent = 50 then passes := passes + 1;
  else fails := fails + 1;
    raise warning 'FAIL: click should go to the listing and charge once (url %, spent %)', url, spent; end if;

  perform set_config('test.uid', owner_::text, true);
  perform record_ad_click(camp);
  if campaign_spent(camp) = 50 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the vendor was charged for clicking their own ad'; end if;

  -- 50 spent of 120; one more click at 50 fits, the next would not.
  perform set_config('test.uid', rival::text, true);
  perform record_ad_click(camp);
  if campaign_spent(camp) = 100 and not campaign_live(camp) then passes := passes + 1;
  else fails := fails + 1;
    raise warning 'FAIL: a campaign kept running past its budget (spent %)', campaign_spent(camp); end if;

  select campaign_id into camp3 from pick_ad();
  if camp3 = camp2 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the slot did not pass to the next live campaign'; end if;

  -- A buyer cannot see anybody's campaigns or clicks.
  select count(*)::int into n from ad_campaigns;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a stranger can read campaigns'; end if;

  ------------------------------------- an edit lapses approval and the ads
  perform set_config('test.uid', owner_::text, true);
  update vendors set description = 'Now also selling imported mugs we did not make ourselves.' where id = v;
  st := vendor_status(v);
  if st = 'changed' and not campaign_live(camp2) then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: an edit should lapse approval and stop ads (status %)', st; end if;

  perform set_config('test.uid', buyer::text, true);
  select count(*)::int into n from market_offerings() where id = o;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a changed business kept its listings up'; end if;

  -- Read and signed again.
  perform set_config('test.uid', owner_::text, true);
  vet := record_vendor_vetting(v, test_readings(0), 'marketplace.vetting', '1.0.0', 'test');
  perform set_config('test.uid', rev::text, true);
  perform sign_off_vetting(vet, 'approved', 'Imported range checked, supplier is fair trade.');

  -------------------------------------------------------------- concerns
  perform set_config('test.uid', buyer::text, true);
  conc := raise_vendor_concern(v, 'equity_and_justice', 'The imported mugs come from a supplier with no labour audit.');

  perform set_config('test.uid', owner_::text, true);
  select count(*)::int into n from vendor_concerns where id = conc;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the vendor can see who raised a concern about them'; end if;

  perform set_config('test.uid', rev::text, true);
  select count(*)::int into n from vendor_concerns where id = conc;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a reviewer cannot see a concern'; end if;

  ------------------------------------------------------------ suspension
  perform suspend_vendor(v, 'Investigating the labour concern raised about the imported range.');
  st := vendor_status(v);
  if st = 'suspended' and not campaign_live(camp2) then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: suspension should hide the business and stop ads (%)', st; end if;

  perform lift_suspension(v, 'Supplier audit received and checked.');
  perform close_vendor_concern(conc, 'Audit received; supplier meets the standard.');
  if vendor_status(v) = 'approved' and campaign_live(camp2) then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: lifting a suspension should restore approval'; end if;

  ----------------------------------------------------- listings come and go
  perform set_config('test.uid', owner_::text, true);
  o2 := add_offering(v, 'service', 'Throwing class', 'Two hours on the wheel, clay included.',
                     '£45', 'https://corner-pottery.example/class');
  perform set_config('test.uid', rev::text, true);
  perform remove_offering(o2, 'Class listing makes a safety claim we cannot check.');
  perform set_config('test.uid', owner_::text, true);
  perform withdraw_offering(o);
  perform set_config('test.uid', buyer::text, true);
  select count(*)::int into n from market_offerings() where vendor_id = v;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: withdrawn or removed listings are still in the market'; end if;

  raise notice ' ';
  raise notice '  Trade: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;

reset role;

---------------------------------------------------------------- absences
do $$
declare passes int := 0; fails int := 0; n int;
begin
  -- Paying buys visibility, never approval: nothing on the approval side reads
  -- anything on the money side.
  select count(*)::int into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public'
     and p.proname in ('vendor_status', 'vendor_approved', 'sign_off_vetting',
                       'record_vendor_vetting', 'offering_listed', 'market_offerings',
                       'market_vendors', 'vendor_content_hash')
     and pg_get_functiondef(p.oid) ~* '(campaign|ad_click|bid|spent|budget|pence)';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % approval or ordering functions read advertising', n; end if;

  -- No ratings, scores or stored approval.
  select count(*)::int into n from information_schema.columns
   where table_schema = 'public'
     and table_name in ('vendors', 'offerings')
     and column_name ~* '(status|approved|rating|score|stars|rank|boost|featured|sponsor)';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % stored-approval or rating columns on vendors or offerings', n; end if;

  -- The only write policy is a vendor editing itself.
  select count(*)::int into n from pg_policies
   where tablename in ('vendors', 'vendor_vettings', 'vendor_suspensions', 'vendor_concerns',
                       'offerings', 'ad_campaigns', 'ad_clicks', 'marketplace_reviewers')
     and cmd <> 'SELECT' and policyname <> 'vendors_owner_update';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % unexpected write policies', n; end if;

  -- 0030's proposal-based listings are gone.
  if to_regclass('public.listings') is null then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the proposal-based listings table survived'; end if;

  raise notice ' ';
  raise notice '  Trade (absences): % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;

drop function test_readings(int, int);
