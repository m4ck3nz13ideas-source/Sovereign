-- 0062 — A business can run on Sovereign (rule 55).
--
-- Until now a business could register, be vetted, list what it sells (each
-- listing linking out) and advertise — and only its owner could touch any of
-- it, and a customer had no way to reach it inside the app. Mackenzie, 25
-- October 2026: "make businesses operable". Four things, money still settled
-- off the app:
--
--   1. A TEAM. The owner invites people by exact handle as a manager or as
--      staff; they accept. Managers run the listings, post the business's
--      updates and reply to reviews. Staff and managers both answer customers
--      and run orders. The business's claims (what the AI reads and a
--      reviewer signs off), its advertising and its team stay with the
--      owner: one accountable person stands behind what the business says
--      and what it spends.
--
--   2. ENQUIRIES. "Message" on a business opens one conversation between that
--      customer and the business, answered by anybody on its team. Nothing in
--      it reaches a decision, the ledger or SOV (as rule 23).
--
--   3. ORDERS AND BOOKINGS, with the customer's approval as the last step:
--
--        requested ─ accept (team: agreed price, and a time for a service) ─▶ accepted
--            │  └─ decline (team, with a reason) ─▶ declined
--            └─ cancel (customer) ─▶ cancelled
--        accepted ─ deliver (team) ─▶ delivered      cancel (either, with a reason) ─▶ cancelled
--        delivered ─ confirm (customer) ─▶ completed
--                  ─ report a problem (customer) ─▶ disputed ─ reviewer ─▶ completed | cancelled
--                  ─ no reply in 14 days (team may close) ─▶ completed
--
--      This is the shape escrow will hold money against later (funds
--      released on "completed"); for now price and payment are agreed between
--      the two, and every move is an event naming who made it and why.
--
--   4. REVIEWS, only from a customer whose order completed, one per order,
--      written once. The business may reply once and can never delete one; a
--      reviewer may remove one that breaks a Universal Law, with a note.
--      The summary is a count per star, never an average stored anywhere.
--
-- THE LINE THAT HOLDS (rule 37, extended): no approval, listing order, ad fit
-- or ad slot function reads an order or a review. Being approved is about
-- what a business stands on; being in front of people is paid for or earned
-- by fit to the viewer's values; neither is bought with volume or stars.
-- `53_business_operations.sql` reads those functions' source and fails if one
-- does. And nobody on a business's team signs off, checks, reviews, orders
-- from or is charged for clicking that business.

------------------------------------------------------------------- types

do $$ begin
  create type vendor_role as enum ('manager', 'staff');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum
    ('requested', 'accepted', 'declined', 'cancelled', 'delivered', 'completed', 'disputed');
exception when duplicate_object then null; end $$;

-------------------------------------------------------------------- team

create table if not exists vendor_members (
  vendor_id   uuid not null references vendors(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  role        vendor_role not null,
  invited_by  uuid not null references profiles(id),
  invited_at  timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (vendor_id, profile_id)
);

create index if not exists vendor_members_profile_idx on vendor_members (profile_id);

alter table vendor_members enable row level security;

-- The caller's place in a business: 'owner', 'manager', 'staff' or null.
-- It takes no profile id and must not grow one: it answers for the person
-- asking, so it cannot be used to map anybody else's work.
create or replace function vendor_team_role(p_vendor_id uuid)
returns text
language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is null then null
    when exists (select 1 from vendors where id = p_vendor_id and owner_id = auth.uid()) then 'owner'
    else (select m.role::text from vendor_members m
           where m.vendor_id = p_vendor_id and m.profile_id = auth.uid()
             and m.accepted_at is not null)
  end;
$$;

-- Does the caller hold at least this role? staff < manager < owner.
create or replace function vendor_can(p_vendor_id uuid, p_need text)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    case vendor_team_role(p_vendor_id)
      when 'owner'   then true
      when 'manager' then p_need in ('manager', 'staff')
      when 'staff'   then p_need = 'staff'
      else false
    end, false);
$$;

drop policy if exists vendor_members_read on vendor_members;
create policy vendor_members_read on vendor_members for select using (
  profile_id = auth.uid() or vendor_team_role(vendor_id) is not null
);

create or replace function invite_vendor_member(p_vendor_id uuid, p_handle text, p_role vendor_role)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_who uuid;
begin
  if vendor_team_role(p_vendor_id) is distinct from 'owner' then
    raise exception 'only the owner can build the team';
  end if;
  select id into v_who from profiles
   where handle is not null and handle = lower(btrim(ltrim(coalesce(p_handle, ''), '@')))
     and erased_at is null;
  if v_who is null then raise exception 'nobody has that handle'; end if;
  if v_who = auth.uid() then raise exception 'you already own this business'; end if;
  if (select count(*) from vendor_members where vendor_id = p_vendor_id) >= 50 then
    raise exception 'a team is fifty people at most';
  end if;
  insert into vendor_members (vendor_id, profile_id, role, invited_by)
  values (p_vendor_id, v_who, p_role, auth.uid())
  on conflict (vendor_id, profile_id) do nothing;
  if not found then raise exception 'already on the team or invited'; end if;
  return v_who;
end;
$$;

