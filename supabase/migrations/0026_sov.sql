-- =============================================================================
-- 0026 — SOV: the coordination layer, simulated, and the two figures that
--        keep it from becoming a score
--
--   "SOV Token: value-aligned monetary, voting and reputation system
--    (non-speculative). SOV is minted through Proof of Alignment — earned by
--    verifiable contributions that preserve or enhance life. No speculative
--    mining; only service, wisdom and creation generate tokens."      Overview
--
-- This is a SIMULATION and every surface that shows it says so. There is no
-- chain, no wallet, no key, no counterparty outside this database and nothing
-- here is worth anything. What it is for is finding out whether the mechanism
-- is any good before it is expensive to change — the same reason the ledger is
-- a hash chain in Postgres rather than a contract (see src/lib/ledger).
--
-- THE PROBLEM WITH PUTTING A NUMBER ON A PERSON
--
-- Rule 19 says this product does not score people: `person_standing()` returns
-- counts of finished acts and no ratio anywhere, because "written 12, passed 3"
-- is a record and "25%" is a score. A token balance is a number on a person. It
-- is the single most score-shaped object anybody could add here, and the
-- Overview asks for it to carry civic weight.
--
-- The resolution is that there are two figures and they are not the same thing:
--
--   MINTED is what somebody has been issued for finished acts. It only goes up,
--   it cannot be sent or received, and it is the Proof of Alignment record —
--   the same kind of object as `person_standing`, a count of things actually
--   done.
--
--   BALANCE is what they hold now. It moves when they send or back something.
--   The moment SOV became transferable, a balance stopped proving anything
--   about the person holding it: it proves somebody gave them some.
--
-- Conflating those two is how a contribution record turns into a wealth ranking
-- and then into a franchise. They are separate functions here and no screen
-- puts them in the same column.
--
-- AND IT BUYS NOTHING
--
-- Not a vote, not a weighting, not a threshold, not reach, not priority. The
-- answer to "who may decide" is `can_reach_proposal()` and it always will be
-- (rule 10), the answer to "how much does their voice count" is that everyone's
-- counts the same, and `20_sov.sql` reads the source of every decision function
-- and fails if any of them so much as mentions this schema. Mackenzie was
-- offered reputation-weighted resonance as an option and did not take it; this
-- migration is written so that adding it later has to be a deliberate act
-- against a failing test rather than a quiet afternoon.
--
-- WHO CAN SEE WHAT
--
-- A person's balance and minting are theirs alone. There is no policy by which
-- anybody reads anybody else's, which is what makes a leaderboard impossible
-- rather than merely absent — you cannot rank what you cannot read.
--
-- What IS public is what somebody put behind a project, because that is a
-- commitment to a group and the group is entitled to know who is carrying it,
-- exactly as `commitments` are already visible to whoever can reach the
-- proposal (0005).
--
-- APPEND-ONLY, LIKE EVERYTHING THAT MATTERS HERE
--
-- `sov_entries` has no update policy, no delete policy and NO INSERT POLICY AT
-- ALL — the same treatment `ledger_events` gets. Every write goes through a
-- security definer function, so a client cannot mint itself anything, cannot
-- move somebody else's holding, and cannot backdate. A balance is derived by
-- summing the entries and is never a mutable column on `profiles`, so there is
-- nothing to set.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- The entries
--
-- One signed row per movement per account. An account is a person or a project,
-- never both, which `num_nonnulls` enforces rather than a convention.
-- -----------------------------------------------------------------------------

create table if not exists sov_entries (
  seq                  bigserial primary key,
  id                   uuid not null default gen_random_uuid(),

  account_profile      uuid references profiles on delete cascade,
  account_project      uuid references projects on delete cascade,

  -- Signed. Credits positive, debits negative, and the pair written by one
  -- transfer sums to zero.
  amount               numeric(16,4) not null check (amount <> 0),

  kind                 text not null check (kind in ('mint', 'transfer', 'backing')),
  reason               text not null check (length(btrim(reason)) between 3 and 280),

  counterparty_profile uuid references profiles on delete set null,
  counterparty_project uuid references projects on delete set null,

  -- For a mint: the act that earned it. Proof of Alignment is a pointer at
  -- something that actually happened, not a discretionary issuance.
  ledger_event_id      uuid,

  created_at           timestamptz not null default now(),

  constraint sov_one_account check (num_nonnulls(account_profile, account_project) = 1),
  -- A mint names the act. A transfer and a backing do not.
  constraint sov_mint_has_event check (
    (kind = 'mint' and ledger_event_id is not null and amount > 0
                   and account_profile is not null)
    or (kind <> 'mint' and ledger_event_id is null)
  )
);

create index if not exists sov_entries_profile_idx
  on sov_entries (account_profile, seq desc) where account_profile is not null;
create index if not exists sov_entries_project_idx
  on sov_entries (account_project, seq desc) where account_project is not null;

