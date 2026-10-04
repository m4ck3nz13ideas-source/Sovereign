-- Marketplace: a listing is admitted by a proposal passing, comes down by a
-- proposal passing, and is never ranked, bought or approved by a person.
--
-- The risk is the ordinary kind of marketplace growing back in: a status
-- somebody can set, a write path that skips the vote, a revocation that can be
-- shopped to a friendlier audience, or a column that sorts sellers.
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
  ('3a000001-0000-0000-0000-000000000000', 'mkt1@example.com'),
  ('3a000002-0000-0000-0000-000000000000', 'mkt2@example.com'),
  ('3a000003-0000-0000-0000-000000000000', 'mkt3@example.com');

-- Takes a submitted group proposal through review, audit, deliberation and two
-- votes to a close, the way 03_activation.sql does by hand. Security invoker:
-- every step runs as whoever test.uid says, under the real policies.
create or replace function test_mkt_pass(p_pid uuid, p_voters uuid[], p_level numeric, p_closer uuid)
returns decision_outcome language plpgsql as $$
declare
  rid uuid; l text; v uuid; outcome decision_outcome;
  all_laws text[] := array[
    'sanctity_of_life','truth_and_transparency','sovereignty_of_the_individual',
    'equity_and_justice','subsidiarity','reciprocity_and_mutual_care',
    'stewardship_of_earth','harmony_of_diversity','right_use_of_power',
    'continuous_evolution'];
begin
  perform set_config('test.uid', p_voters[1]::text, true);
  insert into proposal_reviews (proposal_id, prompt_id, prompt_version, model, summary)
  values (p_pid, 'proposal.review', '1.2.0', 'test', 'A reading.') returning id into rid;
  foreach l in array all_laws loop
    insert into law_assessments (proposal_id, review_id, law_id, verdict, reasoning,
                                 prompt_id, prompt_version, model)
    values (p_pid, rid, l, 'aligned', 'clear', 'law.audit', '1.0.0', 'test');
  end loop;
  update proposals set status = 'in_deliberation' where id = p_pid and status = 'in_review';

  foreach v in array p_voters loop
    perform set_config('test.uid', v::text, true);
    insert into proposal_reads (proposal_id, profile_id) values (p_pid, v)
      on conflict do nothing;
    perform cast_resonance(p_pid, p_level, p_level, p_level, null);
  end loop;

  perform set_config('test.uid', p_closer::text, true);
  outcome := close_proposal(p_pid);
  return outcome;
end;
$$;

set role app;

do $$
declare
  ann uuid := '3a000001-0000-0000-0000-000000000000';
  ben uuid := '3a000002-0000-0000-0000-000000000000';
  -- Cal is in no group with them.
  cal uuid := '3a000003-0000-0000-0000-000000000000';
  gid uuid; code text;
  p_admit uuid; p_second uuid; p_revoke uuid; p_elsewhere uuid; p_lost uuid; p_wd uuid;
  lid uuid; lid2 uuid; lid3 uuid; rvid uuid;
  n int; t text; outcome decision_outcome;
  passes int := 0; fails int := 0;
  msg text;
  descr text := 'Bread baked on the row every Saturday morning, sourdough and rye, from flour milled locally.';
