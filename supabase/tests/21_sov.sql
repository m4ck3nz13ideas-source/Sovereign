-- SOV: minted by finished acts and nothing else, held privately, sent with a
-- reason, and buying no part of any decision.
\set ON_ERROR_STOP on
\pset pager off

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'app') then create role app login; end if;
end $$;

grant usage on schema public, auth to app;
grant select, insert, update, delete on all tables in schema public to app;
grant usage, select on all sequences in schema public to app;
grant execute on all functions in schema public to app;
grant execute on function auth.uid() to app;
grant select on auth.users to app;

insert into auth.users (id, email) values
  ('f3000001-0000-0000-0000-000000000000', 'sov1@example.com'),
  ('f3000002-0000-0000-0000-000000000000', 'sov2@example.com'),
  ('f3000003-0000-0000-0000-000000000000', 'sov3@example.com');

set role app;

-- -----------------------------------------------------------------------------
-- Proof of Alignment: what mints, and what does not
-- -----------------------------------------------------------------------------

do $$
declare
  lia uuid := 'f3000001-0000-0000-0000-000000000000';
  mo  uuid := 'f3000002-0000-0000-0000-000000000000';
  nia uuid := 'f3000003-0000-0000-0000-000000000000';
  v_bal numeric; v_min numeric; n int; v_prop uuid;
  passes int := 0; fails int := 0;
begin
  perform set_config('test.uid', lia::text, true);
  update profiles set place_local = 'Sov Street', place_national = 'United Kingdom',
                      place_set_at = now() where id = lia;
  perform set_config('test.uid', mo::text, true);
  update profiles set place_local = 'Sov Street', place_national = 'United Kingdom',
                      place_set_at = now() where id = mo;
  perform set_config('test.uid', nia::text, true);
  update profiles set place_local = 'Far Street', place_national = 'United Kingdom',
                      place_set_at = now() where id = nia;

  perform set_config('test.uid', lia::text, true);

  ------------------------------------------------------------ nothing to start
  select balance, minted into v_bal, v_min from my_sov();
  if v_bal = 0 and v_min = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a new person started with % held and % minted', v_bal, v_min; end if;

  ------------------------------------------------ answering a flag is service
  perform record_ledger_event(null, 'flag.answered', 'proposal', gen_random_uuid());
  select balance, minted into v_bal, v_min from my_sov();
  if v_bal = 15 and v_min = 15 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: answering a flag minted % (held %), expected 15', v_min, v_bal; end if;

  ------------------------------------------- marking a prediction is wisdom
  perform record_ledger_event(null, 'projection.resolved', 'proposal', gen_random_uuid());
  select balance, minted into v_bal, v_min from my_sov();
  if v_min = 25 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: marking a prediction left minted at %, expected 25', v_min; end if;

  ---------------------------------------------- finishing something is creation
  perform record_ledger_event(null, 'project.completed', 'project', gen_random_uuid());
  select balance, minted into v_bal, v_min from my_sov();
  if v_min = 125 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: completing a project left minted at %, expected 125', v_min; end if;

  ------------------------------------------------- and the amounts are the schedule
  select count(*)::int into n from sov_schedule();
  if n = 3 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the issuance schedule has % entries, expected 3', n; end if;

  select count(*)::int into n from sov_schedule() where kind = 'project.completed' and amount = 100;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the schedule the app shows is not the one that issued'; end if;

  ------------------------------------------------ submitting a proposal is not an act
  --
  -- It is the START of something. Minting for it would pay people to open
  -- proposals, which is the one behaviour this schedule must not buy.
  v_prop := test_propose(lia, null, 'local', 'Sov Street',
              'A bench by the postbox', 'One bench, bolted down.',
              'There is nowhere to sit on the hill.');
  select minted into v_min from my_sov();
  if v_min = 125 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: submitting a proposal minted something (now %)', v_min; end if;

  ------------------------------------------------------- nor is being followed
  perform set_config('test.uid', mo::text, true);
  perform follow_person(lia);
  perform set_config('test.uid', lia::text, true);
  select minted into v_min from my_sov();
  if v_min = 125 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: being followed minted something (now %)', v_min; end if;

  ---------------------------------------------- one act mints once, ever
  select count(*)::int into n from sov_entries
   where account_profile = lia and kind = 'mint';
  if n = 3 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % mint entries, expected 3', n; end if;

  ----------------------------------------------- nobody mints themselves anything
  begin
    insert into sov_entries (account_profile, amount, kind, reason, ledger_event_id)
    values (lia, 1000000, 'mint', 'Because I would like some.', gen_random_uuid());
    fails := fails + 1;
    raise warning 'FAIL: a member minted themselves a million';
  exception when others then passes := passes + 1;
  end;

  -- Not even an ordinary-looking transfer written by hand.
  begin
    insert into sov_entries (account_profile, amount, kind, reason)
    values (lia, 500, 'transfer', 'A transfer from nowhere, written directly.');
    fails := fails + 1;
    raise warning 'FAIL: a member wrote themselves an entry directly';
  exception when others then passes := passes + 1;
  end;

  ------------------------------------------------- and every issuance says what for
  select count(*)::int into n from my_sov_entries(50)
   where kind = 'mint' and reason like 'Proof of Alignment:%';
  if n = 3 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % mints named the act that earned them, expected 3', n; end if;

  raise notice ' ';
  raise notice '  SOV (Proof of Alignment): % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then
    raise exception '% checks failed', fails;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Holding, sending, backing
