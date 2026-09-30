-- Lineage: a second attempt names the first, says what it changed, cannot be
-- re-pointed afterwards, and reaches no decision anywhere.
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
  ('e1000001-0000-0000-0000-000000000000', 'lin1@example.com'),
  ('e1000002-0000-0000-0000-000000000000', 'lin2@example.com'),
  ('e1000003-0000-0000-0000-000000000000', 'lin3@example.com');

set role app;

do $$
declare
  ann uuid := 'e1000001-0000-0000-0000-000000000000';
  ben uuid := 'e1000002-0000-0000-0000-000000000000';
  -- Cal is on another street, so nothing here is addressed to him.
  cal uuid := 'e1000003-0000-0000-0000-000000000000';
  first_id uuid; second_id uuid; third_id uuid; anc uuid; n int; t text; g int;
  passes int := 0; fails int := 0;
  why text := 'Same ladder, but stored at number 6 rather than rotating, because rotating custody is what failed last time.';
begin
  perform set_config('test.uid', ann::text, true);
  update profiles set place_local = 'Lineage Row', place_national = 'United Kingdom',
                      place_set_at = now() where id = ann;
  perform set_config('test.uid', ben::text, true);
  update profiles set place_local = 'Lineage Row', place_national = 'United Kingdom',
                      place_set_at = now() where id = ben;
  perform set_config('test.uid', cal::text, true);
  update profiles set place_local = 'Another Row', place_national = 'United Kingdom',
                      place_set_at = now() where id = cal;

  perform set_config('test.uid', ann::text, true);
  first_id := test_propose(ann, null, 'local', 'Lineage Row',
                'One ladder between six houses', 'Buy one and rotate who keeps it.',
                'Everyone owns a ladder and uses it twice a year.');

  ---------------------------------------------- a plain proposal has no parent
  select count(*)::int into n from proposals
   where id = first_id and supersedes is null and supersedes_reason is null;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a proposal with no parent did not come back clean'; end if;

  select count(*)::int into n from proposal_lineage(first_id);
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: an unforked proposal reported % ancestors', n; end if;

  -------------------------------------------- a second attempt needs a reason
  perform set_config('test.uid', ben::text, true);
  begin
    perform test_propose(ben, null, 'local', 'Lineage Row',
              'One ladder, kept at number 6', 'Same idea, fixed custody.',
              'Rotating custody is what failed.', null, null, 0.820,
              null, null, null, first_id, null);
    fails := fails + 1;
    raise warning 'FAIL: a second attempt was accepted with no reason given';
  exception when others then passes := passes + 1;
  end;

  begin
    perform test_propose(ben, null, 'local', 'Lineage Row',
              'One ladder, kept at number 6', 'Same idea, fixed custody.',
              'Rotating custody is what failed.', null, null, 0.820,
              null, null, null, first_id, 'too short');
    fails := fails + 1;
    raise warning 'FAIL: a nine-character reason was accepted';
  exception when others then passes := passes + 1;
  end;

  ----------------------------------------- and a reason needs a fork to attach to
  begin
    perform test_propose(ben, null, 'local', 'Lineage Row',
              'An orphan reason', 'No parent named.', 'Nothing to fork from.',
              null, null, 0.820, null, null, null, null, why);
    fails := fails + 1;
    raise warning 'FAIL: a reason was accepted with no parent';
  exception when others then passes := passes + 1;
  end;

  --------------------------------------------------- superseding something you can reach works
  second_id := test_propose(ben, null, 'local', 'Lineage Row',
                 'One ladder, kept at number 6', 'Same idea, fixed custody.',
                 'Rotating custody of a shared item is what failed last time.',
                 null, null, 0.820, null, null, null, first_id, why);
  if second_id is not null then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a member could not supersede a proposal addressed to them'; end if;

  select count(*)::int into n from proposal_lineage(second_id);
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the fork reported % ancestors, expected 1', n; end if;

  select id, generation into anc, g from proposal_lineage(second_id);
  if anc = first_id then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the ancestor was not the parent'; end if;
  if g = -1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the parent was generation % rather than -1', g; end if;

  -- and the parent can see what came from it
  select count(*)::int into n from proposal_successors(first_id);
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the parent reported % descendants', n; end if;

  select changed into t from proposal_successors(first_id);
  if t = why then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the reason did not survive to the parent''s page'; end if;

  -- a proposal is not a successor of itself, and has none of its own yet
  select count(*)::int into n from proposal_successors(second_id);
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a fresh attempt reported % descendants', n; end if;

  ------------------------------------------------------- three deep, in order
  perform set_config('test.uid', ann::text, true);
  third_id := test_propose(ann, null, 'local', 'Lineage Row',
                'One ladder, and a second for the far end',
                'Two ladders, one at each end of the row.',
                'One ladder at number 6 is four doors from number 14.',
                null, null, 0.820, null, null, null, second_id,
                'Two ladders rather than one, because one at number 6 is four doors from the far end of the row.');

  select count(*)::int into n from proposal_lineage(third_id);
  if n = 2 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a three-deep chain reported % ancestors', n; end if;

  -- oldest first: the original is further from you than its fork
  select id into t from (select id, generation from proposal_lineage(third_id) order by generation) z limit 1;
  if t::uuid = first_id then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: lineage did not come back oldest first'; end if;

  select count(*)::int into n from proposal_lineage(third_id) where generation = -2;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the grandparent was not at generation -2'; end if;

  ------------------------------------------------- nothing descends from itself
  begin
    update proposals set supersedes = id where id = first_id;
    select count(*)::int into n from proposals where id = first_id and supersedes = first_id;
    if n = 0 then passes := passes + 1; else fails := fails + 1;
      raise warning 'FAIL: a proposal became its own parent'; end if;
  exception when others then passes := passes + 1;
  end;

  --------------------------------------------------- and the link never moves
  begin
    update proposals set supersedes = null where id = second_id;
    select count(*)::int into n from proposals where id = second_id and supersedes = first_id;
    if n = 1 then passes := passes + 1; else fails := fails + 1;
      raise warning 'FAIL: a link was removed after submission'; end if;
  exception when others then passes := passes + 1;
  end;

  begin
    update proposals set supersedes = third_id where id = second_id;
    select count(*)::int into n from proposals where id = second_id and supersedes = first_id;
    if n = 1 then passes := passes + 1; else fails := fails + 1;
      raise warning 'FAIL: a link was re-pointed after submission'; end if;
  exception when others then passes := passes + 1;
  end;

  begin
    update proposals set supersedes_reason = 'Actually it was about something else entirely, honestly.'
     where id = second_id;
    select count(*)::int into n from proposals where id = second_id and supersedes_reason = why;
    if n = 1 then passes := passes + 1; else fails := fails + 1;
      raise warning 'FAIL: a reason was rewritten after submission'; end if;
  exception when others then passes := passes + 1;
  end;

  ------------------------------------- you cannot fork what is not addressed to you
  perform set_config('test.uid', cal::text, true);
  begin
    perform test_propose(cal, null, 'local', 'Another Row',
              'A ladder for a street I am on', 'Forked from somewhere else.',
              'I am not on Lineage Row.', null, null, 0.820,
              null, null, null, first_id,
              'Forking a proposal from a street I have never set foot on, which should not be possible.');
    fails := fails + 1;
    raise warning 'FAIL: somebody outside the address superseded a proposal';
  exception when others then passes := passes + 1;
  end;

  -- nor a parent that does not exist at all
  perform set_config('test.uid', ann::text, true);
  begin
    perform test_propose(ann, null, 'local', 'Lineage Row',
              'A fork of nothing', 'Parent is invented.', 'There is no such row.',
              null, null, 0.820, null, null, null,
              'ffffffff-ffff-ffff-ffff-ffffffffffff',
              'Naming a parent that does not exist, which the trigger should refuse before anything else.');
    fails := fails + 1;
    raise warning 'FAIL: a second attempt named a parent that does not exist';
  exception when others then passes := passes + 1;
  end;

  ------------------------------------------- and the chain is cut where reach ends
  -- Cal can read nothing on Lineage Row, so he gets no lineage at all rather
  -- than a redacted one — "there is one more you cannot see" is a disclosure.
  perform set_config('test.uid', cal::text, true);
  select count(*)::int into n from proposal_lineage(third_id);
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % ancestors leaked to somebody outside the address', n; end if;

  select count(*)::int into n from proposal_successors(first_id);
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % descendants leaked to somebody outside the address', n; end if;

  perform set_config('test.uid', ann::text, true);

  raise notice ' ';
  raise notice '  Lineage: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then
    raise exception '% checks failed', fails;
  end if;
