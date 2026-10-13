-- 0054: an advertiser sees clicks and spend, never who clicked.
--
-- Found on 13 October 2026 while checking the public privacy notice against
-- the live database. The notice says "Advertisers see clicks and spend. Never
-- who clicked". But ad_clicks carries viewer_id, the ad_clicks_read policy
-- lets the owner of the campaign's business read every row, and Supabase's
-- default grants give authenticated SELECT on every column. So a business
-- owner could call the REST API directly and read the profile id of every
-- person who clicked — a stable identifier, and a name wherever profiles_read
-- lets them see that profile (same group, same local place, a follow).
--
-- The app never asks for it (market/sell reads campaign_id and cost_pence),
-- so this changes nothing on screen. It makes the notice true at the database:
-- signed-in callers can read every column of ad_clicks except viewer_id, and
-- signed-out callers can read nothing. Everything that needs viewer_id —
-- record_ad_click(), campaign_spent(), the data export and account erasure —
-- runs as security definer and is unaffected. Row-level security still
-- decides which rows (the business owner's own campaigns, and reviewers).
--
-- Re-runnable.

revoke all on ad_clicks from public, anon, authenticated;
grant select (id, campaign_id, day, cost_pence, created_at) on ad_clicks to authenticated;
