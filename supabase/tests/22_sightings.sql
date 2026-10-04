-- Sightings: raising a word from the proposal it was noticed in, as a quotation
-- and an attributed act — never as a claim about what the proposal is about.
--
-- Most of the risk here is the quiet kind. If the excerpt were trusted from the
-- client, a sighting could quote words a proposal never said, which is exactly
-- the fabricated attachment 0023 refused. And if anything that decides read
-- this table, "how often a word was stopped at" would become a vote.
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
  ('5a000001-0000-0000-0000-000000000000', 'sig1@example.com'),
  ('5a000002-0000-0000-0000-000000000000', 'sig2@example.com'),
  ('5a000003-0000-0000-0000-000000000000', 'sig3@example.com');

set role app;

do $$
declare
  ann uuid := '5a000001-0000-0000-0000-000000000000';
  ben uuid := '5a000002-0000-0000-0000-000000000000';
  -- Cal is in no group with them, but lives on the same street, so a place
  -- proposal reaches all three and a group one reaches only two.
  cal uuid := '5a000003-0000-0000-0000-000000000000';
  gid uuid; pid uuid; street uuid; tid uuid; again uuid; n int; t text; ok boolean;
  passes int := 0; fails int := 0;
  msg text;
  seed text := 'Members get shared access to the workshop, and the ladder lives in it.';
  quote text := 'Members get shared access to the workshop';
begin
  ---------------------------------------------------------------- the scene
  perform set_config('test.uid', ann::text, true);
  gid := gen_random_uuid();
  insert into groups (id, name, slug, purpose, created_by)
  values (gid, 'Sighting Row', 'sighting-row', 'Four houses and one workshop', ann);
  insert into group_members (group_id, profile_id, role) values (gid, ann, 'steward');
  update profiles set place_local = 'Sighting Row', place_national = 'United Kingdom',
                      place_set_at = now() where id = ann;

  perform set_config('test.uid', ben::text, true);
  insert into group_members (group_id, profile_id, role) values (gid, ben, 'member');
  update profiles set place_local = 'Sighting Row', place_national = 'United Kingdom',
                      place_set_at = now() where id = ben;

  perform set_config('test.uid', cal::text, true);
  update profiles set place_local = 'Sighting Row', place_national = 'United Kingdom',
                      place_set_at = now() where id = cal;

  perform set_config('test.uid', ann::text, true);
  pid := test_propose(ann, gid, 'local', null, 'The workshop, shared',
                      'Who gets in and how.', seed);
  street := test_propose(ann, null, 'local', 'Sighting Row', 'Street workshop',
                         'For the whole row.', seed);

  ---------------------------------------------- a real quotation is accepted
  perform set_config('test.uid', ben::text, true);
  tid := raise_term_from(pid, 'shared', quote);
  if tid is not null then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a member could not raise a word from a proposal'; end if;

  select count(*)::int into n from terms where id = tid and group_id = gid;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the raised word is not in the proposal''s group'; end if;

  select excerpt into t from term_sightings
   where term_id = tid and proposal_id = pid and raised_by = ben;
  if t = quote then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the sighting stored % rather than the quote', t; end if;

  --------------------- whitespace and case the browser adds are not a refusal
  perform set_config('test.uid', ann::text, true);
  again := raise_term_from(pid, 'Shared', E'members GET   shared\naccess');
  if again = tid then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a reflowed quotation made a second word'; end if;

  ------------------------------------------ a quote the proposal never said
  begin
    perform raise_term_from(pid, 'shared', 'Members get shared ownership of the van');
    fails := fails + 1;
    raise warning 'FAIL: a sighting quoted words the proposal does not contain';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%not in this proposal%' then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: wrong error for a false quote: %', msg; end if;
  end;

  -------------------------------------- a word that is not in the quote
  begin
    perform raise_term_from(pid, 'ladder', quote);
    fails := fails + 1;
    raise warning 'FAIL: raised a word the quoted passage does not contain';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%not in the passage%' then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: wrong error for a missing word: %', msg; end if;
  end;

  ------------------------------------------ an empty or runaway quotation
  begin
    perform raise_term_from(pid, 'shared', '');
    fails := fails + 1;
    raise warning 'FAIL: an empty quotation was accepted';
  exception when others then passes := passes + 1;
  end;

  begin
    perform raise_term_from(pid, 'shared', repeat('shared ', 80));
    fails := fails + 1;
    raise warning 'FAIL: a 560-character quotation was accepted';
  exception when others then passes := passes + 1;
  end;

  ----------------------------------------------- a place has nobody's words
  begin
    perform raise_term_from(street, 'shared', quote);
    fails := fails + 1;
    raise warning 'FAIL: a word was raised from a place proposal';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like '%addressed to a place%' then passes := passes + 1;
    else fails := fails + 1; raise warning 'FAIL: wrong error for a place: %', msg; end if;
  end;

  ------------------------------------------ an outsider cannot raise at all
  perform set_config('test.uid', cal::text, true);
  begin
    perform raise_term_from(pid, 'shared', quote);
    fails := fails + 1;
    raise warning 'FAIL: somebody outside the group raised a word from its proposal';
  exception when others then passes := passes + 1;
  end;

  -- ...and cannot write a sighting directly, because there is no insert policy.
  begin
    insert into term_sightings (term_id, proposal_id, raised_by, excerpt)
    values (tid, pid, cal, quote);
    fails := fails + 1;
    raise warning 'FAIL: a sighting was written without the function';
  exception when others then passes := passes + 1;
  end;

  -- ...and sees none of them.
  select count(*)::int into n from term_sightings where term_id = tid;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: an outsider read % sightings', n; end if;

  select count(*)::int into n from sightings_for(tid);
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: sightings_for() gave an outsider % rows', n; end if;

  ------------------------------- a member sees who stopped where, in order
  perform set_config('test.uid', ann::text, true);
  select count(*)::int into n from sightings_for(tid);
  if n = 2 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % sightings where Ben and Ann each raised it once', n; end if;

  select proposal_title into t from sightings_for(tid) limit 1;
  if t = 'The workshop, shared' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: first sighting names % rather than the proposal', t; end if;

  select display_name is not null and mine is false into ok
    from sightings_for(tid) where raised_by = ben;
  if ok then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: Ben''s sighting is not attributed to Ben, or reads as Ann''s'; end if;

  ------------------------------- pressing twice is one sighting, not two
  perform raise_term_from(pid, 'shared', quote);
  select count(*)::int into n from term_sightings
   where term_id = tid and proposal_id = pid and raised_by = ann;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: one person pressing twice made % sightings', n; end if;

  ------------------------------------------------------ it cannot be undone
  update term_sightings set excerpt = 'Members get the workshop'
   where term_id = tid and raised_by = ann;
  select excerpt into t from term_sightings where term_id = tid and raised_by = ann;
  if t <> 'Members get the workshop' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a sighting''s quote was edited after the fact'; end if;

  delete from term_sightings where term_id = tid and raised_by = ann;
  select count(*)::int into n from term_sightings where term_id = tid and raised_by = ann;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a sighting was deleted'; end if;

  raise notice ' ';
  raise notice '  Sightings: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then
    raise exception '% checks failed', fails;
  end if;
