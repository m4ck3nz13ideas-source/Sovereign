-- =============================================================================
-- 0018 — ACCESSION: agreeing to the Universal Laws, and to which wording
--
--   "Moral law precedes legal code and forms the guiding constitution of all
--    human creation."        §Universal Laws
--   "Sovereign is not a product you buy. It's a system you choose to
--    participate in."        §The Invitation
--
-- Onboarding shows a person the ten laws and asks them to agree. Until now
-- that agreement had nowhere to go, which made it theatre: a checkbox with no
-- record behind it is a dark pattern wearing a constitution's clothes.
--
-- WHY A REVISION AND NOT A BOOLEAN
--
-- Migration 0015 made the WORDING of a law amendable. A boolean "agreed to the
-- laws" would therefore mean nothing a year from now — it would claim consent
-- to whatever the text has since become, which is the precise move a
-- constitution exists to prevent. So an acceptance names the law AND the
-- revision of it that was on the screen, and an amendment leaves every prior
-- acceptance standing as a true record of what that person actually read.
--
-- The revision is stamped HERE, not passed in. The caller says which laws it
-- displayed; the database decides what the current wording of each one was.
-- Otherwise a client could record agreement to an older, weaker revision.
--
-- WHY THERE IS NO WAY TO WITHDRAW ONE
--
-- No update policy and no delete policy. Not because somebody is bound
-- forever — they can stop using the thing, and nothing here compels anyone —
-- but because "I read this and agreed on this date" is either true or it is
-- not, and a record you can quietly revise is not a record. Disagreeing with
-- a law is what the amendment protocol is for: rule 24, and the bar is every
-- single voice.
--
-- WHAT THIS DELIBERATELY DOES NOT DO
--
-- It does not gate anything. Accession is not a permission system: nobody is
-- locked out of reading, writing or objecting for not having agreed, and
-- can_reach_proposal() is untouched. What it produces is a record and, after
-- an amendment, an honest list of what has changed since you last read it.
-- =============================================================================

create table if not exists law_acceptances (
  profile_id  uuid    not null references profiles on delete cascade,
  law_id      text    not null,
  revision    integer not null,
  accepted_at timestamptz not null default now(),
  primary key (profile_id, law_id, revision)
);

comment on table law_acceptances is
  'One row per person per law per revision of its wording. Append-only: there '
  'is no policy permitting an update or a delete, because an agreement that '
  'can be edited afterwards is not an agreement.';

alter table law_acceptances enable row level security;

-- Yours, and nobody else's. Who has agreed to the constitution is not a
-- leaderboard, and a public list of who has not would be exactly that.
drop policy if exists law_acceptances_read on law_acceptances;
create policy law_acceptances_read on law_acceptances for select
  using (profile_id = auth.uid());

drop policy if exists law_acceptances_accede on law_acceptances;
create policy law_acceptances_accede on law_acceptances for insert
  with check (profile_id = auth.uid());

-- No update policy. No delete policy. See the header.

-- -----------------------------------------------------------------------------
-- Agreeing
--
-- Takes the law ids the screen actually displayed. Requires ten of them,
-- because the constitution is ten — rule 24 permits an amendment to the
-- wording of an existing law and permits no repeal, no merge and no eleventh,
-- so any other number means the caller is not showing the constitution.
--
-- The database cannot check the ids themselves: the ten live in
-- src/lib/universal-law.ts, deliberately, because a table of them would imply
-- somebody could edit one. So it checks the count, stamps the revision, and
-- records what it was told. That is the honest limit of what it knows.
-- -----------------------------------------------------------------------------

create or replace function accept_universal_law(p_law_ids text[])
returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_ids text[];
  v_written integer;
begin
  if auth.uid() is null then
    raise exception 'only a signed-in person can agree to anything';
  end if;

  select array_agg(distinct x) into v_ids from unnest(p_law_ids) as x;

  if v_ids is null or array_length(v_ids, 1) <> 10 then
    raise exception 'the constitution is ten laws and this call named % — a partial constitution is not one',
      coalesce(array_length(v_ids, 1), 0);
  end if;

  insert into law_acceptances (profile_id, law_id, revision)
  select auth.uid(), x, law_current_revision(x)
    from unnest(v_ids) as x
  on conflict (profile_id, law_id, revision) do nothing;

  get diagnostics v_written = row_count;
  return v_written;
end;
$$;

grant execute on function accept_universal_law(text[]) to authenticated;

-- -----------------------------------------------------------------------------
-- What you have agreed to, and what has moved since
-- -----------------------------------------------------------------------------

drop function if exists my_law_accession();
create or replace function my_law_accession()
returns table (
  law_id            text,
  accepted_revision integer,
  current_revision  integer,
  accepted_at       timestamptz,
  -- True when the law has been amended since you last read it. Not a
  -- reprimand and not a gate: a thing worth knowing.
  amended_since     boolean
)
language sql security definer stable set search_path = public, extensions as $$
  with mine as (
    select a.law_id, max(a.revision) as accepted_revision
      from law_acceptances a
     where a.profile_id = auth.uid()
     group by a.law_id
  )
  select
    m.law_id,
    m.accepted_revision,
    law_current_revision(m.law_id),
    (select max(a.accepted_at) from law_acceptances a
      where a.profile_id = auth.uid()
        and a.law_id = m.law_id
        and a.revision = m.accepted_revision),
    law_current_revision(m.law_id) > m.accepted_revision
  from mine m
  order by m.law_id;
$$;

grant execute on function my_law_accession() to authenticated;

drop function if exists accession_standing();
create or replace function accession_standing()
returns table (
  laws_agreed    integer,
  amended_since  integer,
  first_agreed_at timestamptz
)
language sql security definer stable set search_path = public, extensions as $$
  select
    (select count(*)::int from my_law_accession()),
    (select count(*)::int from my_law_accession() where amended_since),
    (select min(accepted_at) from law_acceptances where profile_id = auth.uid());
$$;

grant execute on function accession_standing() to authenticated;
