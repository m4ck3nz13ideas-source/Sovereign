-- Activity is contribution, and it cannot be farmed (0032, rule 33).
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
  ('a7777777-7777-7777-7777-77777777777a', 'mint-author@example.com'),
  ('b7777777-7777-7777-7777-77777777777b', 'mint-closer@example.com');

set role app;

do $$
declare
  ann uuid := 'a7777777-7777-7777-7777-77777777777a';
  ben uuid := 'b7777777-7777-7777-7777-77777777777b';
  subj uuid := gen_random_uuid();
  pid uuid; gid uuid; code text;
  v_min numeric; v_before numeric; i int;
  passes int := 0; fails int := 0;
begin
  perform set_config('test.uid', ann::text, true);
  update profiles set place_local = 'Mint Street', place_national = 'United Kingdom',
                      place_set_at = now() where id = ann;

  ------------------------------------------- tier 1 mints, once per subject
  perform record_ledger_event(null, 'resonance.recorded', 'proposal', subj);
  select minted into v_min from my_sov();
  if v_min = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: resonating minted %, expected 1', v_min; end if;

  perform record_ledger_event(null, 'resonance.recorded', 'proposal', subj);
  select minted into v_min from my_sov();
  if v_min = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: re-resonating on the same proposal minted again (%)', v_min; end if;

  ------------------------------------------------ the daily cap: full, half, none
  -- One so far today. Four more at full rate makes five.
  for i in 1..4 loop
    perform record_ledger_event(null, 'resonance.recorded', 'proposal', gen_random_uuid());
  end loop;
  select minted into v_min from my_sov();
  if v_min = 5 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: first five tier-1 acts should mint 5, got %', v_min; end if;

  -- Ten more at half rate.
  for i in 1..10 loop
    perform record_ledger_event(null, 'projection.recorded', 'proposal', gen_random_uuid());
  end loop;
  select minted into v_min from my_sov();
  if v_min = 10 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: acts six to fifteen should mint half each (total 10), got %', v_min; end if;

  -- Then nothing.
  for i in 1..5 loop
    perform record_ledger_event(null, 'resonance.recorded', 'proposal', gen_random_uuid());
  end loop;
  select minted into v_min from my_sov();
  if v_min = 10 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: tier-1 acts past fifteen in a day still minted (total %)', v_min; end if;

  ---------------------------------------------- tier 2 is not capped
  v_before := v_min;
  for i in 1..20 loop
    perform record_ledger_event(null, 'debate.answered', 'proposal', gen_random_uuid());
  end loop;
  select minted into v_min from my_sov();
  if v_min = v_before + 60 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: answering twenty questions should mint 60, minted %', v_min - v_before; end if;

  ---------------------------------- a passed proposal pays its author, not its closer
  pid := test_propose(ann, null, 'local', 'Mint Street', 'A proposal that will pass', 'x',
                      'Something worth deciding about, for the mint test.');
  v_before := v_min;

  perform set_config('test.uid', ben::text, true);
  perform record_ledger_event(null, 'proposal.decided', 'proposal', pid,
                              jsonb_build_object('outcome', 'failed'));
  perform set_config('test.uid', ann::text, true);
  select minted into v_min from my_sov();
  if v_min = v_before then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a failed proposal minted for its author'; end if;

  perform set_config('test.uid', ben::text, true);
  perform record_ledger_event(null, 'proposal.decided', 'proposal', pid,
                              jsonb_build_object('outcome', 'passed'));
  select minted into v_min from my_sov();
  if v_min = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the closer was paid for somebody else''s proposal (%)', v_min; end if;

  perform set_config('test.uid', ann::text, true);
  select minted into v_min from my_sov();
  if v_min = v_before + 15 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the author was not paid for a passed proposal (+%)', v_min - v_before; end if;

  -- Closed again (a replay): no second payment.
  perform set_config('test.uid', ben::text, true);
  perform record_ledger_event(null, 'proposal.decided', 'proposal', pid,
                              jsonb_build_object('outcome', 'passed'));
  perform set_config('test.uid', ann::text, true);
  select minted into v_min from my_sov();
  if v_min = v_before + 15 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a proposal paid its author twice'; end if;

  ------------------------------------------------- following still mints nothing
  v_before := v_min;
  perform record_ledger_event(null, 'member.joined', 'group', gen_random_uuid());
  select minted into v_min from my_sov();
  if v_min = v_before then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: joining a group minted'; end if;

  raise notice ' ';
  raise notice '  Mint schedule: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;

reset role;
