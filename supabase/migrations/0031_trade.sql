-- 0031 — The marketplace as trade (rule 37, rewritten).
--
-- 0030 made the marketplace a proposal space: every listing rode in on a
-- decision. That was the wrong shape. The marketplace is for trade, and the
-- thing that makes it Sovereign's is not a vote but a standard: only
-- businesses whose products and services align with the Universal Laws are in
-- it. 0030 was applied but never held a row; this migration removes it.
--
-- THE SHAPE
--
--   A VENDOR is a business. It says what it is and gives its evidence: how it
--   treats people, what it is made of, where it comes from. It offers PRODUCTS
--   and SERVICES. Buying happens on the vendor's own site for now; a listing
--   links out.
--
--   A vendor is APPROVED when, for the exact words it currently stands on:
--     1. the AI has read it against all ten Universal Laws and found no
--        violation, and
--     2. a marketplace reviewer has signed that reading off, and
--     3. no reviewer has suspended it since.
--   Approval is derived (`vendor_approved()`), never stored. The vetting
--   records a hash of what it read, so editing the name, description or
--   evidence after approval lapses the approval until it is read and signed
--   again. There is no column anybody can set to "approved".
--
--   ADVERTISING is pay per click. An approved vendor runs campaigns with a bid
--   and a budget; one labelled sponsored slot shows the highest live bid; a
--   click is charged once per person per campaign per day, and never for the
--   vendor's own clicks.
--
-- THE ONE RULE THE REVENUE DEPENDS ON
--
--   PAYING BUYS VISIBILITY, NEVER APPROVAL. Only an approved vendor can run a
--   campaign, an ad stops the moment its vendor stops being approved, and
--   nothing on the approval side reads anything on the money side. The suite
--   reads the source of every approval function and fails if any of them
--   mentions a campaign, a bid, a click or spend. If approval could be
--   influenced by ad spend, "aligned" would mean "paid", and that word is the
--   thing advertisers are paying for.
--
-- What is NOT here yet, deliberately: in-app checkout and payments (link out
-- now), charging advertisers (spend is recorded and shown; collecting it is a
-- Stripe step), SOV (an open decision), ratings and reviews (a later decision —
-- a star average is a score of a business, and the community's voice is
-- `vendor_concerns` for now).

------------------------------------------------------------ retire 0030

drop function if exists marketplace(listing_kind);
drop function if exists listing_state(uuid);
drop function if exists my_attachable_proposals(uuid);
drop function if exists offer_listing(uuid, listing_kind, text, text, text, text);
drop function if exists set_listing_contact(uuid, text);
drop function if exists withdraw_listing(uuid, text);
drop function if exists attach_revocation(uuid, uuid, text);
drop function if exists lock_attachable_proposal(uuid);
drop table if exists listing_revocations;
drop table if exists listings;
drop function if exists freeze_listing();
drop function if exists freeze_revocation();
drop type if exists listing_kind;

------------------------------------------------------------------- types

do $$ begin
  create type offering_kind as enum ('product', 'service');
exception when duplicate_object then null; end $$;

do $$ begin
  create type vetting_decision as enum ('approved', 'refused');
exception when duplicate_object then null; end $$;

---------------------------------------------------------------- reviewers

-- Who signs off. Granted from the SQL editor by the project owner; there is no
-- policy by which anybody can add themselves.
create table if not exists marketplace_reviewers (
  profile_id uuid primary key references profiles(id) on delete cascade,
  added_at   timestamptz not null default now()
);

alter table marketplace_reviewers enable row level security;
drop policy if exists marketplace_reviewers_self on marketplace_reviewers;
create policy marketplace_reviewers_self on marketplace_reviewers
  for select using (profile_id = auth.uid());

create or replace function is_marketplace_reviewer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from marketplace_reviewers where profile_id = auth.uid());
$$;

------------------------------------------------------------------ vendors

create table if not exists vendors (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references profiles(id) on delete cascade,
  name        text not null,
  description text not null,
  evidence    text not null,
  website     text not null,
  location    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint vendors_name_len        check (length(btrim(name)) between 2 and 120),
  constraint vendors_description_len check (length(btrim(description)) between 40 and 2000),
  constraint vendors_evidence_len    check (length(btrim(evidence)) between 80 and 6000),
  constraint vendors_website_https   check (website ~ '^https://[^\s]+$' and length(website) <= 500),
  constraint vendors_location_len    check (location is null or length(btrim(location)) <= 120)
);

