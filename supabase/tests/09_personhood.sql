-- Personhood: one human one voice, where the people are too far apart to see
-- each other — and nothing about the human stored but an opaque hash.
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
  ('99999991-9999-9999-9999-999999999999', 'per1@example.com'),
  ('99999992-9999-9999-9999-999999999999', 'per2@example.com'),
  ('99999993-9999-9999-9999-999999999999', 'per3@example.com');

set role app;

do $$
declare
  ann  uuid := '99999991-9999-9999-9999-999999999999';
  ben  uuid := '99999992-9999-9999-9999-999999999999';
  -- Ben's second account. Same human, different email, which is the whole
  -- attack this exists to stop.
  sock uuid := '99999993-9999-9999-9999-999999999999';
  street uuid; nation uuid; grouped uuid; gid uuid; rid uuid; code text;
  msg text; n int; ok_flag boolean; outcome decision_outcome;
  nullifier text := 'nullifier-for-one-particular-human-0001';
  passes int := 0; fails int := 0;
  all_laws text[] := array[
    'sanctity_of_life','truth_and_transparency','sovereignty_of_the_individual',
    'equity_and_justice','subsidiarity','reciprocity_and_mutual_care',
    'stewardship_of_earth','harmony_of_diversity','right_use_of_power',
    'continuous_evolution'];
  l text;
