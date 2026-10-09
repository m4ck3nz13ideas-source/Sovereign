-- Accession: agreeing to the ten, to a named wording, with no way to edit the
-- record afterwards and no gate hanging off it.
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
  ('b1000001-0000-0000-0000-000000000000', 'accede1@example.com'),
  ('b1000002-0000-0000-0000-000000000000', 'accede2@example.com'),
  ('b1000003-0000-0000-0000-000000000000', 'accede3@example.com');

create temp table t16 (pid uuid);
grant all on t16 to app;

set role app;

do $$
declare
  ann uuid := 'b1000001-0000-0000-0000-000000000000';
  ben uuid := 'b1000002-0000-0000-0000-000000000000';
  -- A third, used only for the nine-of-ten case: giving Ben partial
  -- acceptances would make the later "nobody else can read yours" checks
  -- ambiguous, since his own rows are legitimately his to read.
  cal uuid := 'b1000003-0000-0000-0000-000000000000';
  n int; d timestamptz; flag boolean; pid uuid; msg text;
  passes int := 0; fails int := 0;
  ten text[] := array[
    'sanctity_of_life','truth_and_transparency','sovereignty_of_the_individual',
    'equity_and_justice','subsidiarity','reciprocity_and_mutual_care',
    'stewardship_of_earth','harmony_of_diversity','right_use_of_power',
    'continuous_evolution'];