end $$;

reset role;

-- -----------------------------------------------------------------------------
-- Absences. Each of these is one line of DDL away from existing, and none of
-- them would break anything visible if it did.
-- -----------------------------------------------------------------------------

do $$
declare
  passes int := 0; fails int := 0; n int;
begin
  -- No column on proposals points at words. A sighting lives on the word.
  select count(*)::int into n from information_schema.columns
   where table_schema = 'public' and table_name = 'proposals'
     -- term_days is how long a proposal runs, not a word; everything else
     -- that could point at the lexicon is named here.
     and (column_name in ('term', 'term_id', 'term_ids', 'terms', 'word', 'words')
          or column_name like '%lexic%' or column_name like '%sighting%'
          or column_name like '%vocab%');
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: proposals has % columns about words', n; end if;

  -- A sighting is not evidence and carries no weight.
  select count(*)::int into n from information_schema.columns
   where table_schema = 'public' and table_name = 'term_sightings'
     and column_name in ('score', 'weight', 'relevance', 'confidence', 'rank',
                         'votes', 'important', 'decisive', 'verified');
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: term_sightings has % weighting columns', n; end if;

  -- No policy writes, edits or deletes a sighting.
  select count(*)::int into n from pg_policies
   where tablename = 'term_sightings' and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL');
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: term_sightings has % write policies', n; end if;

  -- Nothing that decides reads it.
  select count(*)::int into n from pg_proc
   where proname in ('close_proposal', 'cast_resonance', 'can_reach_proposal',
                     'activate_proposal', 'dormant_proposals')
     and prosrc ilike '%term_sighting%';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % deciding functions read term_sightings', n; end if;

  -- Nor terms or readings — 0023's promise, re-asserted now that a word has a
  -- route to a proposal.
  select count(*)::int into n from pg_proc
   where proname in ('close_proposal', 'cast_resonance', 'can_reach_proposal')
     and (prosrc ilike '%term_readings%' or prosrc ilike '% terms %');
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % deciding functions read the lexicon', n; end if;

  -- And no function lists the words "in" a proposal.
  select count(*)::int into n from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and (proname ilike '%terms_for_proposal%' or proname ilike '%proposal_terms%'
          or proname ilike '%words_in%' or proname ilike '%proposal_words%');
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % functions list a proposal''s words', n; end if;

  raise notice ' ';
  raise notice '  Sightings (absences): % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then
    raise exception '% checks failed', fails;
  end if;
end $$;
