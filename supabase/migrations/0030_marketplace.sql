-- =============================================================================
-- 0030 — MARKETPLACE: trade, admitted the way everything else here is admitted
--
--   "a marketplace and advertising for Sovereign-approved products, businesses
--    and services, so the app is inclusive of trade"            Mackenzie
--
-- RECOVERED FROM THE LIVE DATABASE, 4 October 2026, like 0029: written and
-- applied to Supabase from another session and never committed. Reproduced
-- here object for object so the repository describes what is live, and
-- re-runnable so that applying it there changes nothing.
--
-- WHAT "SOVEREIGN-APPROVED" MEANS
--
-- The obvious build is an approvals queue: somebody with a role looks at a
-- listing and ticks it. That is a steward deciding on behalf of a group, which
-- is the thing this product exists to replace, and it is the first place it
-- would be captured — whoever holds the tick holds the market.
--
-- So nobody approves a listing. A group does, by the same loop it uses for
-- everything else. A listing is ATTACHED TO A PROPOSAL by that proposal's
-- author, before anybody has responded to it, and it is listed exactly when
-- the proposal passes: reviewed, audited against the ten laws, deliberated,
-- resonated with and closed under the group's own rule. "Approved" is a
-- decision on the ledger with a date, a voter count and a dispersion, not a
-- badge.
--
-- And it comes out the same way it went in. A REVOCATION is also attached to a
-- proposal, raised to the same people who admitted it — same group, same
-- scale, same place — and the listing comes down when that proposal passes. A
-- revocation that fails leaves the listing up, and both stay on the record.
-- The person offering can withdraw at any time, with a reason, and cannot
-- undo it.
--
-- WHAT A LISTING IS NOT
--
-- It is not an advert in the sense of something placed in front of people.
-- `marketplace()` returns what is listed for wherever the reader can reach,
-- ordered by scale (local first) and then by when it was decided. There is no
-- boost, promoted, sponsored, featured, rank, score, rating, review, click,
-- view or impression column, and nothing pays to move anything. No payment
-- happens here and no SOV is spent here — that was set aside on purpose — so
-- `terms` is the seller's own words about price and conditions, and `contact`
-- is how to reach them. Trade happens between people, off this app.
--
-- A listing is frozen once attached, because people resonated with THOSE
-- words: to change what is offered, offer a new proposal. The one thing that
-- may change is `contact`, which is the seller's phone number and not part of
-- what was decided.
-- =============================================================================

do $$ begin
  if not exists (select 1 from pg_type where typname = 'listing_kind') then
    create type listing_kind as enum ('product', 'service', 'business');
  end if;
end $$;

create table if not exists listings (
  id               uuid primary key default gen_random_uuid(),
  -- The proposal that admits it. One listing per proposal, and the proposal is
  -- the whole of its standing.
  proposal_id      uuid not null unique references proposals(id) on delete cascade,
  offered_by       uuid not null references profiles(id) on delete cascade,
  kind             listing_kind not null,
  name             text not null,
  description      text not null,
  -- Price and conditions, in the seller's words. Not a number: no currency,
  -- no conversion, no market.
  terms            text not null,
  contact          text,
  created_at       timestamptz not null default now(),
  withdrawn_at     timestamptz,
  withdrawn_reason text,

  constraint listings_name_len
    check (length(btrim(name)) >= 2 and length(btrim(name)) <= 120),
  constraint listings_description_len
    check (length(btrim(description)) >= 40 and length(btrim(description)) <= 2000),
  constraint listings_terms_len
    check (length(btrim(terms)) >= 10 and length(btrim(terms)) <= 600),
  constraint listings_contact_len
    check (contact is null or length(btrim(contact)) <= 280),
  constraint listings_withdrawal_paired check (
    (withdrawn_at is null and withdrawn_reason is null)
    or (withdrawn_at is not null and withdrawn_reason is not null
        and length(btrim(withdrawn_reason)) >= 20
        and length(btrim(withdrawn_reason)) <= 600)
  )
);

create index if not exists listings_offered_by_idx on listings (offered_by);

create table if not exists listing_revocations (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references listings(id) on delete cascade,
  -- The proposal that would take it down. Same group, scale and place as the
  -- one that put it up.
  proposal_id uuid not null unique references proposals(id) on delete cascade,
  raised_by   uuid not null references profiles(id) on delete cascade,
  reason      text not null,
  created_at  timestamptz not null default now(),

  constraint listing_revocations_reason_len
    check (length(btrim(reason)) >= 20 and length(btrim(reason)) <= 600)
);

create index if not exists listing_revocations_listing_idx
  on listing_revocations (listing_id);

-- Readable by whoever the admitting (or revoking) proposal is addressed to,
-- which is the one question rule 10 says eligibility is. No insert, update or
-- delete policy: every write goes through a function below.
alter table listings enable row level security;
alter table listing_revocations enable row level security;