end $$;

-- =============================================================================
-- WHAT LINEAGE DOES NOT TOUCH
-- =============================================================================

do $$
declare
  n int; passes int := 0; fails int := 0;
begin
  ------------------------------------------- ancestry is not evidence of merit
  -- A second attempt that inherited any of its parent's standing would be a
  -- system that rewards persistence over quality.
  select count(*)::int into n
    from pg_proc pp join pg_namespace ns on ns.oid = pp.pronamespace
   where ns.nspname = 'public'
     and pp.proname in ('close_proposal', 'cast_resonance', 'can_reach_proposal',
                        'activate_proposal', 'alignment_shape',
                        'bind_proposal_readiness', 'resonance_summary')
     and pg_get_functiondef(pp.oid) ~* 'supersedes';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % decision functions read a proposal''s ancestry', n; end if;

  ------------------------------- rule 12 is answered by the link, not the reason
  -- dormant_proposals() reads `supersedes` on purpose: a proposal somebody has
  -- already taken up again must stop being offered back, or the system is
  -- offering two versions of one idea at once. What it must NOT read is the
  -- reason. Whether something is re-offered turns on whether anybody acted, not
  -- on how well they explained themselves.
  select count(*)::int into n
    from pg_proc pp join pg_namespace ns on ns.oid = pp.pronamespace
   where ns.nspname = 'public' and pp.proname = 'dormant_proposals'
     and pg_get_functiondef(pp.oid) ~* 'supersedes_reason';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: dormant_proposals reads the stated reason'; end if;

  select count(*)::int into n
    from pg_proc pp join pg_namespace ns on ns.oid = pp.pronamespace
   where ns.nspname = 'public' and pp.proname = 'dormant_proposals'
     and pg_get_functiondef(pp.oid) ~* 'supersedes';
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: dormant_proposals no longer excludes what was taken up'; end if;

  ------------------------------------------------ a second attempt is not a contention
  -- Two forks of one parent can both pass. If the contention machinery ever
  -- infers a clash from shared ancestry, it is telling people two unrelated
  -- proposals are alternatives, which is worse than saying nothing.
  select count(*)::int into n
    from pg_proc pp join pg_namespace ns on ns.oid = pp.pronamespace
   where ns.nspname = 'public'
     and pp.proname in ('record_contention', 'resolve_contention_if_ready',
                        'contention_standing')
     and pg_get_functiondef(pp.oid) ~* 'supersedes|supersedes_reason';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % contention functions infer a clash from ancestry', n; end if;

  ------------------------------------------------- no fork count on a person
  select count(*)::int into n
    from pg_proc pp join pg_namespace ns on ns.oid = pp.pronamespace
   where ns.nspname = 'public'
     and pp.proname in ('person_standing', 'find_person', 'people_feed')
     and pg_get_functiondef(pp.oid) ~* 'supersedes|supersedes_reason';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: lineage reached a person''s record'; end if;

  ------------------------------- the columns exist and carry no extra baggage
  select count(*)::int into n from information_schema.columns
   where table_schema = 'public' and table_name = 'proposals'
     and column_name in ('fork_count', 'forks', 'superseded_by',
                         'generation', 'lineage_score', 'attempt_number');
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: proposals grew % denormalised lineage columns', n; end if;

  -- Both triggers are in place. Without the freeze, every assertion about
  -- history above becomes decoration.
  select count(*)::int into n from pg_trigger
   where tgrelid = 'proposals'::regclass and not tgisinternal
     and tgname in ('proposals_freeze_lineage', 'proposals_check_supersedes');
  if n = 2 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: only % of 2 lineage triggers exist', n; end if;

  raise notice ' ';
  raise notice '  Lineage (absences): % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then
    raise exception '% checks failed', fails;
  end if;
end $$;

reset role;
