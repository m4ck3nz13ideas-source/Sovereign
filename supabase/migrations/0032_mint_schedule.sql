-- 0032 — Activity is contribution: a tiered mint schedule (rule 33, extended).
--
-- 0026 minted for three finished acts and nothing else. Mackenzie's direction:
-- activity in Sovereign is contribution, and people should see their SOV grow
-- as they take part — with different rates for different acts so that it
-- cannot be farmed. This keeps everything that made 0026 sound and widens
-- what counts.
--
-- STILL TRUE
--   * Minting is a consequence of a ledger event, never a call a client makes.
--   * One mint per event per person (`sov_mint_once`).
--   * The schedule is a readable table, and SOV still buys nothing.
--
-- NEW
--   * TIERS. Tier 1 is participation (resonating, recording a prediction):
--     small, and capped per day. Tier 2 is substantive work (answering a
--     question or concern, answering a law tension or flag, an amendment of
--     yours being adopted, a prediction marked). Tier 3 is outcomes that other
--     people confirmed (your proposal passing, a project completed).
--   * THE DAILY CAP on tier 1: full rate for the first five, half rate up to
--     fifteen, nothing after that, per person per day. Participation is always
--     rewarded; grinding stops paying.
--   * ONCE PER SUBJECT for acts that can be repeated on the same thing:
--     re-casting resonance on a proposal you already resonated with does not
--     mint again.
--   * THE RIGHT RECIPIENT. A passed proposal mints to its author, not to
--     whoever pressed close. An adopted amendment mints to whoever wrote it,
--     and nothing if they adopted their own.
--
-- STILL NOTHING for following, being kept, joining, or opening the app —
-- those are not acts anybody else can see contributing. Posting and writing a
-- deliberation comment are not ledgered yet, so they cannot mint yet; adding
-- them means giving them a ledger event first, deliberately.

alter table sov_issuance add column if not exists tier int not null default 2;
alter table sov_issuance add column if not exists recipient text not null default 'actor';
alter table sov_issuance add column if not exists once_per_subject boolean not null default false;
alter table sov_issuance add column if not exists only_if_passed boolean not null default false;

do $$ begin
  alter table sov_issuance add constraint sov_issuance_tier check (tier between 1 and 3);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table sov_issuance add constraint sov_issuance_recipient
    check (recipient in ('actor', 'proposal_author', 'amendment_author'));
exception when duplicate_object then null; end $$;

-- The three from 0026 keep their amounts.
update sov_issuance set tier = 3 where kind = 'project.completed';
update sov_issuance set tier = 2 where kind in ('flag.answered', 'projection.resolved');

insert into sov_issuance (kind, amount, tier, recipient, once_per_subject, only_if_passed, rationale) values
  ('resonance.recorded', 1, 1, 'actor', true, false,
   'Reading a proposal and saying where you stand on it. Small, once per proposal, '
   'and capped per day: taking part is rewarded, grinding is not.'),
  ('projection.recorded', 1, 1, 'actor', true, false,
   'Putting a prediction on the record before anybody knows the answer.'),
  ('debate.answered', 3, 2, 'actor', false, false,
   'Answering somebody''s question or concern in writing, on the record.'),
  ('law.tension_answered', 5, 2, 'actor', false, false,
   'Answering a tension the Universal Law audit found, so the proposal can proceed honestly.'),
  ('debate.adopted', 5, 2, 'amendment_author', false, false,
   'An amendment you wrote was adopted into somebody else''s proposal.'),
  ('proposal.decided', 15, 3, 'proposal_author', true, true,
   'A proposal you wrote passed. Only the group can confirm this, which is why it is worth more.')
on conflict (kind) do update
  set amount = excluded.amount, tier = excluded.tier, recipient = excluded.recipient,
      once_per_subject = excluded.once_per_subject, only_if_passed = excluded.only_if_passed,
      rationale = excluded.rationale;

create or replace function mint_for_act()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
declare
  s        sov_issuance;
  v_to     uuid;
  v_amount numeric(16,4);
  v_today  int;
begin
  select * into s from sov_issuance where kind = new.kind;
  if not found then return new; end if;

  -- Who earned it.
  if s.recipient = 'actor' then
    v_to := new.actor_id;
  elsif s.recipient = 'proposal_author' then
    select author_id into v_to from proposals where id = new.subject_id;
  elsif s.recipient = 'amendment_author' then
    select author_id into v_to from deliberation_comments
     where id = nullif(new.payload->>'amendment', '')::uuid;
    if v_to is not distinct from new.actor_id then return new; end if;  -- adopting your own
  end if;
  if v_to is null then return new; end if;

  if s.only_if_passed and coalesce(new.payload->>'outcome', '') <> 'passed' then
    return new;
  end if;

  -- Once per person per thing, for acts that can be repeated on it.
  if s.once_per_subject and exists (
    select 1 from sov_entries e join ledger_events le on le.id = e.ledger_event_id
     where e.kind = 'mint' and e.account_profile = v_to
       and le.kind = new.kind and le.subject_id is not distinct from new.subject_id
  ) then
    return new;
  end if;

  v_amount := s.amount;

  -- Tier 1 is capped per person per day: full, then half, then nothing.
  if s.tier = 1 then
    select count(*) into v_today
      from sov_entries e
      join ledger_events le on le.id = e.ledger_event_id
      join sov_issuance si on si.kind = le.kind
     where e.kind = 'mint' and e.account_profile = v_to and si.tier = 1
       and e.created_at >= date_trunc('day', now());
    if v_today >= 15 then return new;
    elsif v_today >= 5 then v_amount := v_amount / 2;
    end if;
  end if;

  insert into sov_entries (account_profile, amount, kind, reason, ledger_event_id)
  values (v_to, v_amount, 'mint', 'Proof of Alignment: ' || new.kind, new.id)
  on conflict do nothing;

  return new;
end;
$$;

-- The schedule the app shows now says what tier each act is.
drop function if exists sov_schedule();
create or replace function sov_schedule()
returns table (kind text, amount numeric, tier int, rationale text)
language sql security definer stable set search_path = public, extensions as $$
  select kind, amount, tier, rationale from sov_issuance order by tier desc, amount desc;
$$;

grant execute on function sov_schedule() to authenticated;