drop policy if exists listings_read on listings;
create policy listings_read on listings for select
  using (can_reach_proposal(proposal_id));

drop policy if exists listing_revocations_read on listing_revocations;
create policy listing_revocations_read on listing_revocations for select
  using (can_reach_proposal(proposal_id));

grant select on listings, listing_revocations to authenticated;

-- -----------------------------------------------------------------------------
-- Frozen once attached
-- -----------------------------------------------------------------------------

create or replace function freeze_listing()
returns trigger language plpgsql as $$
begin
  if new.proposal_id is distinct from old.proposal_id
     or new.offered_by is distinct from old.offered_by
     or new.kind is distinct from old.kind
     or new.name is distinct from old.name
     or new.description is distinct from old.description
     or new.terms is distinct from old.terms
     or new.created_at is distinct from old.created_at then
    raise exception 'a listing is frozen once attached: offer a new proposal that supersedes this one to change it';
  end if;

  if old.withdrawn_at is not null
     and (new.withdrawn_at is distinct from old.withdrawn_at
          or new.withdrawn_reason is distinct from old.withdrawn_reason) then
    raise exception 'a withdrawal cannot be undone or reworded';
  end if;

  return new;
end;
$$;

create or replace trigger listings_freeze before update on listings
  for each row execute function freeze_listing();

create or replace function freeze_revocation()
returns trigger language plpgsql as $$
begin
  raise exception 'a revocation is a record and cannot be edited';
end;
$$;

create or replace trigger listing_revocations_freeze before update on listing_revocations
  for each row execute function freeze_revocation();

-- -----------------------------------------------------------------------------
-- Where a listing stands. Derived from the proposals, never stored: there is no
-- status column to set, so the only way to list something is for a group to
-- pass it.
-- -----------------------------------------------------------------------------

create or replace function listing_state(p_listing_id uuid)
returns text language sql stable as $$
  select case
    when l.withdrawn_at is not null then 'withdrawn'
    when exists (
      select 1
      from listing_revocations r
      join decisions rd on rd.proposal_id = r.proposal_id
      where r.listing_id = l.id and rd.outcome = 'passed'
    ) then 'revoked'
    when d.outcome = 'passed' then 'listed'
    when d.outcome = 'failed' or p.status = 'withdrawn' then 'declined'
    else 'pending'
  end
  from listings l
  join proposals p on p.id = l.proposal_id
  left join decisions d on d.proposal_id = l.proposal_id
  where l.id = p_listing_id;
$$;

-- What is listed, for wherever the reader can reach. Security INVOKER on
-- purpose: the listings policy and the decisions policy decide what comes
-- back, and this adds no reach of its own. Local first, then most recently
-- decided. No second ordering key that could become a rank.
create or replace function marketplace(p_kind listing_kind default null)
returns table (
  id          uuid,
  kind        listing_kind,
  name        text,
  description text,
  terms       text,
  contact     text,
  offered_by  uuid,
  proposal_id uuid,
  group_id    uuid,
  scope       group_scope,
  place       text,
  listed_at   timestamptz
)
language sql stable as $$
  select l.id, l.kind, l.name, l.description, l.terms, l.contact, l.offered_by,
         l.proposal_id, p.group_id, p.scope, p.place, d.decided_at
  from listings l
  join proposals p on p.id = l.proposal_id
  join decisions d on d.proposal_id = l.proposal_id
  where (p_kind is null or l.kind = p_kind)
    and listing_state(l.id) = 'listed'
  order by p.scope asc, d.decided_at desc;
$$;

-- -----------------------------------------------------------------------------
-- Attaching. Only to your own proposal, only before anybody has responded to
-- it, never to an amendment of Universal Law, and one thing per proposal.
-- -----------------------------------------------------------------------------

create or replace function lock_attachable_proposal(p_proposal_id uuid)
returns proposals language plpgsql security definer set search_path = public as $$
declare v_p proposals;
begin
  select * into v_p from proposals where id = p_proposal_id for update;
  if not found or not can_reach_proposal(p_proposal_id) then
    raise exception 'proposal not found';
  end if;
  if v_p.author_id is distinct from auth.uid() then
    raise exception 'only the author of a proposal can attach something to it';
  end if;
  if v_p.status not in ('in_review', 'in_deliberation') then
    raise exception 'too late to attach: people have already started responding to this proposal';
  end if;
  if exists (select 1 from resonance_votes where proposal_id = p_proposal_id) then
    raise exception 'too late to attach: people have already started responding to this proposal';
  end if;
  if v_p.amends_law is not null then
    raise exception 'an amendment to Universal Law cannot carry a listing';
  end if;
  if exists (select 1 from listings where proposal_id = p_proposal_id)
     or exists (select 1 from listing_revocations where proposal_id = p_proposal_id) then
    raise exception 'this proposal already carries a listing or a revocation';
  end if;
  return v_p;
