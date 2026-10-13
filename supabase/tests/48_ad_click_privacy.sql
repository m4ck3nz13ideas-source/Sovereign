-- An advertiser sees clicks and spend, never who clicked (0054).
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  passes int := 0; fails int := 0;
begin
  if not has_column_privilege('authenticated', 'public.ad_clicks', 'viewer_id', 'select') then
    passes := passes + 1;
  else
    fails := fails + 1; raise notice 'FAIL: a signed-in caller can read who clicked an ad';
  end if;

  if has_column_privilege('authenticated', 'public.ad_clicks', 'campaign_id', 'select')
     and has_column_privilege('authenticated', 'public.ad_clicks', 'cost_pence', 'select') then
    passes := passes + 1;
  else
    fails := fails + 1; raise notice 'FAIL: the business can no longer see its clicks and spend';
  end if;

  if not has_table_privilege('anon', 'public.ad_clicks', 'select')
     and not has_column_privilege('anon', 'public.ad_clicks', 'viewer_id', 'select') then
    passes := passes + 1;
  else
    fails := fails + 1; raise notice 'FAIL: a signed-out caller can read ad clicks';
  end if;

  if not has_table_privilege('authenticated', 'public.ad_clicks', 'insert')
     and not has_table_privilege('authenticated', 'public.ad_clicks', 'update')
     and not has_table_privilege('authenticated', 'public.ad_clicks', 'delete') then
    passes := passes + 1;
  else
    fails := fails + 1; raise notice 'FAIL: a signed-in caller can write ad clicks directly';
  end if;

  -- The definer paths still work for the parts that need viewer_id.
  if has_function_privilege('authenticated', 'record_ad_click(uuid)', 'execute') then
    passes := passes + 1;
  else
    fails := fails + 1; raise notice 'FAIL: signed-in members can no longer click an ad';
  end if;

  raise notice ' ';
  raise notice '  Ad click privacy: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;

reset role;