create index if not exists vendors_owner_idx on vendors (owner_id);

-- What a vetting is a reading of. Changing any of these means the reading was
-- of something else.
create or replace function vendor_content_hash(v vendors)
returns text
language sql
immutable
as $$
  select md5(concat_ws(E'\x1f', v.name, v.description, v.evidence, v.website, coalesce(v.location, '')));
$$;

create table if not exists vendor_vettings (
  id             uuid primary key default gen_random_uuid(),
  vendor_id      uuid not null references vendors(id) on delete cascade,
  content_hash   text not null,
  readings       jsonb not null,
  violations     int  not null,
  tensions       int  not null,
  prompt_id      text not null,
  prompt_version text not null,
  model          text not null,
  created_at     timestamptz not null default now(),
  decision       vetting_decision,
  signed_by      uuid references profiles(id),
  signed_at      timestamptz,
  sign_note      text,

  constraint vendor_vettings_readings_ten check (jsonb_typeof(readings) = 'array' and jsonb_array_length(readings) = 10),
  constraint vendor_vettings_signed_paired check (
    (decision is null and signed_by is null and signed_at is null and sign_note is null)
    or (decision is not null and signed_by is not null and signed_at is not null
        and sign_note is not null and length(btrim(sign_note)) between 10 and 1000)
  )
);

create index if not exists vendor_vettings_vendor_idx on vendor_vettings (vendor_id, created_at desc);

create table if not exists vendor_suspensions (
  id           uuid primary key default gen_random_uuid(),
  vendor_id    uuid not null references vendors(id) on delete cascade,
  suspended_by uuid not null references profiles(id),
  reason       text not null,
  created_at   timestamptz not null default now(),
  lifted_by    uuid references profiles(id),
  lifted_at    timestamptz,
  lift_note    text,
  constraint vendor_suspensions_reason_len check (length(btrim(reason)) between 20 and 1000),
  constraint vendor_suspensions_lift_paired check (
    (lifted_at is null and lifted_by is null and lift_note is null)
    or (lifted_at is not null and lifted_by is not null and lift_note is not null
        and length(btrim(lift_note)) between 10 and 1000)
  )
);

create table if not exists vendor_concerns (
  id         uuid primary key default gen_random_uuid(),
  vendor_id  uuid not null references vendors(id) on delete cascade,
  raised_by  uuid not null references profiles(id) on delete cascade,
  law_id     text not null,
  reason     text not null,
  created_at timestamptz not null default now(),
  closed_by  uuid references profiles(id),
  closed_at  timestamptz,
  close_note text,
  constraint vendor_concerns_reason_len check (length(btrim(reason)) between 20 and 2000),
  constraint vendor_concerns_close_paired check (
    (closed_at is null and closed_by is null and close_note is null)
    or (closed_at is not null and closed_by is not null and close_note is not null
        and length(btrim(close_note)) between 10 and 1000)
  )
);

---------------------------------------------------------------- approval
--
-- Nothing in this section may read a campaign, a bid, a click or spend.
-- 25_trade.sql enforces that by reading these functions' source.

