-- 0035 — A to-do list of your own, and ads beside a search (rules 1, 37).
--
-- TO DO. Individual is for things with no crossover to anybody else. A to-do
-- is the plainest example: yours, readable and writable by you alone, never
-- referenced by anything collective. Like every private table, the policy is
-- the owner and nobody else (rule 1).
--
-- SEARCH ADS. Mackenzie asked for ads beside related searches. The same rules
-- as the marketplace slot hold: only approved businesses with a live campaign,
-- labelled, one at a time, and chosen by relevance and fit — what the search
-- was about, then the viewer's own values and how cleanly the business passed
-- its vetting — with the bid only breaking ties. A search that matches no
-- advertiser shows no ad; nothing is shown just because somebody paid.

create table if not exists todos (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  body       text not null,
  done_at    timestamptz,
  created_at timestamptz not null default now(),
  constraint todos_body_len check (length(btrim(body)) between 1 and 500)
);

create index if not exists todos_profile_idx on todos (profile_id, done_at, created_at desc);

alter table todos enable row level security;

drop policy if exists todos_own on todos;
create policy todos_own on todos for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- One ad for a search, or none.
create or replace function search_ad(p_q text)
returns table (
  campaign_id uuid, vendor_id uuid, vendor_name text, offering_id uuid,
  headline text, body text, fit numeric, matched text[]
)
language sql
stable
security definer
set search_path = public
as $$
  with q as (
    select websearch_to_tsquery('english', coalesce(p_q, '')) as q
  )
  select c.id, c.vendor_id, v.name, c.offering_id, c.headline, c.body, f.fit, f.matched
  from ad_campaigns c
  join vendors v on v.id = c.vendor_id
  cross join q
  cross join lateral ad_fit(c.vendor_id) f
  where length(btrim(coalesce(p_q, ''))) >= 2
    and campaign_live(c.id)
    and v.owner_id is distinct from auth.uid()
    and vendor_document(c.vendor_id) @@ q.q
  order by ts_rank(vendor_document(c.vendor_id), q.q) desc, f.fit desc, c.bid_pence desc,
           md5(c.id::text || current_date::text)
  limit 1;
$$;

grant execute on function search_ad(text) to authenticated;
