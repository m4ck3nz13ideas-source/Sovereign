-- Inquiry: a survey of positions, and every structural reason it cannot
-- quietly become an answer.
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
  ('c1000001-0000-0000-0000-000000000000', 'inq1@example.com'),
  ('c1000002-0000-0000-0000-000000000000', 'inq2@example.com'),
  ('c1000003-0000-0000-0000-000000000000', 'inq3@example.com');

set role app;

do $$
declare
  ann uuid := 'c1000001-0000-0000-0000-000000000000';
  ben uuid := 'c1000002-0000-0000-0000-000000000000';
  cal uuid := 'c1000003-0000-0000-0000-000000000000';
  pid uuid; iid uuid; n int; msg text;
  passes int := 0; fails int := 0;
  two jsonb := '[
    {"lens":"empirical","claim":"Shared-tool schemes survive where one household is named as keeper and fail where the duty rotates.","reasoning":"The commons literature finds monitoring cost, not goodwill, is the binding constraint on small shared assets.","source_hint":"Ostrom, Governing the Commons"},
    {"lens":"practice","claim":"Tool libraries in practice put the item with whoever has the dryest shed and the least objection to being knocked on.","reasoning":"Operators report that storage volunteers, not borrowers, are the scarce input.","source_hint":"Library of Things operators"}
  ]'::jsonb;
  one jsonb := '[
    {"lens":"empirical","claim":"Shared-tool schemes survive where one household is named as keeper of the thing.","reasoning":"Monitoring cost rather than goodwill is the binding constraint here."}
  ]'::jsonb;
  same_lens jsonb := '[
    {"lens":"empirical","claim":"Shared-tool schemes survive where one household is named as the keeper.","reasoning":"Monitoring cost rather than goodwill is the binding constraint on this."},
    {"lens":"empirical","claim":"Rotating custody of a shared item predicts its disappearance within a year.","reasoning":"Diffuse responsibility is repeatedly the failure mode in the same literature."}
  ]'::jsonb;