-- -----------------------------------------------------------------------------

do $$
declare
  lia uuid := 'f3000001-0000-0000-0000-000000000000';
  mo  uuid := 'f3000002-0000-0000-0000-000000000000';
  nia uuid := 'f3000003-0000-0000-0000-000000000000';
  v_bal numeric; v_min numeric; v_sent numeric; v_back numeric;
  n int; v_prop uuid; v_proj uuid; v_total numeric;
  passes int := 0; fails int := 0;
  why text := 'For the Saturday you spent on the wall when it was not your wall.';
begin
  perform set_config('test.uid', lia::text, true);

  select id into v_prop from proposals where author_id = lia and title = 'A bench by the postbox';
  insert into projects (proposal_id, title, status)
  values (v_prop, 'A bench by the postbox', 'planning')
  returning id into v_proj;

  ------------------------------------------------------------- a reason is required
  begin
    perform send_sov(mo, 10, 'thanks');
    fails := fails + 1;
    raise warning 'FAIL: SOV moved on a six-character reason';
  exception when others then passes := passes + 1;
  end;

  ------------------------------------------------------------------ and a recipient
  begin
    perform send_sov(lia, 10, why);
    fails := fails + 1;
    raise warning 'FAIL: somebody sent SOV to themselves';
  exception when others then passes := passes + 1;
  end;

  ------------------------------------------------------------------ and an amount
  begin
    perform send_sov(mo, 0, why);
    fails := fails + 1;
    raise warning 'FAIL: a zero transfer was accepted';
  exception when others then passes := passes + 1;
  end;

  begin
    perform send_sov(mo, -50, why);
    fails := fails + 1;
    raise warning 'FAIL: a negative transfer was accepted — that is a withdrawal from somebody else';
  exception when others then passes := passes + 1;
  end;

  ------------------------------------------------------- and you cannot send what you hold not
  begin
    perform send_sov(mo, 10000, why);
    fails := fails + 1;
    raise warning 'FAIL: somebody sent more than they held';
  exception when others then passes := passes + 1;
  end;

  ------------------------------------------------------------------------ and now
  perform send_sov(mo, 40, why);
  select balance, minted, sent into v_bal, v_min, v_sent from my_sov();
  if v_bal = 85 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: after sending 40 of 125 the balance is %', v_bal; end if;
  if v_sent = 40 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: sent reads %, expected 40', v_sent; end if;

  ------------------------------- and what somebody EARNED does not move when they spend
  --
  -- The whole reason there are two figures. Sending 40 does not un-answer a
  -- flag.
  if v_min = 125 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: sending changed what somebody had been issued (now %)', v_min; end if;

  ------------------------------------------------------------------- the other side
  perform set_config('test.uid', mo::text, true);
  select balance, minted into v_bal, v_min from my_sov();
  if v_bal = 40 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the recipient holds %, expected 40', v_bal; end if;

  -- Received is not earned. This is the line that stops a balance being a
  -- claim about the person holding it.
  if v_min = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: receiving a transfer counted as Proof of Alignment (minted %)', v_min; end if;

  ------------------------------------------------------ and the pair sums to nothing
  perform set_config('test.uid', lia::text, true);
  select sum(amount) into v_total from sov_entries where kind = 'transfer';
  -- Only one side is readable from here, so this is checked as superuser below.
  select count(*)::int into n from sov_entries
   where kind = 'transfer' and account_profile = lia;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % transfer entries on the sender, expected 1', n; end if;

  ---------------------------------------------------- nobody reads anybody else's
  select count(*)::int into n from sov_entries where account_profile = mo;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % of somebody else''s entries were readable', n; end if;

  ------------------------------------------------------------------- backing
  begin
    perform back_project(v_proj, 10000, why);
    fails := fails + 1;
    raise warning 'FAIL: somebody put behind a project more than they held';
  exception when others then passes := passes + 1;
  end;

  perform back_project(v_proj, 25, 'Toward the bolts and the concrete for the bench.');
  select balance, backing into v_bal, v_back from my_sov();
  if v_bal = 60 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: after backing 25 the balance is %, expected 60', v_bal; end if;
  if v_back = 25 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: backing reads %, expected 25', v_back; end if;

  select total into v_total from project_backing(v_proj) limit 1;
  if v_total = 25 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the project is carrying %, expected 25', v_total; end if;

  -- What somebody put behind a project is the group's business, unlike what
  -- they hold.
  perform set_config('test.uid', mo::text, true);
  select count(*)::int into n from project_backing(v_proj) where backer_id = lia;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: somebody on the same street could not see who backed the project'; end if;

  ------------------------------------------------- and another street cannot back it
  perform set_config('test.uid', nia::text, true);
  begin
    perform back_project(v_proj, 1, 'Trying to back something addressed to other people.');
    fails := fails + 1;
    raise warning 'FAIL: somebody backed a project not addressed to them';
  exception when others then passes := passes + 1;
  end;

  select count(*)::int into n from project_backing(v_proj);
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: another street read the project''s backing'; end if;

  raise notice ' ';
  raise notice '  SOV (holding, sending, backing): % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then
    raise exception '% checks failed', fails;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- The absences