create or replace function vendor_status(p_vendor_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  with v as (select * from vendors where id = p_vendor_id),
  latest as (
    select vv.* from vendor_vettings vv, v
    where vv.vendor_id = v.id and vv.content_hash = vendor_content_hash(v)
    order by vv.created_at desc limit 1
  )
  select case
    when not exists (select 1 from v) then null
    when exists (select 1 from vendor_suspensions s
                 where s.vendor_id = p_vendor_id and s.lifted_at is null) then 'suspended'
    when not exists (select 1 from latest) then
      case when exists (select 1 from vendor_vettings where vendor_id = p_vendor_id
                        and decision = 'approved') then 'changed'
           else 'unvetted' end
    when (select violations from latest) > 0 then 'refused_by_ai'
    when (select decision from latest) is null then 'awaiting_sign_off'
    when (select decision from latest) = 'approved' then 'approved'
    else 'refused'
  end;
$$;

create or replace function vendor_approved(p_vendor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(vendor_status(p_vendor_id) = 'approved', false);
$$;

----------------------------------------------------------------- offerings

create table if not exists offerings (
  id           uuid primary key default gen_random_uuid(),
  vendor_id    uuid not null references vendors(id) on delete cascade,
  kind         offering_kind not null,
  name         text not null,
  description  text not null,
  price        text not null,
  url          text not null,
  created_at   timestamptz not null default now(),
  withdrawn_at timestamptz,
  removed_by   uuid references profiles(id),
  removed_at   timestamptz,
  remove_note  text,

  constraint offerings_name_len        check (length(btrim(name)) between 2 and 120),
  constraint offerings_description_len check (length(btrim(description)) between 20 and 2000),
  constraint offerings_price_len       check (length(btrim(price)) between 1 and 120),
  constraint offerings_url_https       check (url ~ '^https://[^\s]+$' and length(url) <= 500),
  constraint offerings_removal_paired  check (
    (removed_at is null and removed_by is null and remove_note is null)
    or (removed_at is not null and removed_by is not null and remove_note is not null
        and length(btrim(remove_note)) between 10 and 1000)
  )
);

create index if not exists offerings_vendor_idx on offerings (vendor_id);

create or replace function offering_listed(p_offering_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select o.withdrawn_at is null and o.removed_at is null and vendor_approved(o.vendor_id)
    from offerings o where o.id = p_offering_id
  ), false);
$$;

-------------------------------------------------------------- advertising

create table if not exists ad_campaigns (
  id           uuid primary key default gen_random_uuid(),
  vendor_id    uuid not null references vendors(id) on delete cascade,
  offering_id  uuid references offerings(id) on delete cascade,
  headline     text not null,
  body         text not null,
  bid_pence    int  not null,
  budget_pence int  not null,
  paused       boolean not null default false,
  created_at   timestamptz not null default now(),

  constraint ad_campaigns_headline_len check (length(btrim(headline)) between 4 and 90),
  constraint ad_campaigns_body_len     check (length(btrim(body)) between 10 and 200),
  constraint ad_campaigns_bid          check (bid_pence between 5 and 10000),
  constraint ad_campaigns_budget       check (budget_pence between 100 and 100000000)
);

create index if not exists ad_campaigns_vendor_idx on ad_campaigns (vendor_id);

create table if not exists ad_clicks (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references ad_campaigns(id) on delete cascade,
  viewer_id   uuid not null references profiles(id) on delete cascade,
  day         date not null default current_date,
  cost_pence  int  not null check (cost_pence >= 0),
  created_at  timestamptz not null default now(),
  unique (campaign_id, viewer_id, day)
);

create or replace function campaign_spent(p_campaign_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(cost_pence), 0)::int from ad_clicks where campaign_id = p_campaign_id;
$$;

-- Live: not paused, budget left, vendor approved, and (if it advertises one
-- offering) that offering listed. Approval is read here; nothing here is read
-- by approval.
create or replace function campaign_live(p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select not c.paused
       and campaign_spent(c.id) + c.bid_pence <= c.budget_pence
       and vendor_approved(c.vendor_id)
       and (c.offering_id is null or offering_listed(c.offering_id))
    from ad_campaigns c where c.id = p_campaign_id
  ), false);
$$;

---------------------------------------------------------------------- RLS

alter table vendors            enable row level security;
alter table vendor_vettings    enable row level security;
alter table vendor_suspensions enable row level security;
alter table vendor_concerns    enable row level security;
alter table offerings          enable row level security;
alter table ad_campaigns       enable row level security;
alter table ad_clicks          enable row level security;

-- A vendor is public once approved; before that, its owner and reviewers.
drop policy if exists vendors_read on vendors;
create policy vendors_read on vendors for select using (
  owner_id = auth.uid() or is_marketplace_reviewer() or vendor_approved(id)
);

-- The owner may edit their own business. Doing so lapses approval by itself.
drop policy if exists vendors_owner_update on vendors;
create policy vendors_owner_update on vendors for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Vettings: the owner and reviewers. The public sees the status, not the
-- reading, because the reading quotes the vendor's own evidence back.
drop policy if exists vendor_vettings_read on vendor_vettings;
create policy vendor_vettings_read on vendor_vettings for select using (
  is_marketplace_reviewer()
  or exists (select 1 from vendors v where v.id = vendor_id and v.owner_id = auth.uid())
);