-- One mint per act per person. This is the whole anti-gaming story: the act is
-- a ledger event, a ledger event happens once, and the unique index means a
-- retry, a double trigger or a replay cannot issue twice.
create unique index if not exists sov_mint_once
  on sov_entries (ledger_event_id, account_profile) where kind = 'mint';

comment on table sov_entries is
  'Simulated. Append-only, no insert policy, every write through a security '
  'definer function. Balances are derived by summing these; there is no balance '
  'column anywhere and there must not be.';

alter table sov_entries enable row level security;

-- Yours, or a project you can reach. Nobody else's person-account, ever.
drop policy if exists sov_entries_read on sov_entries;
create policy sov_entries_read on sov_entries for select
  using (
    account_profile = auth.uid()
    or (account_project is not null and can_reach_project(account_project))
  );

-- No insert, update or delete policy. Deliberate, and asserted in 20_sov.sql.

grant select on sov_entries to authenticated;

-- -----------------------------------------------------------------------------
-- What an act is worth
--
-- A table rather than constants in a function, because a group being issued
-- something ought to be able to read the schedule that issued it — the same
-- reason the prompts are readable at /settings/prompts and the decision rule is
-- on Home.
--
-- Three acts, and what they have in common is that they are all FINISHED and
-- all verifiable from the ledger. Nothing mints for posting, following, being
-- kept, turning up, or holding an opinion. "Only service, wisdom and creation."
-- -----------------------------------------------------------------------------

create table if not exists sov_issuance (
  kind       text primary key,
  amount     numeric(16,4) not null check (amount > 0),
  rationale  text not null
);

comment on table sov_issuance is
  'The Proof of Alignment schedule: which finished acts mint, and how much. '
  'Readable by everyone, because being scored by a schedule you cannot read is '
  'the thing this product exists against.';

alter table sov_issuance enable row level security;

drop policy if exists sov_issuance_read on sov_issuance;
create policy sov_issuance_read on sov_issuance for select using (true);

grant select on sov_issuance to authenticated;

insert into sov_issuance (kind, amount, rationale) values
  ('project.completed', 100,
   'A project delivered and reflected on. The largest issuance because it is the '
   'only one that required somebody to carry something to the end and then say '
   'honestly how it went.'),
  ('flag.answered', 15,
   'A critical flag answered on the record. Service: the proposal could not '
   'proceed until somebody did the work of answering it in writing.'),
  ('projection.resolved', 10,
   'A prediction marked against what actually happened. Wisdom, and the least '
   'rewarded act in any system that does not do this — coming back to find out '
   'whether you were right.')
on conflict (kind) do nothing;

-- -----------------------------------------------------------------------------
-- Minting
--
-- Off the ledger, by trigger, so that issuance is a consequence of an act
-- rather than a claim somebody makes about one. There is no `mint()` a client
-- can call and there must not be: the schedule decides, the ledger is the
-- evidence, and the unique index means it happens once.
-- -----------------------------------------------------------------------------

create or replace function mint_for_act()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_amount numeric(16,4);
  v_actor  uuid;
begin
  if new.actor_id is null then return new; end if;

  select amount into v_amount from sov_issuance where kind = new.kind;
  if not found then return new; end if;

  v_actor := new.actor_id;

  insert into sov_entries (account_profile, amount, kind, reason, ledger_event_id)
  values (v_actor, v_amount, 'mint',
          'Proof of Alignment: ' || new.kind, new.id)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists ledger_mints_sov on ledger_events;
create trigger ledger_mints_sov after insert on ledger_events
  for each row execute function mint_for_act();

-- -----------------------------------------------------------------------------
-- What somebody holds, and what they have earned
--
-- Two functions because they are two facts. Neither takes an argument, for the
-- reason `my_law_mirror()` does not (rule 26): a function with a profile id is
-- one screen away from being a tool for sorting people, and somebody would
-- eventually write that screen.
-- -----------------------------------------------------------------------------

drop function if exists my_sov();
create or replace function my_sov()
returns table (
  balance   numeric,
  minted    numeric,
  sent      numeric,
  received  numeric,
  backing   numeric
)
language sql security definer stable set search_path = public, extensions as $$
  select
    coalesce(sum(amount), 0),
    coalesce(sum(amount) filter (where kind = 'mint'), 0),
    coalesce(-sum(amount) filter (where kind = 'transfer' and amount < 0), 0),
    coalesce(sum(amount) filter (where kind = 'transfer' and amount > 0), 0),
    coalesce(-sum(amount) filter (where kind = 'backing' and amount < 0), 0)
  from sov_entries
  where account_profile = auth.uid();
$$;

grant execute on function my_sov() to authenticated;