end;
$$;

-- Your proposals that could still carry something. With a listing id, only the
-- ones addressed to the same people as that listing's — which is where a
-- revocation has to go.
create or replace function my_attachable_proposals(p_listing_id uuid default null)
returns table (id uuid, title text, status proposal_status, submitted_at timestamptz)
language sql stable as $$
  select p.id, p.title, p.status, p.submitted_at
  from proposals p
  left join listings l0 on l0.id = p_listing_id
  left join proposals a on a.id = l0.proposal_id
  where p.author_id = auth.uid()
    and p.status in ('in_review', 'in_deliberation')
    and p.amends_law is null
    and not exists (select 1 from resonance_votes v where v.proposal_id = p.id)
    and not exists (select 1 from listings x where x.proposal_id = p.id)
    and not exists (select 1 from listing_revocations x where x.proposal_id = p.id)
    and (p_listing_id is null
         or (p.group_id is not distinct from a.group_id
             and p.scope is not distinct from a.scope
             and p.place is not distinct from a.place))
  order by p.submitted_at desc;
$$;

create or replace function offer_listing(
  p_proposal_id uuid,
  p_kind        listing_kind,
  p_name        text,
  p_description text,
  p_terms       text,
  p_contact     text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_p  proposals;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  v_p := lock_attachable_proposal(p_proposal_id);

  insert into listings (proposal_id, offered_by, kind, name, description, terms, contact)
  values (p_proposal_id, auth.uid(), p_kind, btrim(p_name), btrim(p_description),
          btrim(p_terms), nullif(btrim(coalesce(p_contact, '')), ''))
  returning id into v_id;

  perform record_ledger_event(v_p.group_id, 'listing.offered', 'listing', v_id,
                              jsonb_build_object('proposal_id', p_proposal_id,
                                                 'kind', p_kind));
  return v_id;
end;
$$;

-- The seller's phone number is not what was decided.
create or replace function set_listing_contact(p_listing_id uuid, p_contact text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update listings
     set contact = nullif(btrim(coalesce(p_contact, '')), '')
   where id = p_listing_id and offered_by = auth.uid();
  if not found then raise exception 'only the person offering a listing can change its contact'; end if;
end;
$$;

create or replace function withdraw_listing(p_listing_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_l listings; v_group uuid;
begin
  select * into v_l from listings where id = p_listing_id for update;
  if not found or v_l.offered_by is distinct from auth.uid() then
    raise exception 'only the person offering a listing can withdraw it';
  end if;
  if v_l.withdrawn_at is not null then
    raise exception 'already withdrawn';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 20 then
    raise exception 'say why in at least twenty characters';
  end if;

  update listings
     set withdrawn_at = now(), withdrawn_reason = btrim(p_reason)
   where id = p_listing_id;

  select group_id into v_group from proposals where id = v_l.proposal_id;
  perform record_ledger_event(v_group, 'listing.withdrawn', 'listing', p_listing_id, '{}'::jsonb);
end;
$$;

create or replace function attach_revocation(p_listing_id uuid, p_proposal_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_p     proposals;
  v_admit proposals;
  v_id    uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  select p.* into v_admit
  from listings l join proposals p on p.id = l.proposal_id
  where l.id = p_listing_id;
  if not found or not can_reach_proposal(v_admit.id) then
    raise exception 'listing not found';
  end if;

  v_p := lock_attachable_proposal(p_proposal_id);

  if v_p.group_id is distinct from v_admit.group_id
     or v_p.scope is distinct from v_admit.scope
     or v_p.place is distinct from v_admit.place then
    raise exception 'a revocation goes to the same people who admitted the listing: same group, scale and place';
  end if;

  if listing_state(p_listing_id) <> 'listed' then
    raise exception 'only a listed listing can be revoked';
  end if;

  if length(btrim(coalesce(p_reason, ''))) < 20 then
    raise exception 'say why in at least twenty characters';
  end if;

  insert into listing_revocations (listing_id, proposal_id, raised_by, reason)
  values (p_listing_id, p_proposal_id, auth.uid(), btrim(p_reason))
  returning id into v_id;

  perform record_ledger_event(v_p.group_id, 'listing.revocation_proposed', 'listing',
                              p_listing_id, jsonb_build_object('proposal_id', p_proposal_id));
  return v_id;
end;
$$;

grant execute on function
  listing_state(uuid),
  marketplace(listing_kind),
  my_attachable_proposals(uuid),
  offer_listing(uuid, listing_kind, text, text, text, text),
  set_listing_contact(uuid, text),
  withdraw_listing(uuid, text),
  attach_revocation(uuid, uuid, text)
to authenticated;