create or replace function accept_vendor_invite(p_vendor_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update vendor_members set accepted_at = now()
   where vendor_id = p_vendor_id and profile_id = auth.uid() and accepted_at is null;
  if not found then raise exception 'no invitation to accept'; end if;
end;
$$;

-- Declining an invitation and leaving a team are the same act.
create or replace function leave_vendor(p_vendor_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from vendor_members where vendor_id = p_vendor_id and profile_id = auth.uid();
  if not found then raise exception 'you are not on this team'; end if;
end;
$$;

create or replace function remove_vendor_member(p_vendor_id uuid, p_profile_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if vendor_team_role(p_vendor_id) is distinct from 'owner' then
    raise exception 'only the owner can change the team';
  end if;
  delete from vendor_members where vendor_id = p_vendor_id and profile_id = p_profile_id;
  if not found then raise exception 'not on this team'; end if;
end;
$$;

create or replace function set_vendor_member_role(p_vendor_id uuid, p_profile_id uuid, p_role vendor_role)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if vendor_team_role(p_vendor_id) is distinct from 'owner' then
    raise exception 'only the owner can change the team';
  end if;
  update vendor_members set role = p_role where vendor_id = p_vendor_id and profile_id = p_profile_id;
  if not found then raise exception 'not on this team'; end if;
end;
$$;

-- The team as its members see it: names and roles, the owner first.
create or replace function vendor_team(p_vendor_id uuid)
returns table (profile_id uuid, display_name text, handle text, role text, accepted boolean)
language sql stable security definer set search_path = public as $$
  select v.owner_id, p.display_name, p.handle, 'owner', true
    from vendors v join profiles p on p.id = v.owner_id
   where v.id = p_vendor_id and vendor_team_role(p_vendor_id) is not null
  union all
  select m.profile_id, p.display_name, p.handle, m.role::text, m.accepted_at is not null
    from vendor_members m join profiles p on p.id = m.profile_id
   where m.vendor_id = p_vendor_id and vendor_team_role(p_vendor_id) is not null;
$$;

create or replace function my_vendor_invites()
returns table (vendor_id uuid, vendor_name text, role text, invited_by text, invited_at timestamptz)
language sql stable security definer set search_path = public as $$
  select v.id, v.name, m.role::text, p.display_name, m.invited_at
    from vendor_members m
    join vendors v on v.id = m.vendor_id
    join profiles p on p.id = m.invited_by
   where m.profile_id = auth.uid() and m.accepted_at is null
   order by m.invited_at desc;
$$;

---------------------------------------------- the team reaches the business

drop policy if exists vendors_read on vendors;
create policy vendors_read on vendors for select using (
  owner_id = auth.uid() or is_marketplace_reviewer() or vendor_approved(id)
  or vendor_team_role(id) is not null
);

drop policy if exists offerings_read on offerings;
create policy offerings_read on offerings for select using (
  offering_listed(id) or is_marketplace_reviewer() or vendor_team_role(vendor_id) is not null
);

create or replace function add_offering(
  p_vendor_id uuid, p_kind offering_kind, p_name text, p_description text, p_price text, p_url text
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not vendor_can(p_vendor_id, 'manager') then
    raise exception 'only the business''s owner or a manager can list its products and services';
  end if;
  insert into offerings (vendor_id, kind, name, description, price, url)
  values (p_vendor_id, p_kind, btrim(p_name), btrim(p_description), btrim(p_price), btrim(p_url))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function withdraw_offering(p_offering_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update offerings o set withdrawn_at = now()
   where o.id = p_offering_id and o.withdrawn_at is null and vendor_can(o.vendor_id, 'manager');
  if not found then raise exception 'only the business''s owner or a manager can withdraw a listing'; end if;
end;
$$;

-- A manager may post the business's updates as well as its owner.
create or replace function check_vendor_post()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.vendor_id is not null and not exists (
    select 1 from vendors where id = new.vendor_id and owner_id = new.author_id
  ) and not exists (
    select 1 from vendor_members m
     where m.vendor_id = new.vendor_id and m.profile_id = new.author_id
       and m.role = 'manager' and m.accepted_at is not null
  ) then
    raise exception 'only the business''s owner or a manager can post as it';
  end if;
  return new;
end;
$$;

revoke all on function check_vendor_post() from public, anon, authenticated;

----------------------------------------- nobody judges a business they work for

-- 0038's function; "their own business" now means any business they are on
-- the team of. Nothing here reads the money side, an order or a review.
create or replace function sign_off_vetting(p_vetting_id uuid, p_decision vetting_decision, p_note text)
returns void
language plpgsql security definer set search_path = public as $$
declare vv vendor_vettings; v vendors;
begin
  if not is_marketplace_reviewer() then raise exception 'only a marketplace reviewer can sign off'; end if;

  select * into vv from vendor_vettings where id = p_vetting_id for update;
  if not found then raise exception 'vetting not found'; end if;
  if vv.decision is not null then raise exception 'already signed off'; end if;

  select * into v from vendors where id = vv.vendor_id;
  if vendor_team_role(v.id) is not null then raise exception 'nobody signs off their own business'; end if;
  if vv.content_hash <> vendor_content_hash(v) then
    raise exception 'the business has changed since this was read: it needs reading again';
  end if;
  if p_decision = 'approved' and vv.violations > 0 then
    raise exception 'the AI found a violation: a person can refuse what the AI passed, never pass what it refused';
  end if;
  if p_decision = 'approved' and not vendor_domain_verified(v.id) then
    raise exception 'check the website first: a business has to show it owns its own website before it is approved';
  end if;

  update vendor_vettings
     set decision = p_decision, signed_by = auth.uid(), signed_at = now(), sign_note = btrim(p_note)
   where id = p_vetting_id;
end;
$$;

create or replace function record_vendor_verification(
  p_vendor_id uuid, p_kind text, p_subject text, p_passed boolean, p_detail text
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v vendors; v_id uuid;
begin
  if not is_marketplace_reviewer() then raise exception 'only a marketplace reviewer can record a check'; end if;
  select * into v from vendors where id = p_vendor_id;
  if not found then raise exception 'business not found'; end if;
  if vendor_team_role(v.id) is not null then raise exception 'nobody checks their own business'; end if;
  if p_kind = 'domain' and p_subject is distinct from website_host(v.website) then
    raise exception 'that is not this business''s website';
  end if;
  if p_kind = 'companies_house' and p_subject is distinct from v.company_number then
    raise exception 'that is not this business''s company number';
  end if;
  insert into vendor_verifications (vendor_id, kind, subject, passed, detail, checked_by)
  values (p_vendor_id, p_kind, p_subject, p_passed, left(btrim(p_detail), 500), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- 0031's click, with "the advertiser's own clicks" meaning the whole team's.
create or replace function record_ad_click(p_campaign_id uuid)
returns text
language plpgsql security definer set search_path = public as $$
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

  if vendor_team_role(v.id) is null and campaign_live(c.id) then
    insert into ad_clicks (campaign_id, viewer_id, cost_pence)
    values (c.id, auth.uid(), c.bid_pence)
    on conflict (campaign_id, viewer_id, day) do nothing;
  end if;

  return v_url;
end;
$$;

--------------------------------------------------------------- enquiries

create table if not exists vendor_conversations (
  id          uuid primary key default gen_random_uuid(),
  vendor_id   uuid not null references vendors(id) on delete cascade,
  customer_id uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  last_at     timestamptz not null default now(),
  unique (vendor_id, customer_id)
);

create table if not exists vendor_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references vendor_conversations(id) on delete cascade,
  author_id       uuid not null references profiles(id) on delete cascade,
  -- Written by somebody on the team at the time, so it speaks for the business.
  from_business   boolean not null,
  body            text not null,
  created_at      timestamptz not null default clock_timestamp(),
  constraint vendor_messages_body_len check (length(btrim(body)) between 1 and 4000)
);

create index if not exists vendor_messages_convo_idx on vendor_messages (conversation_id, created_at desc);

create table if not exists vendor_conversation_marks (
  conversation_id uuid not null references vendor_conversations(id) on delete cascade,
  profile_id      uuid not null references profiles(id) on delete cascade,
  last_read_at    timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);

alter table vendor_conversations      enable row level security;
alter table vendor_messages           enable row level security;
alter table vendor_conversation_marks enable row level security;

create or replace function in_vendor_conversation(p_conversation_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select c.customer_id = auth.uid() or vendor_team_role(c.vendor_id) is not null
      from vendor_conversations c where c.id = p_conversation_id
  ), false);
$$;

drop policy if exists vendor_conversations_read on vendor_conversations;
create policy vendor_conversations_read on vendor_conversations for select using (
  customer_id = auth.uid() or vendor_team_role(vendor_id) is not null
);

drop policy if exists vendor_messages_read on vendor_messages;
create policy vendor_messages_read on vendor_messages for select using (
  in_vendor_conversation(conversation_id)
);

-- Read state is the reader's own (rule 23).
drop policy if exists vendor_conversation_marks_own on vendor_conversation_marks;
create policy vendor_conversation_marks_own on vendor_conversation_marks for select using (
  profile_id = auth.uid()
);

create or replace function open_vendor_conversation(p_vendor_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select id into v_id from vendor_conversations where vendor_id = p_vendor_id and customer_id = auth.uid();
  if v_id is not null then return v_id; end if;
  if not vendor_approved(p_vendor_id) then raise exception 'business not found'; end if;
  if vendor_team_role(p_vendor_id) is not null then
    raise exception 'you are on this business''s team: customers message it, you answer them';
  end if;
  insert into vendor_conversations (vendor_id, customer_id) values (p_vendor_id, auth.uid())
  on conflict (vendor_id, customer_id) do nothing;
  select id into v_id from vendor_conversations where vendor_id = p_vendor_id and customer_id = auth.uid();
  return v_id;
end;
$$;

create or replace function send_vendor_message(p_conversation_id uuid, p_body text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare c vendor_conversations; v_team boolean; v_id uuid;
begin
  select * into c from vendor_conversations where id = p_conversation_id for update;
  if not found or not in_vendor_conversation(p_conversation_id) then
    raise exception 'conversation not found';
  end if;
  v_team := vendor_team_role(c.vendor_id) is not null;
  -- A customer starts or carries on a conversation only while the business is
  -- approved, unless they have an order with it to talk about.
  if not v_team and not vendor_approved(c.vendor_id)
     and not exists (select 1 from vendor_orders o where o.vendor_id = c.vendor_id
                      and o.customer_id = auth.uid()
                      and o.status in ('requested', 'accepted', 'delivered', 'disputed')) then
    raise exception 'this business is not taking messages right now';
  end if;
  insert into vendor_messages (conversation_id, author_id, from_business, body)
  values (p_conversation_id, auth.uid(), v_team, btrim(p_body))
  returning id into v_id;
  update vendor_conversations set last_at = now() where id = p_conversation_id;
  insert into vendor_conversation_marks (conversation_id, profile_id, last_read_at)
  values (p_conversation_id, auth.uid(), now())
  on conflict (conversation_id, profile_id) do update set last_read_at = excluded.last_read_at;
  return v_id;
end;
$$;

create or replace function mark_vendor_conversation_read(p_conversation_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not in_vendor_conversation(p_conversation_id) then raise exception 'conversation not found'; end if;
  insert into vendor_conversation_marks (conversation_id, profile_id, last_read_at)
  values (p_conversation_id, auth.uid(), now())
  on conflict (conversation_id, profile_id) do update set last_read_at = excluded.last_read_at;
end;
$$;

-- Unread for the caller: on the team, what the customer said; as the
-- customer, what the business said.
create or replace function vendor_conversation_unread(p_conversation_id uuid)
returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int
    from vendor_messages m join vendor_conversations c on c.id = m.conversation_id
   where m.conversation_id = p_conversation_id
     and in_vendor_conversation(p_conversation_id)
     and m.from_business = (c.customer_id = auth.uid())
     and m.author_id <> auth.uid()
     and m.created_at > coalesce(
       (select last_read_at from vendor_conversation_marks k
         where k.conversation_id = p_conversation_id and k.profile_id = auth.uid()),
       '-infinity'::timestamptz);
$$;

create or replace function vendor_conversation_info(p_conversation_id uuid)
returns table (vendor_id uuid, vendor_name text, customer_id uuid, customer_name text, as_team boolean)
language sql stable security definer set search_path = public as $$
  select c.vendor_id, v.name, c.customer_id, p.display_name, vendor_team_role(c.vendor_id) is not null
    from vendor_conversations c
    join vendors v on v.id = c.vendor_id
    join profiles p on p.id = c.customer_id
   where c.id = p_conversation_id and in_vendor_conversation(p_conversation_id);
$$;

-- Newest last; the speaker is named, and a team member speaks as the business.
create or replace function vendor_messages_page(p_conversation_id uuid, p_limit integer default 200)
returns table (id uuid, author_id uuid, author_name text, from_business boolean, body text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select * from (
    select m.id, m.author_id, p.display_name, m.from_business, m.body, m.created_at
      from vendor_messages m join profiles p on p.id = m.author_id
     where m.conversation_id = p_conversation_id and in_vendor_conversation(p_conversation_id)
     order by m.created_at desc
     limit least(greatest(coalesce(p_limit, 200), 1), 500)
  ) x order by x.created_at;
$$;

-- The customer's side: every business they have written to.
create or replace function my_vendor_chats()
returns table (conversation_id uuid, vendor_id uuid, vendor_name text,
               last_body text, last_from_business boolean, last_at timestamptz, unread integer)
language sql stable security definer set search_path = public as $$
  select c.id, c.vendor_id, v.name, l.body, l.from_business, coalesce(l.created_at, c.created_at),
         vendor_conversation_unread(c.id)
    from vendor_conversations c
    join vendors v on v.id = c.vendor_id
    left join lateral (
      select m.body, m.from_business, m.created_at from vendor_messages m
       where m.conversation_id = c.id order by m.created_at desc limit 1
    ) l on true
   where c.customer_id = auth.uid()
   order by coalesce(l.created_at, c.created_at) desc;
$$;

------------------------------------------------------------------ orders

create table if not exists vendor_orders (
  id            uuid primary key default gen_random_uuid(),
  vendor_id     uuid not null references vendors(id) on delete cascade,
  offering_id   uuid references offerings(id) on delete set null,
  customer_id   uuid not null references profiles(id) on delete cascade,
  kind          offering_kind not null,
  -- What was asked for, as it was listed at the time.
  item_name     text not null,
  listed_price  text not null,
  quantity      int  not null default 1,
  request       text,
  wanted_at     timestamptz,
  status        order_status not null default 'requested',
  -- What the business agreed to when it accepted.
  agreed_price  text,
  scheduled_for timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  delivered_at  timestamptz,
  disputed_at   timestamptz,
  completed_at  timestamptz,
  closed_at     timestamptz,

  constraint vendor_orders_quantity    check (quantity between 1 and 999),
  constraint vendor_orders_request_len check (request is null or length(btrim(request)) between 1 and 1000),
  constraint vendor_orders_agreed      check (status in ('requested', 'declined')
                                              or (status = 'cancelled' and accepted_at is null)
                                              or (agreed_price is not null and length(btrim(agreed_price)) between 1 and 120))
);

create index if not exists vendor_orders_vendor_idx   on vendor_orders (vendor_id, status, created_at desc);
create index if not exists vendor_orders_customer_idx on vendor_orders (customer_id, created_at desc);

create table if not exists vendor_order_events (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references vendor_orders(id) on delete cascade,
  actor_id    uuid not null references profiles(id),
  from_status order_status,
  to_status   order_status not null,
  note        text,
  created_at  timestamptz not null default clock_timestamp(),
  constraint vendor_order_events_note_len check (note is null or length(btrim(note)) between 1 and 2000)
);

create index if not exists vendor_order_events_order_idx on vendor_order_events (order_id, created_at);

alter table vendor_orders       enable row level security;
alter table vendor_order_events enable row level security;

-- The customer, the business's team, and — once a problem has been
-- reported — the reviewers. No write policy: the functions below are the
-- only way an order moves.
create or replace function can_see_order(p_order_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select o.customer_id = auth.uid()
        or vendor_team_role(o.vendor_id) is not null
        or (o.disputed_at is not null and is_marketplace_reviewer())
      from vendor_orders o where o.id = p_order_id
  ), false);
$$;

drop policy if exists vendor_orders_read on vendor_orders;
create policy vendor_orders_read on vendor_orders for select using (
  customer_id = auth.uid()
  or vendor_team_role(vendor_id) is not null
  or (disputed_at is not null and is_marketplace_reviewer())
);

drop policy if exists vendor_order_events_read on vendor_order_events;
create policy vendor_order_events_read on vendor_order_events for select using (
  can_see_order(order_id)
);

-- The one place an order changes state. Internal: reached only from the
-- functions that check who may make each move.
create or replace function move_order(p_order_id uuid, p_to order_status, p_note text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_from order_status;
begin
  select status into v_from from vendor_orders where id = p_order_id;
  update vendor_orders set
    status       = p_to,
    updated_at   = now(),
    accepted_at  = case when p_to = 'accepted'  then now() else accepted_at end,
    delivered_at = case when p_to = 'delivered' then now() else delivered_at end,
    disputed_at  = case when p_to = 'disputed'  then now() else disputed_at end,
    completed_at = case when p_to = 'completed' then now() else completed_at end,
    closed_at    = case when p_to in ('completed', 'cancelled', 'declined') then now() else closed_at end
  where id = p_order_id;
  insert into vendor_order_events (order_id, actor_id, from_status, to_status, note)
  values (p_order_id, auth.uid(), v_from, p_to, nullif(btrim(coalesce(p_note, '')), ''));
end;
$$;

create or replace function order_note_required(p_note text, p_min int, p_what text)
returns text
language plpgsql immutable set search_path = public as $$
begin
  if length(btrim(coalesce(p_note, ''))) < p_min then
    raise exception '% in at least % characters', p_what, p_min;
  end if;
  return btrim(p_note);
end;
$$;

create or replace function place_order(
  p_offering_id uuid, p_quantity int default 1, p_request text default null, p_wanted_at timestamptz default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare o offerings; v_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into o from offerings where id = p_offering_id;
  if not found or not offering_listed(p_offering_id) then raise exception 'that is not listed right now'; end if;
  if vendor_team_role(o.vendor_id) is not null then
    raise exception 'you are on this business''s team: you cannot order from it';
  end if;
  if p_wanted_at is not null and p_wanted_at < now() then
    raise exception 'pick a time that has not passed';
  end if;
  if (select count(*) from vendor_orders where customer_id = auth.uid() and vendor_id = o.vendor_id
        and status = 'requested') >= 10 then
    raise exception 'you have ten requests waiting with this business: wait for an answer first';
  end if;
  insert into vendor_orders (vendor_id, offering_id, customer_id, kind, item_name, listed_price,
                             quantity, request, wanted_at)
  values (o.vendor_id, o.id, auth.uid(), o.kind, o.name, o.price,
          coalesce(p_quantity, 1), nullif(btrim(coalesce(p_request, '')), ''), p_wanted_at)
  returning id into v_id;
  insert into vendor_order_events (order_id, actor_id, from_status, to_status, note)
  values (v_id, auth.uid(), null, 'requested', nullif(btrim(coalesce(p_request, '')), ''));
  return v_id;
end;
$$;

create or replace function accept_order(
  p_order_id uuid, p_agreed_price text, p_scheduled_for timestamptz default null, p_note text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare o vendor_orders;
begin
  select * into o from vendor_orders where id = p_order_id for update;
  if not found or not vendor_can(o.vendor_id, 'staff') then raise exception 'order not found'; end if;
  if o.status <> 'requested' then raise exception 'this order has already been answered'; end if;
  if length(btrim(coalesce(p_agreed_price, ''))) not between 1 and 120 then
    raise exception 'say the price you are agreeing to';
  end if;
  if o.kind = 'service' and p_scheduled_for is null then
    raise exception 'a booking needs a time';
  end if;
  if p_scheduled_for is not null and p_scheduled_for < now() then
    raise exception 'pick a time that has not passed';
  end if;
  update vendor_orders set agreed_price = btrim(p_agreed_price), scheduled_for = p_scheduled_for
   where id = p_order_id;
  perform move_order(p_order_id, 'accepted', p_note);
end;
$$;

create or replace function decline_order(p_order_id uuid, p_note text)
returns void
language plpgsql security definer set search_path = public as $$
declare o vendor_orders; v_note text;
begin
  select * into o from vendor_orders where id = p_order_id for update;
  if not found or not vendor_can(o.vendor_id, 'staff') then raise exception 'order not found'; end if;
  if o.status <> 'requested' then raise exception 'this order has already been answered'; end if;
  v_note := order_note_required(p_note, 10, 'Say why');
  perform move_order(p_order_id, 'declined', v_note);
end;
$$;

-- The customer may withdraw a request freely; once it is accepted, either
-- side may cancel, in writing.
create or replace function cancel_order(p_order_id uuid, p_note text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare o vendor_orders; v_customer boolean; v_team boolean;
begin
  select * into o from vendor_orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  v_customer := o.customer_id = auth.uid();
  v_team := vendor_can(o.vendor_id, 'staff');
  if not (v_customer or v_team) then raise exception 'order not found'; end if;
  if o.status = 'requested' and v_customer then
    perform move_order(p_order_id, 'cancelled', p_note);
  elsif o.status = 'accepted' then
    perform move_order(p_order_id, 'cancelled', order_note_required(p_note, 10, 'Say why'));
  else
    raise exception 'this order cannot be cancelled now';
  end if;
end;
$$;

create or replace function deliver_order(p_order_id uuid, p_note text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare o vendor_orders;
begin
  select * into o from vendor_orders where id = p_order_id for update;
  if not found or not vendor_can(o.vendor_id, 'staff') then raise exception 'order not found'; end if;
  if o.status <> 'accepted' then raise exception 'only an accepted order can be marked done'; end if;
  perform move_order(p_order_id, 'delivered', p_note);
end;
$$;

-- The customer's approval is what completes an order.
create or replace function confirm_order(p_order_id uuid, p_note text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare o vendor_orders;
begin
  select * into o from vendor_orders where id = p_order_id for update;
  if not found or o.customer_id is distinct from auth.uid() then raise exception 'order not found'; end if;
  if o.status <> 'delivered' then raise exception 'the business has not marked this done yet'; end if;
  perform move_order(p_order_id, 'completed', p_note);
end;
$$;

create or replace function dispute_order(p_order_id uuid, p_note text)
returns void
language plpgsql security definer set search_path = public as $$
declare o vendor_orders; v_note text;
begin
  select * into o from vendor_orders where id = p_order_id for update;
  if not found or o.customer_id is distinct from auth.uid() then raise exception 'order not found'; end if;
  if o.status <> 'delivered' then raise exception 'a problem is reported once the business has marked it done'; end if;
  v_note := order_note_required(p_note, 20, 'Say what is wrong');
  perform move_order(p_order_id, 'disputed', v_note);
end;
$$;

create or replace function order_reply_days()
returns int language sql immutable set search_path = public as $$ select 14 $$;

-- A customer who never replies does not hold an order open for ever.
create or replace function complete_unanswered_order(p_order_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare o vendor_orders;
begin
  select * into o from vendor_orders where id = p_order_id for update;
  if not found or not vendor_can(o.vendor_id, 'staff') then raise exception 'order not found'; end if;
  if o.status <> 'delivered' or o.delivered_at > now() - make_interval(days => order_reply_days()) then
    raise exception 'the customer has % days from delivery to confirm or report a problem', order_reply_days();
  end if;
  perform move_order(p_order_id, 'completed',
    format('Completed after %s days without a reply from the customer.', order_reply_days()));
end;
$$;

create or replace function resolve_order_dispute(p_order_id uuid, p_outcome order_status, p_note text)
returns void
language plpgsql security definer set search_path = public as $$
declare o vendor_orders; v_note text;
begin
  if not is_marketplace_reviewer() then raise exception 'only a marketplace reviewer can settle a problem'; end if;
  select * into o from vendor_orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if vendor_team_role(o.vendor_id) is not null or o.customer_id = auth.uid() then
    raise exception 'nobody settles a problem they are part of';
  end if;
  if o.status <> 'disputed' then raise exception 'there is no open problem on this order'; end if;
  if p_outcome not in ('completed', 'cancelled') then raise exception 'settle it as completed or cancelled'; end if;
  v_note := order_note_required(p_note, 20, 'Say how it was settled');
  perform move_order(p_order_id, p_outcome, v_note);
end;
$$;

-- An order's record as both sides see it: every move, who made it, and why.
create or replace function order_timeline(p_order_id uuid)
returns table (to_status order_status, note text, actor_name text, side text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  -- Only a reviewer moves an order out of 'disputed'; they are named by role.
  select e.to_status, e.note,
         case when e.from_status = 'disputed' then 'A marketplace reviewer' else p.display_name end,
         case when e.actor_id = o.customer_id then 'customer'
              when e.from_status = 'disputed' then 'reviewer'
              else 'business' end,
         e.created_at
    from vendor_order_events e
    join vendor_orders o on o.id = e.order_id
    join profiles p on p.id = e.actor_id
   where e.order_id = p_order_id and can_see_order(p_order_id)
   order by e.created_at;
$$;

-- Each business's desk: what needs doing, for the people who do it.
create or replace function my_vendor_desks()
returns table (vendor_id uuid, vendor_name text, role text, to_answer integer, in_progress integer,
               problems integer, unread integer, last_at timestamptz)
language sql stable security definer set search_path = public as $$
  with mine as (
    select v.id, v.name from vendors v where v.owner_id = auth.uid()
    union
    select v.id, v.name from vendor_members m join vendors v on v.id = m.vendor_id
     where m.profile_id = auth.uid() and m.accepted_at is not null
  )
  select mi.id, mi.name, vendor_team_role(mi.id),
         (select count(*)::int from vendor_orders o where o.vendor_id = mi.id and o.status = 'requested'),
         (select count(*)::int from vendor_orders o where o.vendor_id = mi.id and o.status in ('accepted', 'delivered')),
         (select count(*)::int from vendor_orders o where o.vendor_id = mi.id and o.status = 'disputed'),
         (select coalesce(sum(vendor_conversation_unread(c.id)), 0)::int
            from vendor_conversations c where c.vendor_id = mi.id),
         greatest((select max(o.updated_at) from vendor_orders o where o.vendor_id = mi.id),
                  (select max(c.last_at) from vendor_conversations c where c.vendor_id = mi.id))
    from mine mi
   order by mi.name;
$$;

----------------------------------------------------------------- reviews

create table if not exists vendor_reviews (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null unique references vendor_orders(id) on delete cascade,
  vendor_id   uuid not null references vendors(id) on delete cascade,
  author_id   uuid not null references profiles(id) on delete cascade,
  rating      smallint not null,
  body        text not null,
  created_at  timestamptz not null default now(),
  reply       text,
  replied_by  uuid references profiles(id),
  replied_at  timestamptz,
  removed_by  uuid references profiles(id),
  removed_at  timestamptz,
  remove_note text,

  constraint vendor_reviews_rating   check (rating between 1 and 5),
  constraint vendor_reviews_body_len check (length(btrim(body)) between 20 and 2000),
  constraint vendor_reviews_reply_paired check (
    (reply is null and replied_by is null and replied_at is null)
    or (reply is not null and replied_by is not null and replied_at is not null
        and length(btrim(reply)) between 10 and 1000)
  ),
  constraint vendor_reviews_removal_paired check (
    (removed_at is null and removed_by is null and remove_note is null)
    or (removed_at is not null and removed_by is not null and remove_note is not null
        and length(btrim(remove_note)) between 10 and 1000)
  )
);

create index if not exists vendor_reviews_vendor_idx on vendor_reviews (vendor_id, created_at desc);

alter table vendor_reviews enable row level security;

drop policy if exists vendor_reviews_read on vendor_reviews;
create policy vendor_reviews_read on vendor_reviews for select using (
  author_id = auth.uid()
  or vendor_team_role(vendor_id) is not null
  or is_marketplace_reviewer()
  or (removed_at is null and auth.uid() is not null and vendor_approved(vendor_id))
);

create or replace function review_window_days()
returns int language sql immutable set search_path = public as $$ select 90 $$;

create or replace function write_review(p_order_id uuid, p_rating int, p_body text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare o vendor_orders; v_id uuid;
begin
  select * into o from vendor_orders where id = p_order_id for update;
  if not found or o.customer_id is distinct from auth.uid() then raise exception 'order not found'; end if;
  if o.status <> 'completed' then raise exception 'a review is written once the order is complete'; end if;
  if o.completed_at < now() - make_interval(days => review_window_days()) then
    raise exception 'reviews are written within % days of completion', review_window_days();
  end if;
  if exists (select 1 from vendor_reviews where order_id = p_order_id) then
    raise exception 'you have reviewed this order';
  end if;
  insert into vendor_reviews (order_id, vendor_id, author_id, rating, body)
  values (p_order_id, o.vendor_id, auth.uid(), p_rating, btrim(p_body))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function reply_to_review(p_review_id uuid, p_reply text)
returns void
language plpgsql security definer set search_path = public as $$
declare r vendor_reviews;
begin
  select * into r from vendor_reviews where id = p_review_id for update;
  if not found or not vendor_can(r.vendor_id, 'manager') then
    raise exception 'only the business''s owner or a manager can reply';
  end if;
  if r.reply is not null then raise exception 'this review has a reply'; end if;
  update vendor_reviews set reply = btrim(p_reply), replied_by = auth.uid(), replied_at = now()
   where id = p_review_id;
end;
$$;

create or replace function remove_review(p_review_id uuid, p_note text)
returns void
language plpgsql security definer set search_path = public as $$
declare r vendor_reviews;
begin
  if not is_marketplace_reviewer() then raise exception 'only a marketplace reviewer can remove a review'; end if;
  select * into r from vendor_reviews where id = p_review_id for update;
  if not found then raise exception 'review not found'; end if;
  if vendor_team_role(r.vendor_id) is not null or r.author_id = auth.uid() then
    raise exception 'nobody removes a review they are part of';
  end if;
  if r.removed_at is not null then raise exception 'already removed'; end if;
  update vendor_reviews set removed_by = auth.uid(), removed_at = now(), remove_note = btrim(p_note)
   where id = p_review_id;
end;
$$;

-- What anybody who can see the business sees: the review, its author's
-- name, and the business's reply.
create or replace function vendor_reviews_page(p_vendor_id uuid)
returns table (id uuid, rating smallint, body text, author_name text, item_name text,
               created_at timestamptz, reply text, replied_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, r.rating, r.body, p.display_name, o.item_name, r.created_at, r.reply, r.replied_at
    from vendor_reviews r
    join profiles p on p.id = r.author_id
    join vendor_orders o on o.id = r.order_id
   where r.vendor_id = p_vendor_id and r.removed_at is null
     and (vendor_approved(p_vendor_id) or vendor_team_role(p_vendor_id) is not null
          or is_marketplace_reviewer())
   order by r.created_at desc
   limit 200;
$$;

-- A count per star. No average is stored or returned here: the screen shows
-- the spread beside any mean it draws (rule 14's reasoning, for a business).
create or replace function vendor_review_summary(p_vendor_id uuid)
returns table (reviews integer, one integer, two integer, three integer, four integer, five integer)
language sql stable security definer set search_path = public as $$
  select count(*)::int,
         count(*) filter (where rating = 1)::int, count(*) filter (where rating = 2)::int,
         count(*) filter (where rating = 3)::int, count(*) filter (where rating = 4)::int,
         count(*) filter (where rating = 5)::int
    from vendor_reviews r
   where r.vendor_id = p_vendor_id and r.removed_at is null
     and (vendor_approved(p_vendor_id) or vendor_team_role(p_vendor_id) is not null
          or is_marketplace_reviewer());
$$;

------------------------------------------------------------------ grants

revoke all on function
  vendor_team_role(uuid), vendor_can(uuid, text),
  invite_vendor_member(uuid, text, vendor_role), accept_vendor_invite(uuid), leave_vendor(uuid),
  remove_vendor_member(uuid, uuid), set_vendor_member_role(uuid, uuid, vendor_role),
  vendor_team(uuid), my_vendor_invites(),
  in_vendor_conversation(uuid), open_vendor_conversation(uuid), send_vendor_message(uuid, text),
  mark_vendor_conversation_read(uuid), vendor_conversation_unread(uuid), vendor_conversation_info(uuid),
  vendor_messages_page(uuid, integer), my_vendor_chats(),
  can_see_order(uuid), place_order(uuid, int, text, timestamptz),
  accept_order(uuid, text, timestamptz, text), decline_order(uuid, text), cancel_order(uuid, text),
  deliver_order(uuid, text), confirm_order(uuid, text), dispute_order(uuid, text),
  order_reply_days(), complete_unanswered_order(uuid), resolve_order_dispute(uuid, order_status, text),
  my_vendor_desks(), order_timeline(uuid),
  review_window_days(), write_review(uuid, int, text), reply_to_review(uuid, text),
  remove_review(uuid, text), vendor_reviews_page(uuid), vendor_review_summary(uuid),
  add_offering(uuid, offering_kind, text, text, text, text), withdraw_offering(uuid),
  sign_off_vetting(uuid, vetting_decision, text),
  record_vendor_verification(uuid, text, text, boolean, text), record_ad_click(uuid)
from public, anon;

grant execute on function
  vendor_team_role(uuid), vendor_can(uuid, text),
  invite_vendor_member(uuid, text, vendor_role), accept_vendor_invite(uuid), leave_vendor(uuid),
  remove_vendor_member(uuid, uuid), set_vendor_member_role(uuid, uuid, vendor_role),
  vendor_team(uuid), my_vendor_invites(),
  in_vendor_conversation(uuid), open_vendor_conversation(uuid), send_vendor_message(uuid, text),
  mark_vendor_conversation_read(uuid), vendor_conversation_unread(uuid), vendor_conversation_info(uuid),
  vendor_messages_page(uuid, integer), my_vendor_chats(),
  can_see_order(uuid), place_order(uuid, int, text, timestamptz),
  accept_order(uuid, text, timestamptz, text), decline_order(uuid, text), cancel_order(uuid, text),
  deliver_order(uuid, text), confirm_order(uuid, text), dispute_order(uuid, text),
  order_reply_days(), complete_unanswered_order(uuid), resolve_order_dispute(uuid, order_status, text),
  my_vendor_desks(), order_timeline(uuid),
  review_window_days(), write_review(uuid, int, text), reply_to_review(uuid, text),
  remove_review(uuid, text), vendor_reviews_page(uuid), vendor_review_summary(uuid),
  add_offering(uuid, offering_kind, text, text, text, text), withdraw_offering(uuid),
  sign_off_vetting(uuid, vetting_decision, text),
  record_vendor_verification(uuid, text, text, boolean, text), record_ad_click(uuid)
to authenticated;

-- Internal (rule 54): reached only from the functions above.
revoke all on function move_order(uuid, order_status, text), order_note_required(text, int, text)
  from public, anon, authenticated;

-- No table here is written directly by anybody (rules 23, 36).
revoke insert, update, delete on vendor_members, vendor_conversations, vendor_messages,
  vendor_conversation_marks, vendor_orders, vendor_order_events, vendor_reviews
  from anon, authenticated;
revoke all on vendor_members, vendor_conversations, vendor_messages, vendor_conversation_marks,
  vendor_orders, vendor_order_events, vendor_reviews from anon;

--------------------------------------------------------------- the map (0045)

insert into private.data_map (table_name, column_name, export, erase, erase_where, ord, why) values
  ('vendor_members',            'profile_id',  true, 'delete', null, 60, 'you leave every business team'),
  ('vendor_members',            'invited_by',  true, 'keep',   null, 100, 'who built a business''s team'),
  ('vendor_conversation_marks', 'profile_id',  true, 'delete', null, 20, 'your read state'),
  ('vendor_messages',           'author_id',   true, 'delete', 'not from_business', 25,
     'what you wrote to a business; what you wrote for one stays with its customer'),
  ('vendor_conversations',      'customer_id', true, 'delete', null, 30, 'your conversations with businesses'),
  ('vendor_reviews',            'author_id',   true, 'delete', null, 20, 'your reviews'),
  ('vendor_reviews',            'replied_by',  true, 'keep',   null, 100, 'a business''s reply on its page'),
  ('vendor_reviews',            'removed_by',  true, 'keep',   null, 100, 'review record (rule 37)'),
  ('vendor_orders',             'customer_id', true, 'keep',   null, 100,
     'an order is a trading record the business has to keep'),
  ('vendor_order_events',       'actor_id',    true, 'keep',   null, 100, 'who moved an order, and why')
on conflict (table_name, column_name) do update set
  export = excluded.export, erase = excluded.erase, erase_where = excluded.erase_where,
  ord = excluded.ord, why = excluded.why;

comment on table vendor_orders is
  'Rule 55: an order moves only through its functions; the customer''s confirmation completes it. No approval, listing, ad fit or ad slot function may read it.';
comment on table vendor_reviews is
  'Rule 55: one review per completed order, written once; the business may reply once and never delete. No approval, listing, ad fit or ad slot function may read it.';