-- Your own entries, most recent first. Somebody who is issued something is
-- entitled to see exactly what for.
drop function if exists my_sov_entries(integer);
create or replace function my_sov_entries(p_limit integer default 50)
returns table (
  id            uuid,
  amount        numeric,
  kind          text,
  reason        text,
  other_name    text,
  project_title text,
  happened_at   timestamptz
)
language sql security definer stable set search_path = public, extensions as $$
  select e.id, e.amount, e.kind, e.reason, pr.display_name, prj.title, e.created_at
    from sov_entries e
    left join profiles pr on pr.id = e.counterparty_profile
    left join projects prj on prj.id = e.counterparty_project
   where e.account_profile = auth.uid()
   order by e.seq desc
   limit greatest(p_limit, 1);
$$;

grant execute on function my_sov_entries(integer) to authenticated;

-- -----------------------------------------------------------------------------
-- Sending
--
-- Attributed, reasoned, and refused when the balance is not there. A reason of
-- twenty characters for the same purpose `resolve_flag()` and
-- `stand_down_proposal()` ask for one: a movement of something the group treats
-- as earned should say what it was for, on both sides of the entry.
--
-- There is no overdraft and no negative balance. `minted` is not spendable on
-- its own — it is a historical total, and the check is against the balance.
-- -----------------------------------------------------------------------------

create or replace function send_sov(p_to uuid, p_amount numeric, p_reason text)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare v_balance numeric; v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'not signed in'; end if;
  if p_to = v_me then raise exception 'you already have it'; end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'an amount to send has to be more than nothing';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 20 then
    raise exception 'say what it is for — twenty characters at least, on the record for both of you';
  end if;
  if not exists (select 1 from profiles where id = p_to) then
    raise exception 'no such person';
  end if;

  select coalesce(sum(amount), 0) into v_balance
    from sov_entries where account_profile = v_me;

  if v_balance < p_amount then
    raise exception 'you hold % and this would send %', v_balance, p_amount;
  end if;

  insert into sov_entries (account_profile, amount, kind, reason, counterparty_profile)
  values (v_me, -p_amount, 'transfer', btrim(p_reason), p_to),
         (p_to,  p_amount, 'transfer', btrim(p_reason), v_me);
end;
$$;

grant execute on function send_sov(uuid, numeric, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Backing a project
--
-- A project holds a balance of its own, and what somebody put behind it is
-- visible to whoever can reach it. This does NOT duplicate `commitments`
-- (0005): a commitment is a pledge against a stated need, in whatever unit the
-- need is stated in, and it is what activation counts. Backing is separate and
-- deliberately does not touch activation — a project cannot be started by
-- somebody buying it, and `activate_proposal()` does not read this table.
-- -----------------------------------------------------------------------------

create or replace function back_project(p_project_id uuid, p_amount numeric, p_reason text)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare v_balance numeric; v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'not signed in'; end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'an amount to put behind something has to be more than nothing';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 20 then
    raise exception 'say what it is for — twenty characters at least';
  end if;
  if not coalesce(can_reach_project(p_project_id), false) then
    raise exception 'that project is not addressed to you';
  end if;

  select coalesce(sum(amount), 0) into v_balance
    from sov_entries where account_profile = v_me;

  if v_balance < p_amount then
    raise exception 'you hold % and this would put % behind it', v_balance, p_amount;
  end if;

  insert into sov_entries (account_profile, amount, kind, reason, counterparty_project)
  values (v_me, -p_amount, 'backing', btrim(p_reason), p_project_id);

  insert into sov_entries (account_project, amount, kind, reason, counterparty_profile)
  values (p_project_id, p_amount, 'backing', btrim(p_reason), v_me);
end;
$$;

grant execute on function back_project(uuid, numeric, text) to authenticated;

-- What a project is carrying, and who put it there. Visible to whoever can
-- reach the project, because a commitment to a group is the group's business.
drop function if exists project_backing(uuid);
create or replace function project_backing(p_project_id uuid)
returns table (
  total       numeric,
  backers     integer,
  backer_id   uuid,
  backer_name text,
  amount      numeric,
  reason      text,
  backed_at   timestamptz
)
language sql security definer stable set search_path = public, extensions as $$
  select
    (select coalesce(sum(amount), 0) from sov_entries
      where account_project = p_project_id),
    (select count(distinct counterparty_profile)::int from sov_entries
      where account_project = p_project_id and kind = 'backing'),
    e.counterparty_profile, pr.display_name, e.amount, e.reason, e.created_at
  from sov_entries e
  join profiles pr on pr.id = e.counterparty_profile
  where e.account_project = p_project_id
    and e.kind = 'backing'
    and coalesce(can_reach_project(p_project_id), false)
  order by e.seq desc;
$$;

grant execute on function project_backing(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- The schedule, readable
-- -----------------------------------------------------------------------------

drop function if exists sov_schedule();
create or replace function sov_schedule()
returns table (kind text, amount numeric, rationale text)
language sql security definer stable set search_path = public, extensions as $$
  select kind, amount, rationale from sov_issuance order by amount desc;
$$;

grant execute on function sov_schedule() to authenticated;