begin
  ---------------------------------------------------------------- the scene
  perform set_config('test.uid', ann::text, true);
  gid := create_group('Market Row', 'Six houses that trade with each other', 'local');
  code := create_invite(gid, 5, 14);
  perform set_config('test.uid', ben::text, true);
  perform redeem_invite(code);

  perform set_config('test.uid', ann::text, true);
  p_admit := test_propose(ann, gid, 'local', null, 'List the Saturday bread',
                          'Ann sells bread to the row.',
                          'Ann bakes on Saturdays and would like the row to be able to find it.');

  ------------------------------------------------ only the author attaches
  perform set_config('test.uid', ben::text, true);
  begin
    perform offer_listing(p_admit, 'product', 'Saturday bread', descr, 'Three pounds a loaf, cash.');
    fails := fails + 1; raise warning 'FAIL: somebody attached a listing to another person''s proposal';
  exception when others then passes := passes + 1;
  end;

  perform set_config('test.uid', ann::text, true);

  -- A description has to say something.
  begin
    perform offer_listing(p_admit, 'product', 'Saturday bread', 'Bread.', 'Three pounds a loaf, cash.');
    fails := fails + 1; raise warning 'FAIL: a one-word description was accepted';
  exception when others then passes := passes + 1;
  end;

  lid := offer_listing(p_admit, 'product', 'Saturday bread', descr,
                       'Three pounds a loaf, cash or swap.', 'Knock at number four');
  if lid is not null then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the author could not attach a listing to their own proposal'; end if;

  -- One thing per proposal.
  begin
    perform offer_listing(p_admit, 'service', 'Bread delivery', descr, 'A pound per drop.');
    fails := fails + 1; raise warning 'FAIL: a second listing was attached to the same proposal';
  exception when others then passes := passes + 1;
  end;

  ----------------------------------- attaching is not the same as being listed
  if listing_state(lid) = 'pending' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: an attached listing is % before any vote', listing_state(lid); end if;

  select count(*)::int into n from marketplace(null);
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the marketplace shows % listings before anything passed', n; end if;

  ----------------------------------------------------- no way around the vote
  begin
    insert into listings (proposal_id, offered_by, kind, name, description, terms)
    values (p_admit, ann, 'service', 'Direct', descr, 'Written straight in.');
    fails := fails + 1; raise warning 'FAIL: a listing was inserted without offer_listing()';
  exception when others then passes := passes + 1;
  end;

  update listings set name = 'Saturday cake' where id = lid;
  select name into t from listings where id = lid;
  if t = 'Saturday bread' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a listing''s words were changed after attaching, to %', t; end if;

  -------------------------------------------- reach is the proposal's reach
  perform set_config('test.uid', cal::text, true);
  select count(*)::int into n from listings where id = lid;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: somebody outside the group can read a group listing'; end if;

  -------------------------------------------------------------- it passes
  outcome := test_mkt_pass(p_admit, array[ann, ben], 0.85, ann);
  if outcome = 'passed' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the admitting proposal did not pass (%)', outcome; end if;

  perform set_config('test.uid', ben::text, true);
  if listing_state(lid) = 'listed' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a passed listing is %', listing_state(lid); end if;

  select count(*)::int into n from marketplace(null) where id = lid;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a member does not see a passed listing'; end if;

  select count(*)::int into n from marketplace('service');
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the kind filter returned a product as a service'; end if;

  perform set_config('test.uid', cal::text, true);
  select count(*)::int into n from marketplace(null);
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the marketplace showed a group listing to an outsider'; end if;

  ---------------------------------- too late once people have responded
  perform set_config('test.uid', ann::text, true);
  p_second := test_propose(ann, gid, 'local', null, 'A second loaf',
                           'Rye on Wednesdays.', 'Ann would like to bake midweek too.');
  update proposals set status = 'in_deliberation' where id = p_second;
  insert into proposal_reviews (proposal_id, prompt_id, prompt_version, model, summary)
  values (p_second, 'proposal.review', '1.2.0', 'test', 'A reading.');
  insert into proposal_reads (proposal_id, profile_id) values (p_second, ann);
  perform cast_resonance(p_second, 0.8, 0.8, 0.8, null);
  begin
    perform offer_listing(p_second, 'product', 'Wednesday rye', descr, 'Three pounds a loaf.');
    fails := fails + 1; raise warning 'FAIL: a listing was attached after a vote had been cast';
  exception when others then passes := passes + 1;
  end;

  -- The contact is not what was decided, and may change. Only by its owner.
  perform set_config('test.uid', ben::text, true);
  begin
    perform set_listing_contact(lid, 'Ring Ben instead');
    fails := fails + 1; raise warning 'FAIL: somebody changed another person''s contact';
  exception when others then passes := passes + 1;
  end;
  perform set_config('test.uid', ann::text, true);
  perform set_listing_contact(lid, 'Number four, side door');
  select contact into t from listings where id = lid;
  if t = 'Number four, side door' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the seller could not change their own contact'; end if;

  ------------------------------------------- revocation: the same people
  perform set_config('test.uid', ben::text, true);
  update profiles set place_local = 'Market Row', place_national = 'United Kingdom',
                      place_set_at = now() where id = ben;
  p_elsewhere := test_propose(ben, null, 'local', 'Market Row', 'Take the bread down',
                              'Asked of the street instead.',
                              'Ben would rather the whole street decided than the group.');
  begin
    perform attach_revocation(lid, p_elsewhere, 'The bread has not been baked for a month now.');
    fails := fails + 1; raise warning 'FAIL: a revocation was raised to a different audience';
  exception when others then passes := passes + 1;
  end;

  p_revoke := test_propose(ben, gid, 'local', null, 'Take the bread down',
                           'It stopped.', 'Ben says the Saturday bread has not been baked for weeks.');
  begin
    perform attach_revocation(lid, p_revoke, 'Stopped.');
    fails := fails + 1; raise warning 'FAIL: a revocation without a reason was accepted';
  exception when others then passes := passes + 1;
  end;

  rvid := attach_revocation(lid, p_revoke, 'The bread has not been baked for a month now.');
  if rvid is not null then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a member could not raise a revocation'; end if;

  if listing_state(lid) = 'listed' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: raising a revocation took the listing down before any vote'; end if;

  update listing_revocations set reason = 'Something else entirely, rewritten later.' where id = rvid;
  select reason into t from listing_revocations where id = rvid;
  if t like 'The bread%' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a revocation''s reason was rewritten'; end if;

  outcome := test_mkt_pass(p_revoke, array[ben, ann], 0.85, ann);
  perform set_config('test.uid', ben::text, true);
  if listing_state(lid) = 'revoked' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a passed revocation left the listing %', listing_state(lid); end if;

  select count(*)::int into n from marketplace(null) where id = lid;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a revoked listing is still in the marketplace'; end if;

  select count(*)::int into n from listings where id = lid;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: revoking deleted the record of the listing'; end if;

  -------------------------------------------- a declined listing is declined
  perform set_config('test.uid', ann::text, true);
  p_lost := test_propose(ann, gid, 'local', null, 'List the car boot',
                         'A monthly sale.', 'Ann would like to run a car boot sale on the green.');
  lid2 := offer_listing(p_lost, 'business', 'Green car boot', descr, 'Five pounds a pitch.');
  outcome := test_mkt_pass(p_lost, array[ann, ben], 0.10, ann);
  if listing_state(lid2) = 'declined' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a failed listing is %', listing_state(lid2); end if;

  ------------------------------------------------------------- withdrawing
  p_wd := test_propose(ann, gid, 'local', null, 'List the plant swap',
                       'Cuttings.', 'Ann would like to offer cuttings from the garden.');
  lid3 := offer_listing(p_wd, 'service', 'Plant swap', descr, 'Free, bring a pot.');

  perform set_config('test.uid', ben::text, true);
  begin
    perform withdraw_listing(lid3, 'Ben does not think this should go ahead.');
    fails := fails + 1; raise warning 'FAIL: somebody withdrew another person''s listing';
  exception when others then passes := passes + 1;
  end;

  perform set_config('test.uid', ann::text, true);
  begin
    perform withdraw_listing(lid3, 'Changed mind.');
    fails := fails + 1; raise warning 'FAIL: a withdrawal without a reason was accepted';
  exception when others then passes := passes + 1;
  end;

  perform withdraw_listing(lid3, 'The cuttings did not take this year, sorry.');
  if listing_state(lid3) = 'withdrawn' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a withdrawn listing is %', listing_state(lid3); end if;

  begin
    perform withdraw_listing(lid3, 'Saying it again, a second time over.');
    fails := fails + 1; raise warning 'FAIL: a listing was withdrawn twice';
  exception when others then passes := passes + 1;
  end;

  -- Every act is on the ledger.
  select count(*)::int into n from ledger_events
   where subject_type = 'listing'
     and kind in ('listing.offered', 'listing.withdrawn', 'listing.revocation_proposed');
  if n = 5 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: expected 5 listing events on the ledger, found %', n; end if;

  raise notice ' ';
  raise notice '  Marketplace: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then
    raise exception '% checks failed', fails;
  end if;