begin
  --------------------------------------------------------------- three people
  -- on the same street, in the same country.
  perform set_config('test.uid', ann::text, true);
  update profiles set place_local = 'Bridge Street', place_regional = 'Devon',
                      place_national = 'United Kingdom', place_continental = 'Europe',
                      place_set_at = now()
   where id = ann;

  perform set_config('test.uid', ben::text, true);
  update profiles set place_local = 'Bridge Street', place_regional = 'Devon',
                      place_national = 'United Kingdom', place_continental = 'Europe',
                      place_set_at = now()
   where id = ben;

  perform set_config('test.uid', sock::text, true);
  update profiles set place_local = 'Bridge Street', place_regional = 'Devon',
                      place_national = 'United Kingdom', place_continental = 'Europe',
                      place_set_at = now()
   where id = sock;

  ------------------------------------------ nobody starts out verified
  perform set_config('test.uid', ann::text, true);
  if not is_verified_person() then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: somebody was verified before anything happened'; end if;

  ------------------------------------------------------- a street proposal
  street := test_propose(ann, null, 'local', 'Bridge Street',
                         'Mend the wall', 'The low wall by the bench.',
                         'The wall by the bench has been down since the storm.');
  insert into proposal_reviews (proposal_id, prompt_id, prompt_version, model, summary)
  values (street, 'proposal.review', '1.2.0', 'test', 'A reading.') returning id into rid;
  foreach l in array all_laws loop
    insert into law_assessments (proposal_id, review_id, law_id, verdict, reasoning,
                                 prompt_id, prompt_version, model)
    values (street, rid, l, 'aligned', 'clear', 'law.audit', '1.0.0', 'test');
  end loop;
  update proposals set status = 'in_deliberation' where id = street;

  ------------------- unverified resonance is fine where people can see each other
  insert into proposal_reads (proposal_id, profile_id) values (street, ann);
  begin
    perform cast_resonance(street, 0.90, 0.85, 0.80, null);
    passes := passes + 1;
  exception when others then
    get stacked diagnostics msg = message_text;
    fails := fails + 1;
    raise warning 'FAIL: local resonance was refused from an unverified person: %', msg;
  end;

  --------------------------------------------------------- a national proposal
  nation := test_propose(ann, null, 'national', 'United Kingdom',
                         'One recycling standard', 'The same bins everywhere.',
                         'Every council sorts waste differently and nobody knows the rules.');
  insert into proposal_reviews (proposal_id, prompt_id, prompt_version, model, summary)
  values (nation, 'proposal.review', '1.2.0', 'test', 'A reading.') returning id into rid;
  foreach l in array all_laws loop
    insert into law_assessments (proposal_id, review_id, law_id, verdict, reasoning,
                                 prompt_id, prompt_version, model)
    values (nation, rid, l, 'aligned', 'clear', 'law.audit', '1.0.0', 'test');
  end loop;
  update proposals set status = 'in_deliberation' where id = nation;

  ----------------------------------------- reading it needs nothing
  insert into proposal_reads (proposal_id, profile_id) values (nation, ann);
  select count(*)::int into n from proposals where id = nation;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: an unverified person could not read a national proposal'; end if;

  ------------------------------------- and objecting to it needs nothing either
  begin
    insert into deliberation_comments (proposal_id, author_id, kind, body)
    values (nation, ann, 'concern', 'Devon has three collection days and this assumes one.');
    passes := passes + 1;
  exception when others then
    get stacked diagnostics msg = message_text;
    fails := fails + 1;
    raise warning 'FAIL: an unverified person could not raise a concern: %', msg;
  end;

  --------------------------------------------------- but resonance does not
  begin
    perform cast_resonance(nation, 0.90, 0.85, 0.80, null);
    fails := fails + 1;
    raise warning 'FAIL: unverified resonance at national scale was accepted';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%proof that you are one person%' then passes := passes + 1;
    else fails := fails + 1;
      raise warning 'FAIL: wrong error on unverified national resonance: %', msg; end if;
  end;

  --------------------------------------------------------------- verify Ann
  perform record_personhood('worldid', 'nullifier-for-ann-a-different-human-9', 'orb');
  if is_verified_person() then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: recording a proof did not verify'; end if;

  begin
    perform cast_resonance(nation, 0.90, 0.85, 0.80, null);
    passes := passes + 1;
  exception when others then
    get stacked diagnostics msg = message_text;
    fails := fails + 1;
    raise warning 'FAIL: a verified person was refused national resonance: %', msg;
  end;

  ------------------------------------------- nothing about her body is stored
  select count(*)::int into n
    from information_schema.columns
   where table_name = 'personhood_proofs'
     and column_name in ('name', 'document', 'image', 'biometric', 'email', 'date_of_birth');
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: personhood_proofs grew % columns it should not have', n; end if;

  ------------------------------------ and the ledger does not carry the hash
  select count(*)::int into n
    from ledger_events
   where kind = 'personhood.verified' and payload::text like '%nullifier-for-ann%';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the nullifier reached the public ledger'; end if;

  ----------------------------------------------- one human, one account
  perform set_config('test.uid', ben::text, true);
  perform record_personhood('worldid', nullifier, 'orb');
  if is_verified_person() then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: Ben did not verify'; end if;

  perform set_config('test.uid', sock::text, true);
  begin
    perform record_personhood('worldid', nullifier, 'orb');
    fails := fails + 1;
    raise warning 'FAIL: the same human verified a second account';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%one person, one voice%' then passes := passes + 1;
    else fails := fails + 1;
      raise warning 'FAIL: wrong error on a duplicate nullifier: %', msg; end if;
  end;

  if not is_verified_person() then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the sock account ended up verified anyway'; end if;

  ------------------------------------ and cannot read anybody else's proof
  select count(*)::int into n from personhood_proofs where profile_id = ben;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: one account read another''s proof row'; end if;

  ------------------------------------------- nor write one without the function
  begin
    insert into personhood_proofs (profile_id, method, provider, nullifier)
    values (sock, 'biometric', 'self-declared', 'i-say-i-am-a-person-trust-me-0001');
    if is_verified_person() then
      fails := fails + 1;
      raise warning 'FAIL: an account verified itself by writing the table directly';
    else
      passes := passes + 1;
    end if;
  exception when others then passes := passes + 1;
  end;

  ------------------------------------------- nor revoke somebody else's
  perform set_config('test.uid', sock::text, true);
  perform revoke_personhood();
  perform set_config('test.uid', ben::text, true);
  if is_verified_person() then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: one account revoked another''s personhood'; end if;

  ---------------------------------- revoking your own releases the nullifier
  perform revoke_personhood();
  if not is_verified_person() then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: revoking did not unverify'; end if;

  perform set_config('test.uid', sock::text, true);
  begin
    perform record_personhood('worldid', nullifier, 'orb');
    passes := passes + 1;
  exception when others then
    get stacked diagnostics msg = message_text;
    fails := fails + 1;
    raise warning 'FAIL: a released nullifier could not be reused by the same human: %', msg;
  end;

  ------------------------------------------------------------- expiry counts
  perform set_config('test.uid', ann::text, true);
  perform record_personhood('worldid', 'nullifier-for-ann-a-different-human-9', 'device',
                            'biometric', now() - interval '1 day');
  if not is_verified_person() then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: an expired proof still counted'; end if;

  perform record_personhood('worldid', 'nullifier-for-ann-a-different-human-9', 'orb');

  -------------------------------- a group has a register, so it asks for nothing
  perform set_config('test.uid', ann::text, true);
  gid := create_group('Verified Test', 'x', 'national');
  grouped := test_propose(ann, gid, 'national', null,
                          'Buy the projector', 'Two hundred.',
                          'The one in the hall has a dead lamp and no replacement.');
  insert into proposal_reviews (proposal_id, prompt_id, prompt_version, model, summary)
  values (grouped, 'proposal.review', '1.2.0', 'test', 'A reading.') returning id into rid;
  foreach l in array all_laws loop
    insert into law_assessments (proposal_id, review_id, law_id, verdict, reasoning,
                                 prompt_id, prompt_version, model)
    values (grouped, rid, l, 'aligned', 'clear', 'law.audit', '1.0.0', 'test');
  end loop;
  update proposals set status = 'in_deliberation' where id = grouped;

  code := create_invite(gid, 5, 14);
  perform set_config('test.uid', sock::text, true);
  perform redeem_invite(code);
  perform revoke_personhood();

  insert into proposal_reads (proposal_id, profile_id) values (grouped, sock);
  begin
    perform cast_resonance(grouped, 0.80, 0.80, 0.80, null);
    passes := passes + 1;
  exception when others then
    get stacked diagnostics msg = message_text;
    fails := fails + 1;
    raise warning 'FAIL: an unverified member was refused inside their own group: %', msg;
  end;

  ------------------------------------------ the decision records the count
  perform set_config('test.uid', ann::text, true);
  outcome := close_proposal(street);
  if outcome = 'passed' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the street proposal did not pass (%)', outcome; end if;

  select verified_voices into n from decisions where proposal_id = street;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: expected 1 verified voice on the street decision, got %', n; end if;

  select voter_count into n from decisions where proposal_id = street;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: expected 1 voice on the street decision, got %', n; end if;

  ------------------------------------------------------ and the rules are visible
  select required into ok_flag from personhood_standing('local');
  if not ok_flag then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: local is asking for proof of personhood'; end if;

  select required into ok_flag from personhood_standing('global');
  if ok_flag then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: global is not asking for proof of personhood'; end if;

  raise notice ' ';
  raise notice '  Personhood: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then
    raise exception '% checks failed', fails;
  end if;
end $$;

reset role;
