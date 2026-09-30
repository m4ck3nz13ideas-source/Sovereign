-- Lexicon: a group's words, several readings each, and every structural reason
-- the thing cannot quietly become a glossary.
--
-- The absences are most of this file. A glossary is one line of DDL away at any
-- time, and the failure would be silent: everything would still work, and the
-- one piece of information the feature exists to carry — that two people mean
-- different things — would have been overwritten by whoever edited last.
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
  ('d1000001-0000-0000-0000-000000000000', 'lex1@example.com'),
  ('d1000002-0000-0000-0000-000000000000', 'lex2@example.com'),
  ('d1000003-0000-0000-0000-000000000000', 'lex3@example.com');

set role app;

do $$
declare
  ann uuid := 'd1000001-0000-0000-0000-000000000000';
  ben uuid := 'd1000002-0000-0000-0000-000000000000';
  -- Cal is in no group with the other two. Everything here should be invisible
  -- to him, and the readings are the first thing in this schema that one
  -- person's words are readable by another at all, so that matters more here
  -- than usual.
  cal uuid := 'd1000003-0000-0000-0000-000000000000';
  gid uuid; tid uuid; other uuid; n int; b text; r int; ok boolean;
  passes int := 0; fails int := 0;

  -- Two readings of one word that both sound reasonable and are not the same
  -- arrangement. This is the case the feature exists for.
  ann_says text := 'Everyone on the row can use it. You put your name on the '
                   'sheet in the porch for the day you want it.';
  ben_says text := 'Everyone on the row gets a key, and you take it when you '
                   'need it and put it back. No sheet, no asking.';
