-- 0033 — The sponsored slot goes to the best fit, not the highest bid (rule 37).
--
-- Mackenzie's direction: the top ad should be the business that aligns best
-- with the person looking, not the one paying most. So the slot is now chosen
-- by FIT, and money only decides who is eligible and what a click costs.
--
-- FIT, for the viewer, is two things:
--
--   * VALUES MATCH (70%). How much of what the business says about itself —
--     its description, its evidence, its products and services — speaks to
--     the values this viewer wrote for themselves. Postgres full-text
--     matching of their words against the business's words. No model call,
--     so it works today, and it is the same answer every time.
--
--   * LAW ALIGNMENT (30%). How cleanly the business passed its vetting: a
--     reading with no tensions is a better fit than one a reviewer passed
--     despite three.
--
-- Only then the bid, as a tie-break between businesses that fit equally —
-- which in practice mostly means a viewer who has written no values yet.
--
-- PRIVACY. A viewer's values are theirs alone (rule 1). They are read here,
-- inside a security definer function, for the person asking and nobody
-- else; the function returns which of THEIR values a business matched so the
-- slot can say why it is there, and nothing about the match is stored or
-- shown to the business. An advertiser sees clicks and spend, never who
-- matched or on what.
--
-- AND THE OTHER DIRECTION STILL HOLDS. Nothing that decides approval reads
-- anything here, and nothing here reads anything about money except
-- `pick_ad()` itself, after fit has been decided. `27_ad_alignment.sql`
-- reads `ad_fit()`'s source and fails if it mentions a bid, a budget, spend
-- or a click.

-- What a business says about itself, as searchable text. Approved offerings
-- count, because what a business sells is part of what it is.
create or replace function vendor_document(p_vendor_id uuid)
returns tsvector
language sql
stable
security definer
set search_path = public
as $$
  select
    setweight(to_tsvector('english', coalesce(v.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(v.description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(v.evidence, '')), 'C') ||
    setweight(to_tsvector('english', coalesce((
      select string_agg(o.name || ' ' || o.description, ' ')
        from offerings o
       where o.vendor_id = v.id and o.withdrawn_at is null and o.removed_at is null
    ), '')), 'B')
  from vendors v where v.id = p_vendor_id;
$$;

-- One query of all the viewer's value words, OR'd, so a business that speaks
-- to any of them scores and one that speaks to many scores more.
create or replace function my_values_query()
returns tsquery
language sql
stable
security definer
set search_path = public
as $$
  select case when count(*) = 0 then null
              else to_tsquery('simple', string_agg(distinct quote_literal(lexeme), ' | ')) end
  from profile_values pv,
       unnest(tsvector_to_array(to_tsvector('english', pv.name || ' ' || coalesce(pv.definition, '')))) lexeme
  where pv.profile_id = auth.uid();
$$;

-- How cleanly the business passed: 1 with no tensions, less with each one.
create or replace function vendor_law_fit(p_vendor_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(1 - (
    select vv.tensions from vendor_vettings vv
     where vv.vendor_id = p_vendor_id and vv.decision = 'approved'
     order by vv.signed_at desc limit 1
  )::numeric / 10, 0);
$$;

-- Fit between the person asking and a business, 0 to 1, and which of their
-- values it matched. Reads nothing about money.
create or replace function ad_fit(p_vendor_id uuid)
returns table (fit numeric, matched text[])
language sql
stable
security definer
set search_path = public
as $$
  with q as (select my_values_query() as q),
  d as (select vendor_document(p_vendor_id) as d)
  select
    round(
      0.7 * least(1, 2 * coalesce((select ts_rank(d.d, q.q, 32)::numeric from q, d where q.q is not null), 0))
      + 0.3 * vendor_law_fit(p_vendor_id), 4)::numeric,
    coalesce((
      select array_agg(pv.name order by pv.position)
        from profile_values pv, d
       where pv.profile_id = auth.uid()
         and exists (
           select 1 from unnest(tsvector_to_array(
             to_tsvector('english', pv.name || ' ' || coalesce(pv.definition, '')))) l
            where d.d @@ to_tsquery('simple', quote_literal(l))
         )
    ), '{}')
$$;

-- The one sponsored slot. Fit first; the bid only breaks ties; equal fits and
-- bids rotate by day. Eligibility (approved, live, budget left) is unchanged.
drop function if exists pick_ad();
create or replace function pick_ad()
returns table (
  campaign_id uuid, vendor_id uuid, vendor_name text, offering_id uuid,
  headline text, body text, fit numeric, matched text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.vendor_id, v.name, c.offering_id, c.headline, c.body, f.fit, f.matched
  from ad_campaigns c
  join vendors v on v.id = c.vendor_id
  cross join lateral ad_fit(c.vendor_id) f
  where campaign_live(c.id) and v.owner_id is distinct from auth.uid()
  order by f.fit desc, c.bid_pence desc, md5(c.id::text || current_date::text)
  limit 1;
$$;

revoke all on function vendor_document(uuid), my_values_query(), vendor_law_fit(uuid) from public;
grant execute on function ad_fit(uuid), pick_ad() to authenticated;
