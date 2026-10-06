-- 0038 — Proving a business is real (rule 37, extended).
--
-- The vetting reads what a business says about itself. This adds two checks
-- of whether it IS what it says, made by a reviewer rather than claimed by the
-- business:
--
--   * WEBSITE. Every business gets a token. It proves it controls the domain
--     on its website by publishing that token — a DNS TXT record
--     `sovereign-verify=<token>`, or a file at
--     https://<domain>/.well-known/sovereign-verify.txt. A reviewer runs the
--     check from the review queue; the server looks and records what it found.
--     REQUIRED before approval: a business that cannot show it owns its own
--     website has not shown it is the business it describes.
--
--   * COMPANY. A UK business can give its Companies House number. A reviewer
--     runs the lookup and the registered name and status are recorded.
--     Shown on the business's page; not required, because sole traders,
--     co-operatives and businesses outside the UK are welcome too.
--
-- Verifications are written only by reviewers (never the business itself, so
-- it cannot vouch for itself), never for their own business, and they are
-- tied to the exact domain or number checked: change the website and the
-- website check no longer counts.

alter table vendors add column if not exists company_number text;
alter table vendors add column if not exists verify_token text not null
  default substr(md5(random()::text || clock_timestamp()::text), 1, 24);

do $$ begin
  alter table vendors add constraint vendors_company_number_format
    check (company_number is null or company_number ~ '^[A-Z0-9]{8}$');
exception when duplicate_object then null; end $$;

create table if not exists vendor_verifications (
  id         uuid primary key default gen_random_uuid(),
  vendor_id  uuid not null references vendors(id) on delete cascade,
  kind       text not null check (kind in ('domain', 'companies_house')),
  subject    text not null,
  passed     boolean not null,
  detail     text not null,
  checked_by uuid not null references profiles(id),
  checked_at timestamptz not null default clock_timestamp()
);

create index if not exists vendor_verifications_vendor_idx
  on vendor_verifications (vendor_id, kind, checked_at desc);

alter table vendor_verifications enable row level security;

-- The business and reviewers can read the checks; the public sees the badges.
drop policy if exists vendor_verifications_read on vendor_verifications;
create policy vendor_verifications_read on vendor_verifications for select using (
  is_marketplace_reviewer()
  or exists (select 1 from vendors v where v.id = vendor_id and v.owner_id = auth.uid())
);

-- The host part of a website, lower-cased, without www.
create or replace function website_host(p_url text)
returns text
language sql
immutable
as $$
  select regexp_replace(lower(substring(p_url from '^https://([^/:?#]+)')), '^www\.', '');
$$;

create or replace function vendor_domain_verified(p_vendor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select vv.passed
      from vendor_verifications vv join vendors v on v.id = vv.vendor_id
     where vv.vendor_id = p_vendor_id and vv.kind = 'domain'
       and vv.subject = website_host(v.website)
     order by vv.checked_at desc limit 1
  ), false);
$$;

create or replace function vendor_company(p_vendor_id uuid)
returns table (verified boolean, detail text)
language sql
stable
security definer
set search_path = public
as $$
  select vv.passed, vv.detail
    from vendor_verifications vv join vendors v on v.id = vv.vendor_id
   where vv.vendor_id = p_vendor_id and vv.kind = 'companies_house'
     and vv.subject = v.company_number
   order by vv.checked_at desc limit 1;
$$;

create or replace function record_vendor_verification(
  p_vendor_id uuid, p_kind text, p_subject text, p_passed boolean, p_detail text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v vendors; v_id uuid;
begin
  if not is_marketplace_reviewer() then raise exception 'only a marketplace reviewer can record a check'; end if;
  select * into v from vendors where id = p_vendor_id;
  if not found then raise exception 'business not found'; end if;
  if v.owner_id = auth.uid() then raise exception 'nobody checks their own business'; end if;
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

-- Approval now also needs a verified website. Same function as 0031 with one
-- more refusal; nothing here reads the money side.
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
  if p_decision = 'approved' and not vendor_domain_verified(v.id) then
    raise exception 'check the website first: a business has to show it owns its own website before it is approved';
  end if;

  update vendor_vettings
     set decision = p_decision, signed_by = auth.uid(), signed_at = now(), sign_note = btrim(p_note)
   where id = p_vetting_id;
end;
$$;

-- The business can set its company number (it is not part of what the AI
-- reads, so it does not lapse approval; the check is tied to the number).
create or replace function set_company_number(p_vendor_id uuid, p_number text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update vendors set company_number = nullif(upper(btrim(coalesce(p_number, ''))), '')
   where id = p_vendor_id and owner_id = auth.uid();
  if not found then raise exception 'only the business can set its own company number'; end if;
end;
$$;

grant execute on function vendor_domain_verified(uuid), vendor_company(uuid),
  record_vendor_verification(uuid, text, text, boolean, text), set_company_number(uuid, text),
  website_host(text)
  to authenticated;