begin
  ---------------------------------------------------------------- a group
  perform set_config('test.uid', ann::text, true);
  -- The id is generated here rather than with `returning`, because
  -- `insert ... returning` applies the SELECT policy as well as the insert
  -- one, and `groups_read` asks for membership of a group that does not have
  -- any members yet. Not a bug in the policy — the founder's own membership
  -- row is the next statement.
  gid := gen_random_uuid();
  insert into groups (id, name, slug, purpose, created_by)
  values (gid, 'Lexicon Row', 'lexicon-row', 'Six houses and one ladder', ann);
  insert into group_members (group_id, profile_id, role) values (gid, ann, 'steward');

  perform set_config('test.uid', ben::text, true);
  insert into group_members (group_id, profile_id, role) values (gid, ben, 'member');

  ------------------------------------------------ only a member raises a word
  perform set_config('test.uid', cal::text, true);
  begin
    perform raise_term(gid, 'shared');
    fails := fails + 1;
    raise warning 'FAIL: somebody outside the group raised a word in it';
  exception when others then passes := passes + 1;
  end;

  perform set_config('test.uid', ann::text, true);
  tid := raise_term(gid, 'shared');
  if tid is not null then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a member could not raise a word'; end if;

  --------------------------------- and the same word twice is the same word
  -- Two people reaching for it independently is the signal, not a collision.
  perform set_config('test.uid', ben::text, true);
  other := raise_term(gid, '  Shared ');
  if other = tid then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: "Shared" and "shared" became two terms'; end if;

  select count(*)::int into n from terms where group_id = gid;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % terms exist where one word was raised', n; end if;

  ------------------------------------------------------------- a word has size
  perform set_config('test.uid', ann::text, true);
  begin
    perform raise_term(gid, 'x');
    fails := fails + 1;
    raise warning 'FAIL: a one-character term was accepted';
  exception when others then passes := passes + 1;
  end;

  begin
    perform raise_term(gid, repeat('long ', 40));
    fails := fails + 1;
    raise warning 'FAIL: a 200-character term was accepted';
  exception when others then passes := passes + 1;
  end;

  ------------------------------------------------------- nobody means anything
  select voices, yours into n, ok from group_lexicon(gid) where id = tid;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a word with no readings reported % voices', n; end if;
  if ok is false then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: yours was true before anybody wrote a reading'; end if;

  ------------------------------------------------------------ a reading has size
  begin
    perform write_reading(tid, 'shared');
    fails := fails + 1;
    raise warning 'FAIL: a six-character reading was accepted';
  exception when others then passes := passes + 1;
  end;

  begin
    perform write_reading(tid, repeat('word ', 200));
    fails := fails + 1;
    raise warning 'FAIL: a 1000-character reading was accepted';
  exception when others then passes := passes + 1;
  end;

  ------------------------------------------------- two people, two readings
  perform set_config('test.uid', ann::text, true);
  r := write_reading(tid, ann_says);
  if r = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a first reading was revision %', r; end if;

  perform set_config('test.uid', ben::text, true);
  r := write_reading(tid, ben_says);
  if r = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: Ben''s first reading was revision %', r; end if;

  select count(*)::int into n from readings_for(tid);
  if n = 2 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: readings_for returned % rows for two readings', n; end if;

  -- Both survive. This is the whole point: nothing merged them, nothing picked
  -- one, and the group now has a visible disagreement it did not have before.
  select count(distinct body)::int into n from readings_for(tid);
  if n = 2 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: two different readings collapsed to % distinct bodies', n; end if;

  select voices into n from group_lexicon(gid) where id = tid;
  if n = 2 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: voices was % with two people on the record', n; end if;

  -- and each of them is told which one is theirs, and only that
  perform set_config('test.uid', ann::text, true);
  select count(*)::int into n from readings_for(tid) where mine;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % readings came back as Ann''s own', n; end if;

  --------------------------------------------- a second reading is a revision
  r := write_reading(tid, 'Everyone on the row can use it. Name on the sheet '
                          'in the porch, and the sheet is only so two people '
                          'do not turn up for it on the same morning.');
  if r = 2 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a second reading was revision %', r; end if;

  -- The current one is the new one ...
  select body, revision, revised into b, n, ok
    from readings_for(tid) where profile_id = ann;
  if b like '%only so two people%' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: readings_for returned a stale revision'; end if;
  if n = 2 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: current revision reported as %', n; end if;
  if ok then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a revised reading did not say so'; end if;

  -- ... and there is still exactly one row per person on screen
  select count(*)::int into n from readings_for(tid);
  if n = 2 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a revision added a row to the current readings (% rows)', n; end if;

  -- ... and the old wording did not go anywhere
  select count(*)::int into n from reading_history(tid, ann);
  if n = 2 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: reading_history shows % revisions after one revision', n; end if;

  select body into b from reading_history(tid, ann) where revision = 1;
  if b = ann_says then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the first wording was not preserved verbatim'; end if;

  -- Ben, who has not revised, is not marked as having done
  select revised into ok from readings_for(tid) where profile_id = ben;
  if ok is false then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: an unrevised reading was marked revised'; end if;

  ------------------------------------------------- append-only, in the policies
  -- A reading you have changed your mind about is still a record of what you
  -- meant on a date. There is no update path and no delete path.
  begin
    update term_readings set body = 'Actually I meant a key each, obviously.'
     where term_id = tid and profile_id = ann and revision = 1;
    select count(*)::int into n from term_readings
     where term_id = tid and profile_id = ann and revision = 1
       and body like 'Actually%';
    if n = 0 then passes := passes + 1; else fails := fails + 1;
      raise warning 'FAIL: a reading was edited after the fact'; end if;
  exception when others then passes := passes + 1;
  end;

  begin
    delete from term_readings where term_id = tid and profile_id = ann;
    select count(*)::int into n from term_readings
     where term_id = tid and profile_id = ann;
    if n = 2 then passes := passes + 1; else fails := fails + 1;
      raise warning 'FAIL: readings were deleted (% left of 2)', n; end if;
  exception when others then passes := passes + 1;
  end;

  -- nor can a word be renamed under the readings that answered it
  begin
    update terms set term = 'communal' where id = tid;
    select count(*)::int into n from terms where id = tid and term = 'communal';
    if n = 0 then passes := passes + 1; else fails := fails + 1;
      raise warning 'FAIL: a term was renamed after readings were written'; end if;
  exception when others then passes := passes + 1;
  end;

  begin
    delete from terms where id = tid;
    select count(*)::int into n from terms where id = tid;
    if n = 1 then passes := passes + 1; else fails := fails + 1;
      raise warning 'FAIL: a term was deleted'; end if;
  exception when others then passes := passes + 1;
  end;

  ------------------------------------------- you cannot write in somebody's name
  begin
    insert into term_readings (term_id, profile_id, revision, body)
    values (tid, ben, 9, 'Ben definitely agrees with the sheet in the porch.');
    select count(*)::int into n from term_readings
     where term_id = tid and profile_id = ben and revision = 9;
    if n = 0 then passes := passes + 1; else fails := fails + 1;
      raise warning 'FAIL: Ann wrote a reading in Ben''s name'; end if;
  exception when others then passes := passes + 1;
  end;

  -- and write_reading() cannot be aimed at a revision that already exists,
  -- because it stamps the number itself and takes no argument for it
  select count(*)::int into n
    from pg_proc pp join pg_namespace ns on ns.oid = pp.pronamespace
   where ns.nspname = 'public' and pp.proname = 'write_reading'
     and pg_get_function_identity_arguments(pp.oid) = 'p_term_id uuid, p_body text';
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: write_reading does not take exactly (p_term_id, p_body)'; end if;

  ---------------------------------------------------- outside the group, nothing
  perform set_config('test.uid', cal::text, true);

  select count(*)::int into n from readings_for(tid);
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % readings leaked to somebody outside the group', n; end if;

  select count(*)::int into n from reading_history(tid, ann);
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % revisions leaked to somebody outside the group', n; end if;

  select count(*)::int into n from group_lexicon(gid);
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the lexicon listed % words to a non-member', n; end if;

  select count(*)::int into n from terms where group_id = gid;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the terms table itself leaked % rows', n; end if;

  select count(*)::int into n from term_readings where term_id = tid;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the term_readings table itself leaked % rows', n; end if;

  begin
    perform write_reading(tid, 'I have never been on this row and I have views.');
    fails := fails + 1;
    raise warning 'FAIL: a non-member wrote a reading';
  exception when others then passes := passes + 1;
  end;

  -- The functions are security definer, which is exactly how the last two of
  -- these leaked in this schema. If the membership check is ever dropped from
  -- one, the four assertions above go red rather than the feature going quiet.
  select count(*)::int into n
    from pg_proc pp join pg_namespace ns on ns.oid = pp.pronamespace
   where ns.nspname = 'public'
     and pp.proname in ('group_lexicon', 'readings_for', 'reading_history')
     and pp.prosecdef
     and pg_get_functiondef(pp.oid) ilike '%is_group_member%';
  if n = 3 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: only % of 3 definer functions carry their own membership check', n; end if;

  ------------------------------------------------------- Ask finds words too
  perform set_config('test.uid', ann::text, true);

  select count(*)::int into n from search_collective('shared', 20) where kind = 'term';
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: searching the word itself returned % terms', n; end if;

  -- and finds it by what somebody said about it, which is the useful half
  select count(*)::int into n from search_collective('put it back', 20) where kind = 'term';
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: searching a reading''s words returned % terms', n; end if;

  -- The search result counts the readings. It does not quote one, because
  -- quoting one is picking a winner in the one place this schema refuses to.
  select line into b from search_collective('shared', 20) where kind = 'term';
  if b like '%2 people%' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the search line for a term was "%"', b; end if;
  if b not like '%porch%' and b not like '%key%' then passes := passes + 1;
  else fails := fails + 1;
    raise warning 'FAIL: the search line quoted one person''s reading'; end if;

  perform set_config('test.uid', cal::text, true);
  select count(*)::int into n from search_collective('shared', 20) where kind = 'term';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: search surfaced % of another group''s words', n; end if;

  perform set_config('test.uid', ann::text, true);

  raise notice ' ';
  raise notice '  Lexicon: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then
    raise exception '% checks failed', fails;
  end if;