drop policy if exists vendor_suspensions_read on vendor_suspensions;
create policy vendor_suspensions_read on vendor_suspensions for select using (
  is_marketplace_reviewer()
  or exists (select 1 from vendors v where v.id = vendor_id and v.owner_id = auth.uid())
);

-- A concern is seen by whoever raised it and the reviewers — not the vendor,
-- so nobody is pressured out of raising one.
drop policy if exists vendor_concerns_read on vendor_concerns;
create policy vendor_concerns_read on vendor_concerns for select using (
  raised_by = auth.uid() or is_marketplace_reviewer()
);

drop policy if exists offerings_read on offerings;
create policy offerings_read on offerings for select using (
  offering_listed(id) or is_marketplace_reviewer()
  or exists (select 1 from vendors v where v.id = vendor_id and v.owner_id = auth.uid())
);

-- Campaigns and their clicks are the advertiser's business, and the reviewers'.
drop policy if exists ad_campaigns_read on ad_campaigns;
create policy ad_campaigns_read on ad_campaigns for select using (
  is_marketplace_reviewer()
  or exists (select 1 from vendors v where v.id = vendor_id and v.owner_id = auth.uid())
);

drop policy if exists ad_clicks_read on ad_clicks;
create policy ad_clicks_read on ad_clicks for select using (
  is_marketplace_reviewer()
  or exists (select 1 from ad_campaigns c join vendors v on v.id = c.vendor_id
             where c.id = campaign_id and v.owner_id = auth.uid())
);

------------------------------------------------------------- vendor writes