end $$;

reset role;

-- -----------------------------------------------------------------------------
-- Absences. A marketplace grows a ranking one column at a time.
-- -----------------------------------------------------------------------------

do $$
declare
  passes int := 0; fails int := 0; n int;
begin
  -- Nothing to sort sellers by, and nothing to pay to move up.
  select count(*)::int into n from information_schema.columns
   where table_schema = 'public' and table_name in ('listings', 'listing_revocations')
     and (column_name ~ '(boost|promot|sponsor|featur|rank|score|rating|review|click|view|impression|pin|trend|weight|priority)');
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: listings carry % ranking columns', n; end if;

  -- Terms are words. No price, currency or amount column for a market to form on.
  select count(*)::int into n from information_schema.columns
   where table_schema = 'public' and table_name = 'listings'
     and (column_name ~ '(price|currency|amount|fee|cost|sov)' or data_type in ('numeric', 'money', 'integer', 'bigint'));
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: listings carry % price-shaped columns', n; end if;

  -- No status a person can set: where a listing stands is derived.
  select count(*)::int into n from information_schema.columns
   where table_schema = 'public' and table_name = 'listings'
     and column_name in ('status', 'state', 'approved', 'approved_by', 'approved_at', 'listed', 'active');
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: listings has % settable status columns', n; end if;

  -- No write policy on either table: every write is a function with a rule.
  select count(*)::int into n from pg_policies
   where tablename in ('listings', 'listing_revocations') and cmd <> 'SELECT';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % write policies on the marketplace tables', n; end if;

  -- Nothing that decides reads it. A listing is carried by a proposal; it does
  -- not change how that proposal is decided.
  select count(*)::int into n from pg_proc
   where proname in ('close_proposal', 'cast_resonance', 'can_reach_proposal',
                     'activate_proposal', 'alignment_shape', 'resonance_summary')
     and prosrc ilike '%listing%';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % deciding functions read the marketplace', n; end if;

  -- Listing mints nothing (rule 33): it is not a finished act.
  select count(*)::int into n from sov_issuance where kind like 'listing%';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: listing something mints SOV'; end if;

  -- And SOV buys nothing here: the marketplace never mentions it.
  select count(*)::int into n from pg_proc
   where proname in ('marketplace', 'offer_listing', 'listing_state', 'attach_revocation', 'withdraw_listing')
     and prosrc ilike '%sov%';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % marketplace functions touch SOV', n; end if;

  -- marketplace() adds no reach of its own.
  select count(*)::int into n from pg_proc where proname = 'marketplace' and prosecdef;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: marketplace() is security definer and could reach past the policies'; end if;

  raise notice ' ';
  raise notice '  Marketplace (absences): % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then
    raise exception '% checks failed', fails;
  end if;
end $$;