end $$;

-- =============================================================================
-- THE ABSENCES
--
-- Design decisions that are recorded as things the schema has nowhere to put.
-- Each of these would be a small, reasonable-looking addition, and each one
-- turns the collective interior back into the collective exterior.
-- =============================================================================

do $$
declare
  n int; passes int := 0; fails int := 0;
begin
  ------------------------------------- terms carry no definition of their own
  -- A definition column is a glossary, and a glossary overwrites the
  -- disagreement this feature exists to surface.
  select count(*)::int into n from information_schema.columns
   where table_schema = 'public' and table_name = 'terms'
     and column_name in ('definition', 'meaning', 'canonical', 'agreed',
                         'official', 'preferred', 'consensus', 'summary');
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: terms has % columns that hold the group''s answer', n; end if;

  --------------------------------------------- a reading is not a candidate
  select count(*)::int into n from information_schema.columns
   where table_schema = 'public' and table_name = 'term_readings'
     and column_name in ('votes', 'score', 'rank', 'weight', 'helpful',
                         'endorsed', 'accepted', 'agrees', 'agreement',
                         'confidence', 'status', 'verdict');
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: term_readings has % columns that make a reading a candidate', n; end if;

  -------------------------------------- nothing measures whether they agree
  -- The sharpest one. A similarity number over two people's sentences would
  -- put a figure on meaning, and the figure would be wrong in a way nobody
  -- could audit — while looking, on screen, exactly like a fact.
  select count(*)::int into n
    from pg_proc pp join pg_namespace ns on ns.oid = pp.pronamespace
   where ns.nspname = 'public'
     and pp.proname in ('term_agreement', 'reading_similarity',
                        'lexicon_divergence', 'term_consensus',
                        'readings_align', 'term_alignment');
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % functions exist that score how much two readings agree', n; end if;

  select count(*)::int into n
    from pg_proc pp join pg_namespace ns on ns.oid = pp.pronamespace
   where ns.nspname = 'public'
     and pp.proname in ('group_lexicon', 'readings_for')
     and pg_get_functiondef(pp.oid) ~* 'similarity|divergen|consensus|agree';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the lexicon functions have grown an agreement measure'; end if;

  --------------------------------------------------- append-only, in pg_policies
  select count(*)::int into n from pg_policies
   where schemaname = 'public' and tablename = 'term_readings'
     and cmd in ('UPDATE', 'DELETE');
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: term_readings has % update or delete policies', n; end if;

  select count(*)::int into n from pg_policies
   where schemaname = 'public' and tablename = 'terms'
     and cmd in ('UPDATE', 'DELETE');
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: terms has % update or delete policies', n; end if;

  ------------------------------------------- a word reaches no decision at all
  -- Looking a word up counts towards nothing. If close_proposal() or
  -- cast_resonance() ever consults a reading, a definition has become a vote.
  select count(*)::int into n
    from pg_proc pp join pg_namespace ns on ns.oid = pp.pronamespace
   where ns.nspname = 'public'
     and pp.proname in ('close_proposal', 'cast_resonance',
                        'can_reach_proposal', 'activate_proposal',
                        'alignment_shape', 'bind_proposal_readiness')
     and pg_get_functiondef(pp.oid) ~* 'term_readings|\mterms\M';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % decision functions read the lexicon', n; end if;

  --------------------------------------- and no term is attached to a proposal
  -- Matching a word against proposal text is a guess, and a wrong guess tells
  -- people a decision turned on a definition it never mentioned.
  select count(*)::int into n from information_schema.columns
   where table_schema = 'public' and table_name = 'terms'
     and column_name in ('proposal_id', 'decision_id', 'project_id');
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: terms is attached to a decision by % columns', n; end if;

  raise notice ' ';
  raise notice '  Lexicon (absences): % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then
    raise exception '% checks failed', fails;
  end if;
end $$;