create or replace function register_vendor(
  p_name text, p_description text, p_evidence text, p_website text, p_location text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into vendors (owner_id, name, description, evidence, website, location)
  values (auth.uid(), btrim(p_name), btrim(p_description), btrim(p_evidence), btrim(p_website),
          nullif(btrim(coalesce(p_location, '')), ''))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function touch_vendor()
returns trigger
language plpgsql
as $$
begin
  if new.owner_id is distinct from old.owner_id or new.created_at is distinct from old.created_at then
    raise exception 'a business cannot change hands or history';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists vendors_touch on vendors;
create trigger vendors_touch before update on vendors
  for each row execute function touch_vendor();

-- The AI's reading, recorded by the server action that ran it, for the words
-- the vendor stands on right now.
create or replace function record_vendor_vetting(
  p_vendor_id uuid, p_readings jsonb, p_prompt_id text, p_prompt_version text, p_model text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v vendors; v_id uuid; v_viol int; v_tens int;
begin
  select * into v from vendors where id = p_vendor_id;
  if not found or v.owner_id is distinct from auth.uid() then
    raise exception 'only the business itself can ask to be vetted';
  end if;
  if jsonb_typeof(p_readings) <> 'array' or jsonb_array_length(p_readings) <> 10 then
    raise exception 'a vetting reads all ten laws';
  end if;

  select count(*) filter (where r->>'verdict' = 'violation'),
         count(*) filter (where r->>'verdict' = 'tension')
    into v_viol, v_tens
  from jsonb_array_elements(p_readings) r;

  insert into vendor_vettings (vendor_id, content_hash, readings, violations, tensions,
                               prompt_id, prompt_version, model)
  values (p_vendor_id, vendor_content_hash(v), p_readings, v_viol, v_tens,
          p_prompt_id, p_prompt_version, p_model)
  returning id into v_id;
  return v_id;
end;
$$;

-------------------------------------------------------------- reviewer writes

create or replace function sign_off_vetting(p_vetting_id uuid, p_decision vetting_decision, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare vv vendor_vettings; v vendors;
begin
  if not is_marketplace_reviewer() then raise exception 'only a marketplace reviewer can sign off'; end if;

  select * into vv from vendor_vettings where id = p_vetting_id for update;
  if not found then raise exception 'vetting not found'; end if;
  if vv.decision is not null then raise exception 'already signed off'; end if;

  select * into v from vendors where id = vv.vendor_id;
  if v.owner_id = auth.uid() then raise exception 'nobody signs off their own business'; end if;
  if vv.content_hash <> vendor_content_hash(v) then
    raise exception 'the business has changed since this was read: it needs reading again';
  end if;
  if p_decision = 'approved' and vv.violations > 0 then
    raise exception 'the AI found a violation: a person can refuse what the AI passed, never pass what it refused';
  end if;

  update vendor_vettings
     set decision = p_decision, signed_by = auth.uid(), signed_at = now(), sign_note = btrim(p_note)
   where id = p_vetting_id;
end;
$$;

create or replace function suspend_vendor(p_vendor_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not is_marketplace_reviewer() then raise exception 'only a marketplace reviewer can suspend'; end if;
  if exists (select 1 from vendor_suspensions where vendor_id = p_vendor_id and lifted_at is null) then
    raise exception 'already suspended';
  end if;
  insert into vendor_suspensions (vendor_id, suspended_by, reason)
  values (p_vendor_id, auth.uid(), btrim(p_reason)) returning id into v_id;
  return v_id;
end;
$$;

create or replace function lift_suspension(p_vendor_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_marketplace_reviewer() then raise exception 'only a marketplace reviewer can lift a suspension'; end if;
  update vendor_suspensions
     set lifted_by = auth.uid(), lifted_at = now(), lift_note = btrim(p_note)
   where vendor_id = p_vendor_id and lifted_at is null;
  if not found then raise exception 'not suspended'; end if;
end;
$$;

create or replace function raise_vendor_concern(p_vendor_id uuid, p_law_id text, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not vendor_approved(p_vendor_id) then raise exception 'business not found'; end if;
  insert into vendor_concerns (vendor_id, raised_by, law_id, reason)
  values (p_vendor_id, auth.uid(), p_law_id, btrim(p_reason)) returning id into v_id;
  return v_id;
end;
$$;

create or replace function close_vendor_concern(p_concern_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_marketplace_reviewer() then raise exception 'only a marketplace reviewer can close a concern'; end if;
  update vendor_concerns
     set closed_by = auth.uid(), closed_at = now(), close_note = btrim(p_note)
   where id = p_concern_id and closed_at is null;
  if not found then raise exception 'concern not found or already closed'; end if;
end;
$$;

------------------------------------------------------------ offering writes

create or replace function add_offering(
  p_vendor_id uuid, p_kind offering_kind, p_name text, p_description text, p_price text, p_url text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not exists (select 1 from vendors where id = p_vendor_id and owner_id = auth.uid()) then
    raise exception 'only the business can add its own products and services';
  end if;
  insert into offerings (vendor_id, kind, name, description, price, url)
  values (p_vendor_id, p_kind, btrim(p_name), btrim(p_description), btrim(p_price), btrim(p_url))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function withdraw_offering(p_offering_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update offerings o set withdrawn_at = now()
   where o.id = p_offering_id and o.withdrawn_at is null
     and exists (select 1 from vendors v where v.id = o.vendor_id and v.owner_id = auth.uid());
  if not found then raise exception 'only the business can withdraw its own listing'; end if;
end;
$$;

create or replace function remove_offering(p_offering_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_marketplace_reviewer() then raise exception 'only a marketplace reviewer can remove a listing'; end if;
  update offerings set removed_by = auth.uid(), removed_at = now(), remove_note = btrim(p_note)
   where id = p_offering_id and removed_at is null;
  if not found then raise exception 'listing not found or already removed'; end if;
end;
$$;

---------------------------------------------------------- advertiser writes

create or replace function create_campaign(
  p_vendor_id uuid, p_offering_id uuid, p_headline text, p_body text, p_bid_pence int, p_budget_pence int
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not exists (select 1 from vendors where id = p_vendor_id and owner_id = auth.uid()) then
    raise exception 'only the business can advertise itself';
  end if;
  if not vendor_approved(p_vendor_id) then
    raise exception 'only an approved business can advertise: approval cannot be bought, so it has to come first';
  end if;
  if p_offering_id is not null
     and not exists (select 1 from offerings where id = p_offering_id and vendor_id = p_vendor_id) then
    raise exception 'that listing belongs to another business';
  end if;
  insert into ad_campaigns (vendor_id, offering_id, headline, body, bid_pence, budget_pence)
  values (p_vendor_id, p_offering_id, btrim(p_headline), btrim(p_body), p_bid_pence, p_budget_pence)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function set_campaign_paused(p_campaign_id uuid, p_paused boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update ad_campaigns c set paused = p_paused
   where c.id = p_campaign_id
     and exists (select 1 from vendors v where v.id = c.vendor_id and v.owner_id = auth.uid());
  if not found then raise exception 'only the business can pause its own campaign'; end if;
end;
$$;

-------------------------------------------------------------- the ad slot

-- One sponsored slot: the highest live bid. Equal bids rotate by day so no
-- advertiser holds the slot by being created first.
create or replace function pick_ad()
returns table (
  campaign_id uuid, vendor_id uuid, vendor_name text, offering_id uuid,
  headline text, body text
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.vendor_id, v.name, c.offering_id, c.headline, c.body
  from ad_campaigns c
  join vendors v on v.id = c.vendor_id
  where campaign_live(c.id) and v.owner_id is distinct from auth.uid()
  order by c.bid_pence desc, md5(c.id::text || current_date::text)
  limit 1;
$$;

-- Records the click and returns where it goes. Charged once per person per
-- campaign per day, never for the vendor's own clicks, never past budget.
create or replace function record_ad_click(p_campaign_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare c ad_campaigns; v vendors; v_url text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into c from ad_campaigns where id = p_campaign_id for update;
  if not found then raise exception 'campaign not found'; end if;
  select * into v from vendors where id = c.vendor_id;

  if c.offering_id is not null then
    select url into v_url from offerings where id = c.offering_id;
  else
    v_url := v.website;
  end if;

  if v.owner_id is distinct from auth.uid() and campaign_live(c.id) then
    insert into ad_clicks (campaign_id, viewer_id, cost_pence)
    values (c.id, auth.uid(), c.bid_pence)
    on conflict (campaign_id, viewer_id, day) do nothing;
  end if;

  return v_url;
end;
$$;

-------------------------------------------------------------------- reads

-- Everything listed, newest first. The order is not for sale.
create or replace function market_offerings(p_kind offering_kind default null, p_q text default null)
returns table (
  id uuid, kind offering_kind, name text, description text, price text, url text,
  vendor_id uuid, vendor_name text, created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, o.kind, o.name, o.description, o.price, o.url, v.id, v.name, o.created_at
  from offerings o join vendors v on v.id = o.vendor_id
  where offering_listed(o.id)
    and (p_kind is null or o.kind = p_kind)
    and (p_q is null or btrim(p_q) = ''
         or o.name ilike '%' || btrim(p_q) || '%'
         or o.description ilike '%' || btrim(p_q) || '%'
         or v.name ilike '%' || btrim(p_q) || '%')
  order by o.created_at desc;
$$;

create or replace function market_vendors(p_q text default null)
returns table (id uuid, name text, description text, location text, website text, approved_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select v.id, v.name, v.description, v.location, v.website,
         (select max(signed_at) from vendor_vettings vv
           where vv.vendor_id = v.id and vv.decision = 'approved')
  from vendors v
  where vendor_approved(v.id)
    and (p_q is null or btrim(p_q) = ''
         or v.name ilike '%' || btrim(p_q) || '%'
         or v.description ilike '%' || btrim(p_q) || '%')
  order by v.name;
$$;

grant execute on function
  is_marketplace_reviewer(), vendor_status(uuid), vendor_approved(uuid), offering_listed(uuid),
  campaign_spent(uuid), campaign_live(uuid),
  register_vendor(text, text, text, text, text),
  record_vendor_vetting(uuid, jsonb, text, text, text),
  sign_off_vetting(uuid, vetting_decision, text), suspend_vendor(uuid, text),
  lift_suspension(uuid, text), raise_vendor_concern(uuid, text, text),
  close_vendor_concern(uuid, text),
  add_offering(uuid, offering_kind, text, text, text, text), withdraw_offering(uuid),
  remove_offering(uuid, text),
  create_campaign(uuid, uuid, text, text, int, int), set_campaign_paused(uuid, boolean),
  pick_ad(), record_ad_click(uuid), market_offerings(offering_kind, text), market_vendors(text)
  to authenticated;