begin
  perform set_config('test.uid', ann::text, true);
  update profiles set place_local = 'Accession Row', place_national = 'United Kingdom',
                      place_set_at = now()
   where id = ann;
  perform set_config('test.uid', ben::text, true);
  update profiles set place_local = 'Accession Row', place_national = 'United Kingdom',
                      place_set_at = now()
   where id = ben;
  perform set_config('test.uid', ann::text, true);

  ------------------------------------------------- nothing agreed at the start
  select laws_agreed into n from accession_standing();
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % laws already agreed before anybody agreed', n; end if;

  --------------------------------------- a partial constitution is not accepted
  begin
    perform accept_universal_law(ten[1:9]);
    fails := fails + 1;
    raise warning 'FAIL: nine laws were accepted as the constitution';
  exception when others then passes := passes + 1;
  end;

  begin
    perform accept_universal_law(array[]::text[]);
    fails := fails + 1;
    raise warning 'FAIL: an empty constitution was accepted';
  exception when others then passes := passes + 1;
  end;

  ---------------------------------------------- and duplicates are not padding
  begin
    perform accept_universal_law(array['subsidiarity','subsidiarity','subsidiarity',
      'subsidiarity','subsidiarity','subsidiarity','subsidiarity','subsidiarity',
      'subsidiarity','subsidiarity']);
    fails := fails + 1;
    raise warning 'FAIL: one law repeated ten times passed as ten laws';
  exception when others then passes := passes + 1;
  end;

  --------------------------------------- onboarding is gated on having agreed
  -- Ben has agreed to nothing. Finishing onboarding is the one claim that
  -- cannot be true for him yet, and the interface is not what enforces it.
  perform set_config('test.uid', ben::text, true);
  begin
    update profiles set onboarded_at = now() where id = ben;
    fails := fails + 1;
    raise warning 'FAIL: somebody finished onboarding without agreeing to anything';
  exception when others then passes := passes + 1;
  end;

  select count(*)::int into n from profiles where id = ben and onboarded_at is not null;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: onboarded_at was set despite the refusal'; end if;

  -- Nine of ten is not the constitution either. accept_universal_law() will
  -- not write nine, but a direct insert can, and the gate must not be
  -- satisfied by it.
  perform set_config('test.uid', cal::text, true);
  insert into law_acceptances (profile_id, law_id, revision)
  select cal, x, 1 from unnest(ten[1:9]) as x;

  begin
    update profiles set onboarded_at = now() where id = cal;
    fails := fails + 1;
    raise warning 'FAIL: nine agreed laws let somebody finish onboarding';
  exception when others then passes := passes + 1;
  end;

  -- And other updates to a profile are untouched by any of this. The gate is
  -- on arriving, not on existing.
  perform set_config('test.uid', ben::text, true);
  update profiles set display_name = 'Ben, still reading' where id = ben;
  select count(*)::int into n from profiles
   where id = ben and display_name = 'Ben, still reading';
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the accession gate blocked an ordinary profile update'; end if;

  perform set_config('test.uid', ann::text, true);

  ------------------------------------------------------------ ten is accepted
  select accept_universal_law(ten) into n;
  if n = 10 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: accepting ten laws wrote % rows', n; end if;

  select laws_agreed into n from accession_standing();
  if n = 10 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: standing reports % laws agreed, expected 10', n; end if;

  -- Having agreed to all ten (and consented, 0045), she can arrive.
  perform record_consent(array['special_category', 'adult']);
  update profiles set onboarded_at = now() where id = ann;
  select count(*)::int into n from profiles where id = ann and onboarded_at is not null;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: somebody who agreed to all ten could not finish onboarding'; end if;

  ------------------------------------ and the app can tell the two cases apart
  select ready into flag from accession_ready();
  if flag then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: accession_ready() says the database is not migrated when it is'; end if;

  select missing into msg from accession_ready();
  if msg is null then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: accession_ready() named a missing object (%) on a migrated database', msg; end if;

  ------------------------------------- the revision is stamped, not passed in
  select accepted_revision into n from my_law_accession() where law_id = 'subsidiarity';
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: agreed revision recorded as % rather than 1', n; end if;

  select amended_since into flag from my_law_accession() where law_id = 'subsidiarity';
  if not flag then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a law nobody has amended reads as amended'; end if;

  select count(*)::int into n from my_law_accession() where amended_since;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % laws read as amended before any amendment', n; end if;

  ------------------------------------------------ agreeing twice changes nothing
  select accept_universal_law(ten) into n;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: agreeing a second time wrote % more rows', n; end if;

  select count(*)::int into n from law_acceptances where profile_id = ann;
  if n = 10 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % acceptance rows after agreeing twice, expected 10', n; end if;

  ------------------------------------------- it cannot be edited afterwards
  select accepted_at into d from my_law_accession() where law_id = 'subsidiarity';
  begin
    update law_acceptances set accepted_at = now() - interval '400 days'
     where profile_id = ann and law_id = 'subsidiarity';
  exception when others then null;
  end;
  select count(*)::int into n from law_acceptances
   where profile_id = ann and law_id = 'subsidiarity' and accepted_at < now() - interval '300 days';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: an acceptance date was rewritten'; end if;

  begin
    delete from law_acceptances where profile_id = ann and law_id = 'subsidiarity';
  exception when others then null;
  end;
  select count(*)::int into n from law_acceptances where profile_id = ann;
  if n = 10 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: an acceptance was deleted — % rows remain', n; end if;

  select count(*)::int into n
    from pg_policies
   where schemaname = 'public' and tablename = 'law_acceptances'
     and cmd in ('UPDATE', 'DELETE');
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: law_acceptances grew % update or delete policies', n; end if;

  ----------------------------------------- it is nobody else's to read or write
  perform set_config('test.uid', ben::text, true);
  select count(*)::int into n from law_acceptances where profile_id = ann;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: another person read % of somebody''s acceptances', n; end if;

  select laws_agreed into n from accession_standing();
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: accession_standing leaked somebody else''s agreement'; end if;

  begin
    insert into law_acceptances (profile_id, law_id, revision) values (ann, 'subsidiarity', 9);
  exception when others then null;
  end;
  select count(*)::int into n from law_acceptances where profile_id = ann and revision = 9;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: one person recorded an agreement in another''s name'; end if;

  perform set_config('test.uid', ann::text, true);

  ---------------------------------------- accession gates nothing, by design
  select count(*)::int into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public'
     and p.proname in ('can_reach_proposal', 'cast_resonance')
     and pg_get_functiondef(p.oid) ilike '%law_acceptances%';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % eligibility functions now read law_acceptances — accession is not a permission system', n;
  end if;

  -- A proposal for the amendment block below to hang a revision off.
  pid := test_propose(ann, null, 'local', 'Accession Row',
                      'Something to amend from', 'Any proposal will do here.',
                      'This exists only so a law revision has a proposal to point at in the test.');
  insert into t16 (pid) values (pid);

  raise notice ' ';
  raise notice '  Accession (before amendment): % passed, % failed', passes, fails;
  if fails > 0 then
    raise exception '% checks failed', fails;
  end if;
