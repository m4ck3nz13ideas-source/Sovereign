-- Amendment: the tenth law applied to the other nine. The wording can be
-- sharpened; the substance cannot be weakened by anything less than the bar.
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
  ('e0000001-0000-0000-0000-000000000000', 'amend1@example.com'),
  ('e0000002-0000-0000-0000-000000000000', 'amend2@example.com'),
  ('e0000003-0000-0000-0000-000000000000', 'amend3@example.com');

-- Global asks for a thousand voices and thirty days, which is correct and
-- untestable. Lowered here as the owner and put back at the end — the suite is
-- about what an amendment has to clear, not about whether global is demanding.
update scope_rules set min_voices = 2, deliberation_days = 0 where scope = 'global';

set role app;

do $$
declare
  ann uuid := 'e0000001-0000-0000-0000-000000000000';
  ben uuid := 'e0000002-0000-0000-0000-000000000000';
  cal uuid := 'e0000003-0000-0000-0000-000000000000';
  weak uuid; strong uuid; killed uuid; rid uuid; revid uuid;
  n int; msg text; outcome decision_outcome; body text; rev int;
  passes int := 0; fails int := 0;
  all_laws text[] := array[
    'sanctity_of_life','truth_and_transparency','sovereignty_of_the_individual',
    'equity_and_justice','subsidiarity','reciprocity_and_mutual_care',
    'stewardship_of_earth','harmony_of_diversity','right_use_of_power',
    'continuous_evolution'];
  l text;
  new_text text := 'All governance must operate in truth. No hidden power and no manipulation. '
                || 'Citizens have the right to clear, honest and accessible information, and to know '
                || 'who decided a thing and on what basis.';
  new_violation text := 'The proposal conceals who holds a power it creates, or presents a claim as '
                     || 'settled that the proposal itself shows is contested. An unanswered question '
                     || 'is not concealment.';