--
-- This is most of the suite, because every one of these is what SOV turns into
-- if nobody is watching, and all of them are one migration away.
-- -----------------------------------------------------------------------------

do $$
declare
  n int; src text;
  passes int := 0; fails int := 0;
begin
  ------------------------------------------------- it buys no part of a decision
  select string_agg(prosrc, ' ') into src from pg_proc
   where proname in ('close_proposal', 'cast_resonance', 'can_reach_proposal',
                     'activate_proposal', 'alignment_shape', 'resonance_summary',
                     'bind_proposal_readiness', 'amendment_threshold');
  if src !~* '(sov_entries|sov_issuance|my_sov|sov_schedule|\mbalance\M|minted)' then
    passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a decision function reads SOV — the franchise is for sale'; end if;

  ------------------------------------------ and it does not decide who may act
  select prosrc into src from pg_proc where proname = 'can_reach_project';
  if src !~* 'sov' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: reaching a project depends on holding SOV'; end if;

  ------------------------------------------------------------- it is not a market
  select count(*)::int into n from information_schema.columns
   where table_name in ('sov_entries', 'sov_issuance')
     and column_name in ('price', 'rate', 'exchange_rate', 'value_gbp', 'gbp',
                         'usd', 'fee', 'bid', 'ask', 'market', 'order_id',
                         'listing', 'for_sale', 'yield', 'interest');
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: SOV grew % column(s) that make it a market', n; end if;

  select count(*)::int into n from pg_proc
   where proname ~* '(sov|token)'
     and proname ~* '(price|convert|exchange|sell|buy|trade|cash|withdraw|redeem)';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % function(s) turn SOV into money', n; end if;

  ------------------------------------------------------- and there is no league table
  --
  -- Not merely absent: impossible. There is no policy by which one person reads
  -- another's person-account, so nothing can be sorted.
  select count(*)::int into n from pg_policies
   where tablename = 'sov_entries' and cmd = 'SELECT'
     and qual not like '%auth.uid()%';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: somebody else''s holdings are readable'; end if;

  select count(*)::int into n from pg_proc
   where proname ~* '(sov|token|balance)'
     and proname ~* '(top|rank|leader|richest|holders|standings|league)';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % function(s) rank people by what they hold', n; end if;

  ------------------------------------------ neither reading function takes an id
  --
  -- Same reason `my_law_mirror()` does not (rule 26). A profile id here is one
  -- screen away from a tool for sorting people.
  select count(*)::int into n from pg_proc
   where proname in ('my_sov', 'my_sov_entries') and pronargs > 1;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a personal SOV function grew an argument'; end if;

  select count(*)::int into n from pg_proc p
    join pg_type t on t.oid = any (p.proargtypes)
   where p.proname = 'my_sov' and t.typname = 'uuid';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: my_sov() takes somebody''s id'; end if;

  -------------------------------------------------- append-only, and not by policy
  select count(*)::int into n from pg_policies
   where tablename = 'sov_entries' and cmd in ('UPDATE', 'DELETE', 'INSERT');
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: sov_entries has % write policies — every entry goes through a function or none do', n; end if;

  ------------------------------------------------- no balance column anywhere
  --
  -- A balance is a sum of entries. A stored one is a number somebody can set,
  -- and it would drift from the entries that are supposed to explain it.
  select count(*)::int into n from information_schema.columns
   where table_name in ('profiles', 'projects', 'groups')
     and column_name ~* '(sov|token|wallet|balance_minted)';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % stored SOV balance column(s) exist', n; end if;

  ------------------------------------------------ minting is a trigger, not a request
  select count(*)::int into n from pg_trigger
   where tgname = 'ledger_mints_sov' and not tgisinternal;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: nothing mints off the ledger — the schedule is decoration'; end if;

  -- And the one thing that guarantees an act pays once.
  select count(*)::int into n from pg_indexes
   where tablename = 'sov_entries' and indexname = 'sov_mint_once';
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the mint-once index is gone — a replayed event pays twice'; end if;

  ---------------------------------------- posting does not mint, and cannot later
  select count(*)::int into n from sov_issuance
   where kind in ('post.published', 'follow', 'post.kept', 'proposal.submitted',
                  'resonance.recorded', 'member.joined');
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the schedule pays for % act(s) that are not finished work', n; end if;

  raise notice ' ';
  raise notice '  SOV (absences): % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then
    raise exception '% checks failed', fails;
  end if;
end $$;

-- The two sides of a transfer sum to zero. Checked as the owner because no
-- member can read both accounts, which is the point of the policy.
reset role;

do $$
declare v_total numeric; passes int := 0; fails int := 0;
begin
  select coalesce(sum(amount), 0) into v_total from sov_entries where kind = 'transfer';
  if v_total = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the transfer entries sum to % rather than nothing — SOV was created or destroyed in a send', v_total; end if;

  select coalesce(sum(amount), 0) into v_total from sov_entries where kind = 'backing';
  if v_total = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the backing entries sum to %, so a project was funded out of nothing', v_total; end if;

  raise notice ' ';
  raise notice '  SOV (conservation): % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then
    raise exception '% checks failed', fails;
  end if;
end $$;