end $$;

reset role;

-- An amendment lands. law_revisions is written only by enact_amendment(), which
-- needs a whole passed proposal at every voice — so the row goes in here as the
-- owner rather than rebuilding that in this suite. 13_amendment covers the bar.
insert into law_revisions (law_id, revision, text, violation_looks_like, adopted_from)
select 'subsidiarity', 2,
       'Decisions must be made at the lowest scale that can carry them, with solidarity at higher scales when a challenge is genuinely shared.',
       'The proposal decides at a scale above the one that can actually carry it, and offers no shared challenge that would justify the reach.',
       pid
  from t16;

set role app;

do $$
declare
  ann uuid := 'b1000001-0000-0000-0000-000000000000';
  n int; flag boolean;
  passes int := 0; fails int := 0;
  ten text[] := array[
    'sanctity_of_life','truth_and_transparency','sovereignty_of_the_individual',
    'equity_and_justice','subsidiarity','reciprocity_and_mutual_care',
    'stewardship_of_earth','harmony_of_diversity','right_use_of_power',
    'continuous_evolution'];
begin
  perform set_config('test.uid', ann::text, true);

  ------------------------- the law moved, and the record says so without drama
  select amended_since into flag from my_law_accession() where law_id = 'subsidiarity';
  if flag then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a law amended since agreement does not read as amended'; end if;

  select amended_since into n from accession_standing();
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: standing reports % amended since, expected 1', n; end if;

  select accepted_revision into n from my_law_accession() where law_id = 'subsidiarity';
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the earlier agreement now claims revision % — it was made against 1', n; end if;

  ----------------------------------- a law nobody touched is unaffected by it
  select amended_since into flag from my_law_accession() where law_id = 'sanctity_of_life';
  if not flag then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: amending one law marked another as amended'; end if;

  ------------------------------------ agreeing again records the new wording
  select accept_universal_law(ten) into n;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: re-agreeing after one amendment wrote % rows, expected 1', n; end if;

  select amended_since into n from accession_standing();
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % laws still read as amended after re-agreeing', n; end if;

  ------------------------------- and the old agreement is still on the record
  select count(*)::int into n from law_acceptances
   where profile_id = ann and law_id = 'subsidiarity';
  if n = 2 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % rows for the amended law — agreeing to revision 2 should not erase revision 1', n;
  end if;

  select count(*)::int into n from law_acceptances
   where profile_id = ann and law_id = 'subsidiarity' and revision = 1;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the agreement to the original wording is gone'; end if;

  select laws_agreed into n from accession_standing();
  if n = 10 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: standing counts % laws rather than 10 after a re-agreement', n; end if;

  ------------------- an amendment does not put a person back through the door
  -- The gate fires on arriving and only on arriving. Somebody already in stays
  -- in when a law's wording moves; they are told, and what they do about it is
  -- theirs.
  update profiles set display_name = 'Ann, after the amendment' where id = ann;
  select count(*)::int into n from profiles
   where id = ann and display_name = 'Ann, after the amendment';
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: an amendment blocked an ordinary update for somebody already onboarded'; end if;

  select count(*)::int into n from profiles where id = ann and onboarded_at is not null;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: an amendment un-onboarded somebody who had already arrived'; end if;

  raise notice ' ';
  raise notice '  Accession (after amendment): % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then
    raise exception '% checks failed', fails;
  end if;
end $$;

reset role;