begin
  perform set_config('test.uid', ann::text, true);
  update profiles set place_local = 'Inquiry Row', place_national = 'United Kingdom',
                      place_set_at = now() where id = ann;
  perform set_config('test.uid', ben::text, true);
  update profiles set place_local = 'Inquiry Row', place_national = 'United Kingdom',
                      place_set_at = now() where id = ben;
  -- Cal is somewhere else entirely, and so this proposal is not addressed to him.
  perform set_config('test.uid', cal::text, true);
  update profiles set place_local = 'Another Street', place_national = 'United Kingdom',
                      place_set_at = now() where id = cal;

  perform set_config('test.uid', ann::text, true);
  pid := test_propose(ann, null, 'local', 'Inquiry Row',
                      'One ladder between six houses', 'Buy one and share it.',
                      'Everyone on the row owns a ladder and uses it about twice a year each.');

  ------------------------------------------------ a survey of one is an answer
  begin
    perform record_inquiry(pid, 'Does sharing a tool between households work?',
                           null, 'inquiry.positions', '1.0.0', 'test', one);
    fails := fails + 1;
    raise warning 'FAIL: a single position was recorded as an inquiry';
  exception when others then passes := passes + 1;
  end;

  begin
    perform record_inquiry(pid, 'Does sharing a tool between households work?',
                           null, 'inquiry.positions', '1.0.0', 'test', '[]'::jsonb);
    fails := fails + 1;
    raise warning 'FAIL: an empty survey was recorded';
  exception when others then passes := passes + 1;
  end;

  ------------------------------- and two positions from one lens is still one
  begin
    perform record_inquiry(pid, 'Does sharing a tool between households work?',
                           null, 'inquiry.positions', '1.0.0', 'test', same_lens);
    fails := fails + 1;
    raise warning 'FAIL: two positions from a single lens passed as a survey';
  exception when others then passes := passes + 1;
  end;

  select count(*)::int into n from inquiries;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % inquiries survived calls that should have failed whole', n; end if;

  ----------------------------------------------------- two lenses is a survey
  iid := record_inquiry(pid, 'Does sharing a tool between households work?',
                        'Nothing here speaks to a row of six specifically.',
                        'inquiry.positions', '1.0.0', 'test', two);

  select count(*)::int into n from positions_for(iid);
  if n = 2 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % positions recorded, expected 2', n; end if;

  select lenses into n from inquiries_for(pid) where id = iid;
  if n = 2 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the inquiry reports % lenses rather than 2', n; end if;

  ------------------------------------ order is the order it came, not a ranking
  select lens::text into msg from positions_for(iid) order by ordinal limit 1;
  if msg = 'empirical' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: positions came back reordered (% first)', msg; end if;

  --------------------------- and there is nowhere to record which one is right
  select count(*)::int into n
    from information_schema.columns
   where table_name = 'positions'
     and column_name in ('score', 'rank', 'weight', 'confidence', 'verdict',
                         'correct', 'best', 'strength', 'answer');
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: positions grew % columns that turn a survey into an answer', n;
  end if;

  select count(*)::int into n
    from information_schema.columns
   where table_name = 'inquiries'
     and column_name in ('answer', 'conclusion', 'verdict', 'synthesis', 'resolved');
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: inquiries grew % columns that make it an oracle', n; end if;

  ------------------------------------------- a position cannot be edited later
  begin
    update positions set claim = 'Something else entirely, rewritten afterwards.'
     where inquiry_id = iid;
  exception when others then null;
  end;
  select count(*)::int into n from positions
   where inquiry_id = iid and claim like 'Something else entirely%';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a recorded position was rewritten'; end if;

  select count(*)::int into n
    from pg_policies
   where schemaname = 'public' and tablename in ('positions', 'inquiries')
     and cmd = 'UPDATE';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % update policies exist on the inquiry tables', n; end if;

  ---------------------------- nor written except through the function
  begin
    insert into positions (inquiry_id, lens, claim, reasoning)
    values (iid, 'scripture', 'A position somebody typed straight into the table.',
            'Which would let one lens be added to a survey after the fact.');
  exception when others then null;
  end;
  select count(*)::int into n from positions where inquiry_id = iid;
  if n = 2 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a position was inserted outside record_inquiry — % rows now', n; end if;

  ------------------------------------------- read follows the proposal
  perform set_config('test.uid', ben::text, true);
  select count(*)::int into n from inquiries_for(pid);
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: somebody the proposal IS addressed to saw % inquiries', n; end if;

  select count(*)::int into n from positions_for(iid);
  if n = 2 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a member of the same place read % positions', n; end if;

  perform set_config('test.uid', cal::text, true);
  select count(*)::int into n from inquiries;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: somebody outside the address read % inquiries', n; end if;

  select count(*)::int into n from positions;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: somebody outside the address read % positions', n; end if;

  begin
    perform record_inquiry(pid, 'Can I ask about a proposal that is not mine?',
                           null, 'inquiry.positions', '1.0.0', 'test', two);
    fails := fails + 1;
    raise warning 'FAIL: somebody outside the address asked a question on it';
  exception when others then passes := passes + 1;
  end;

  --------------------------------- the asker may withdraw, nobody else may
  perform set_config('test.uid', ben::text, true);
  delete from inquiries where id = iid;
  perform set_config('test.uid', ann::text, true);
  select count(*)::int into n from inquiries_for(pid);
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: somebody else withdrew an inquiry that was not theirs'; end if;

  delete from inquiries where id = iid;
  select count(*)::int into n from inquiries_for(pid);
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the asker could not withdraw their own'; end if;

  select count(*)::int into n from positions where inquiry_id = iid;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % positions outlived the inquiry they belonged to', n; end if;

  ------------------------------------------- and it reaches nothing at all
  select count(*)::int into n from ledger_events where kind like '%inquir%';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % inquiry events reached the public ledger', n; end if;

  select count(*)::int into n
    from information_schema.columns
   where table_name in ('proposals', 'decisions')
     and (column_name like '%inquir%' or column_name like '%position%');
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: inquiry grew % columns on proposals or decisions', n; end if;

  select count(*)::int into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public'
     and p.proname in ('close_proposal', 'cast_resonance', 'can_reach_proposal')
     and pg_get_functiondef(p.oid) ilike '%inquir%';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % decision functions read inquiries — looking something up must not count towards anything', n;
  end if;

  raise notice ' ';
  raise notice '  Inquiry: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then
    raise exception '% checks failed', fails;
  end if;
end $$;

reset role;