begin
  perform set_config('test.uid', ann::text, true);
  update profiles set place_national = 'United Kingdom', place_set_at = now() where id = ann;
  perform set_config('test.uid', ben::text, true);
  update profiles set place_national = 'United Kingdom', place_set_at = now() where id = ben;
  perform set_config('test.uid', cal::text, true);
  update profiles set place_national = 'United Kingdom', place_set_at = now() where id = cal;

  -- Global asks for proof of personhood before anybody resonates, which 0011
  -- decided and which is exactly right here: the constitution is not rewritten
  -- by accounts. Three distinct humans, three distinct nullifiers.
  perform record_personhood('worldid', 'nullifier-amend-one-human-aaaa', 'orb');
  perform set_config('test.uid', ben::text, true);
  perform record_personhood('worldid', 'nullifier-amend-one-human-bbbb', 'orb');
  perform set_config('test.uid', ann::text, true);
  perform record_personhood('worldid', 'nullifier-amend-one-human-cccc', 'orb');

  ------------------------------------------------- revision 1 is not a row
  select count(*)::int into n from law_revisions;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % revisions exist before anything was amended', n; end if;

  if law_current_revision('truth_and_transparency') = 1 then passes := passes + 1;
  else fails := fails + 1;
    raise warning 'FAIL: the shipped text is not revision 1'; end if;

  ------------------------------------ a street cannot amend the constitution
  begin
    perform test_propose(ann, null, 'local', 'Bell Lane',
                         'Rewrite truth and transparency', 'A local rewrite.',
                         'The wording of the second law is too narrow for what we keep running into.',
                         null, null, 0.820,
                         'truth_and_transparency', new_text, new_violation);
    fails := fails + 1;
    raise warning 'FAIL: a local proposal amended a Universal Law';
  exception when others then passes := passes + 1;
  end;

  ------------------------------------------- and it needs both new texts
  begin
    perform test_propose(ann, null, 'global', null,
                         'Rewrite truth and transparency', 'Half an amendment.',
                         'The wording of the second law is too narrow for what we keep running into.',
                         null, null, 0.820,
                         'truth_and_transparency', new_text, null);
    fails := fails + 1;
    raise warning 'FAIL: an amendment was accepted without saying what a violation looks like';
  exception when others then passes := passes + 1;
  end;

  ------------------------------- something this law has already killed
  killed := test_propose(ann, null, 'global', null,
                         'A quiet standing committee', 'Five people decide.',
                         'Decisions keep stalling because everybody has to be asked about everything.');
  insert into proposal_reviews (proposal_id, prompt_id, prompt_version, model, summary)
  values (killed, 'proposal.review', '1.2.0', 'test', 'A reading.') returning id into rid;
  foreach l in array all_laws loop
    insert into law_assessments (proposal_id, review_id, law_id, verdict, reasoning,
                                 prompt_id, prompt_version, model)
    values (killed, rid, l,
            (case when l = 'truth_and_transparency' then 'violation' else 'aligned' end)::law_verdict,
            case when l = 'truth_and_transparency'
                 then 'It creates a power whose holders are not named anywhere in the proposal.'
                 else 'clear' end,
            'law.audit', '1.0.0', 'test');
  end loop;
  perform test_set_status(killed, 'failed');

  ------------------------------------------------- the amendment itself
  weak := test_propose(ann, null, 'global', null,
                       'Sharpen truth and transparency', 'Name who decided.',
                       'The second law says governance must operate in truth but does not say that people have the right to know who decided a thing.',
                       null, null, 0.820,
                       'truth_and_transparency', new_text, new_violation);

  select amends_law into msg from proposals where id = weak;
  if msg = 'truth_and_transparency' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the amendment did not record which law it touches'; end if;

  ------------------------------------------------------- and it is frozen
  begin
    update proposals set amends_law = 'equity_and_justice' where id = weak;
    select amends_law into msg from proposals where id = weak;
    if msg = 'truth_and_transparency' then passes := passes + 1; else fails := fails + 1;
      raise warning 'FAIL: the law an amendment touches was changed after submission'; end if;
  exception when others then passes := passes + 1;
  end;

  begin
    update proposals set amendment_text = 'Something else entirely, said afterwards, at length, to fit.'
     where id = weak;
    fails := fails + 1;
    raise warning 'FAIL: the proposed wording was rewritten after submission';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%fixed at submission%' then passes := passes + 1;
    else fails := fails + 1;
      raise warning 'FAIL: wrong error rewriting an amendment: %', msg; end if;
  end;

  ------------------------------------------ the reading list is in front of them
  select count(*)::int into n from amendment_would_reopen(weak);
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: expected 1 past refusal under this law, got %', n; end if;

  select title into msg from amendment_would_reopen(weak);
  if msg = 'A quiet standing committee' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the reading list named "%"', msg; end if;

  select would_reopen into n from amendment_standing(weak);
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the standing reports % past refusals', n; end if;

  ------------------------------------------ nothing is enacted before it passes
  begin
    perform enact_amendment(weak);
    fails := fails + 1;
    raise warning 'FAIL: an amendment was enacted before it passed';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%has passed can be enacted%' then passes := passes + 1;
    else fails := fails + 1;
      raise warning 'FAIL: wrong error enacting early: %', msg; end if;
  end;

  ------------------------------------------------------- audit it, and close it
  insert into proposal_reviews (proposal_id, prompt_id, prompt_version, model, summary)
  values (weak, 'proposal.review', '1.2.0', 'test', 'A reading.') returning id into rid;
  foreach l in array all_laws loop
    insert into law_assessments (proposal_id, review_id, law_id, verdict, reasoning,
                                 prompt_id, prompt_version, model)
    values (weak, rid, l, 'aligned', 'clear', 'law.audit', '1.0.0', 'test');
  end loop;
  update proposals set status = 'in_deliberation' where id = weak;

  -- Enough to pass an ordinary global proposal, nowhere near enough to change
  -- the constitution. That gap is the whole feature.
  insert into proposal_reads (proposal_id, profile_id) values (weak, ann);
  perform cast_resonance(weak, 0.80, 0.80, 0.80, null);
  perform set_config('test.uid', ben::text, true);
  insert into proposal_reads (proposal_id, profile_id) values (weak, ben);
  perform cast_resonance(weak, 0.78, 0.80, 0.80, null);
  perform set_config('test.uid', ann::text, true);

  outcome := close_proposal(weak);
  if outcome = 'passed' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the amendment did not pass as a proposal (%)', outcome; end if;

  ---------------------------- passing as a proposal is not clearing the bar
  begin
    perform enact_amendment(weak);
    fails := fails + 1;
    raise warning 'FAIL: an amendment nobody put above 0.9 rewrote a Universal Law';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%every voice at 0.900 or above%' then passes := passes + 1;
    else fails := fails + 1;
      raise warning 'FAIL: wrong error below the amendment bar: %', msg; end if;
  end;

  select count(*)::int into n from law_revisions;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a revision was written despite the refusal'; end if;

  ------------------------------------------------- now one that clears it
  strong := test_propose(ann, null, 'global', null,
                         'Say who decided', 'The same sharpening, put properly.',
                         'People cannot check a decision they cannot trace to whoever made it, and the second law does not currently say so.',
                         null, null, 0.820,
                         'truth_and_transparency', new_text, new_violation);

  insert into proposal_reviews (proposal_id, prompt_id, prompt_version, model, summary)
  values (strong, 'proposal.review', '1.2.0', 'test', 'A reading.') returning id into rid;
  foreach l in array all_laws loop
    insert into law_assessments (proposal_id, review_id, law_id, verdict, reasoning,
                                 prompt_id, prompt_version, model)
    values (strong, rid, l,
            (case when l = 'right_use_of_power' then 'tension' else 'aligned' end)::law_verdict,
            case when l = 'right_use_of_power'
                 then 'Naming who decided puts a cost on people who decide unpopular things.'
                 else 'clear' end,
            'law.audit', '1.0.0', 'test');
  end loop;
  update proposals set status = 'in_deliberation' where id = strong;

  insert into proposal_reads (proposal_id, profile_id) values (strong, ann);
  perform cast_resonance(strong, 0.95, 0.90, 0.90, null);
  perform set_config('test.uid', ben::text, true);
  insert into proposal_reads (proposal_id, profile_id) values (strong, ben);
  perform cast_resonance(strong, 0.94, 0.90, 0.90, null);
  perform set_config('test.uid', cal::text, true);
  insert into proposal_reads (proposal_id, profile_id) values (strong, cal);
  perform cast_resonance(strong, 0.93, 0.90, 0.90, null);
  perform set_config('test.uid', ann::text, true);

  ------------------- the tension is answered in writing before it can close
  -- 0004 already fails a proposal that closes with an unanswered tension, so
  -- the interesting assertion here is not that it blocks — it is that an
  -- amendment has to get through that gate like everything else, and then
  -- clear a bar nothing else has to.
  perform resolve_law_tension(
    (select id from law_assessments
      where proposal_id = strong and law_id = 'right_use_of_power'),
    'The cost is real and it is the point: a decision nobody will put their name to is one the law already doubts.');

  outcome := close_proposal(strong);
  if outcome = 'passed' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the strong amendment did not pass (%)', outcome; end if;

  ------------------------------------------------------------- enact it
  revid := enact_amendment(strong);
  if revid is not null then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: enacting returned nothing'; end if;

  if law_current_revision('truth_and_transparency') = 2 then passes := passes + 1;
  else fails := fails + 1;
    raise warning 'FAIL: the law is at revision % after one amendment',
      law_current_revision('truth_and_transparency'); end if;

  select text into body from law_text('truth_and_transparency');
  if body = new_text then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the current wording is not the amended one'; end if;

  select revision into rev from law_text('truth_and_transparency');
  if rev = 2 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: law_text reports revision %', rev; end if;

  ------------------------------------------- and only that one law moved
  if law_current_revision('equity_and_justice') = 1 then passes := passes + 1;
  else fails := fails + 1;
    raise warning 'FAIL: amending one law moved another'; end if;

  ------------------------------------------------------ twice is not allowed
  begin
    perform enact_amendment(strong);
    fails := fails + 1;
    raise warning 'FAIL: the same amendment was enacted twice';
  exception when others then passes := passes + 1;
  end;

  select count(*)::int into n from law_revisions;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % revisions exist after one amendment', n; end if;

  ------------------------------------------ a revision cannot be edited away
  update law_revisions set text = 'Something the group never agreed to.'
   where law_id = 'truth_and_transparency';
  select text into body from law_text('truth_and_transparency');
  if body = new_text then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a law revision was rewritten in place'; end if;

  delete from law_revisions where law_id = 'truth_and_transparency';
  if law_current_revision('truth_and_transparency') = 2 then passes := passes + 1;
  else fails := fails + 1;
    raise warning 'FAIL: a law revision was deleted'; end if;

  ------------------------- ONE dissenting voice stops it, among any number
  -- The whole of "all users must agree", made mechanical. Three people at
  -- 0.95 and one at 0.40 is a proposal that passes easily and a constitution
  -- that does not move.
  declare
    lone uuid;
  begin
    lone := test_propose(ann, null, 'global', null,
                         'A third pass at the same law', 'Nearly everybody wants it.',
                         'The wording still does not cover the case we keep running into, even after the last amendment.',
                         null, null, 0.820,
                         'truth_and_transparency',
                         new_text || ' Records must name the decision maker.',
                         new_violation);

    insert into proposal_reviews (proposal_id, prompt_id, prompt_version, model, summary)
    values (lone, 'proposal.review', '1.2.0', 'test', 'A reading.') returning id into rid;
    foreach l in array all_laws loop
      insert into law_assessments (proposal_id, review_id, law_id, verdict, reasoning,
                                   prompt_id, prompt_version, model)
      values (lone, rid, l, 'aligned', 'clear', 'law.audit', '1.0.0', 'test');
    end loop;
    update proposals set status = 'in_deliberation' where id = lone;

    perform set_config('test.uid', ann::text, true);
    insert into proposal_reads (proposal_id, profile_id) values (lone, ann);
    perform cast_resonance(lone, 0.96, 0.95, 0.95, null);
    perform set_config('test.uid', ben::text, true);
    insert into proposal_reads (proposal_id, profile_id) values (lone, ben);
    perform cast_resonance(lone, 0.95, 0.95, 0.95, null);
    perform set_config('test.uid', cal::text, true);
    insert into proposal_reads (proposal_id, profile_id) values (lone, cal);
    perform cast_resonance(lone, 0.40, 0.90, 0.90, null);
    perform set_config('test.uid', ann::text, true);

    outcome := close_proposal(lone);
    if outcome = 'passed' then passes := passes + 1; else fails := fails + 1;
      raise warning 'FAIL: 0.96/0.95/0.40 did not pass as an ordinary proposal (%)', outcome;
    end if;

    begin
      perform enact_amendment(lone);
      fails := fails + 1;
      raise warning 'FAIL: one person objecting did not stop a constitutional amendment';
    exception when others then
      get stacked diagnostics msg = message_text;
      if msg like '%not carried over an objection%' then passes := passes + 1;
      else fails := fails + 1;
        raise warning 'FAIL: wrong error on a lone objection: %', msg; end if;
    end;

    if law_current_revision('truth_and_transparency') = 2 then passes := passes + 1;
    else fails := fails + 1;
      raise warning 'FAIL: the law moved despite the objection'; end if;
  end;

  -------------------------------------------- it is on the public record
  select count(*)::int into n
    from ledger_events
   where kind = 'law.amended' and subject_id = strong;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the amendment is not on the ledger (% events)', n; end if;

  --------------------------------- and the history keeps the failed attempt
  select count(*)::int into n from amendment_history('truth_and_transparency');
  if n = 3 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the history shows % attempts, expected 3', n; end if;

  raise notice ' ';
  raise notice '  Amendment: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then
    raise exception '% checks failed', fails;
  end if;
end $$;

reset role;

-- Put global back where it belongs.
update scope_rules set min_voices = 1000, deliberation_days = 30 where scope = 'global';
