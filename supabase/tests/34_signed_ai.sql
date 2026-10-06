-- What the AI says is signed by the server (0040, rule 38).
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
  ('a1414141-4141-4141-4141-41414141414a', 'sig-author@example.com'),
  ('c1414141-4141-4141-4141-41414141414c', 'sig-reviewer@example.com');
insert into marketplace_reviewers (profile_id) values ('c1414141-4141-4141-4141-41414141414c');

-- Enforcement on.
insert into private.ai_signing_key (secret) values ('test-secret-test-secret-test-secret-0040');

create or replace function test_sign(p_kind text, p_payload text) returns text language sql as $$
  select encode(hmac(p_kind || E'\n' || p_payload, 'test-secret-test-secret-test-secret-0040', 'sha256'), 'hex');
$$;

set role app;

do $$
declare
  me uuid := 'a1414141-4141-4141-4141-41414141414a';
  payload text; v uuid; vet jsonb; readings jsonb; n int;
  passes int := 0; fails int := 0;
begin
  perform set_config('test.uid', me::text, true);

  -- The secret is unreadable.
  begin
    perform 1 from private.ai_signing_key;
    fails := fails + 1; raise warning 'FAIL: a member read the signing key';
  exception when others then passes := passes + 1; end;

  -- Direct writes are refused.
  begin
    insert into post_witness (author_id, body_sha256, first_hand, verdict, prompt_id, prompt_version, model)
    values (me, 'abc', 0.99, 'Forged.', 'post.witness', '1.1.0', 'forged');
    fails := fails + 1; raise warning 'FAIL: a witness reading was written directly';
  exception when others then passes := passes + 1; end;

  payload := jsonb_build_object('body_sha256', 'abc', 'first_hand', 0.9, 'verdict', 'Told straight.',
    'concerns', '[]'::jsonb, 'prompt_id', 'post.witness', 'prompt_version', '1.1.0', 'model', 'test',
    'issued_at', now())::text;

  -- No signature, a wrong one, and a stale one are refused.
  begin
    perform ai_write('post.witness', payload);
    fails := fails + 1; raise warning 'FAIL: an unsigned AI write was accepted';
  exception when others then passes := passes + 1; end;
  begin
    perform ai_write('post.witness', payload, repeat('0', 64));
    fails := fails + 1; raise warning 'FAIL: a wrong signature was accepted';
  exception when others then passes := passes + 1; end;
  begin
    perform ai_write('law.audit', payload, test_sign('post.witness', payload));
    fails := fails + 1; raise warning 'FAIL: a signature for one kind was accepted for another';
  exception when others then passes := passes + 1; end;
  declare stale text := jsonb_set(payload::jsonb, '{issued_at}', to_jsonb(now() - interval '1 hour'))::text;
  begin
    perform ai_write('post.witness', stale, test_sign('post.witness', stale));
    fails := fails + 1; raise warning 'FAIL: a stale signature was accepted';
  exception when others then passes := passes + 1; end;

  -- A good signature writes, as the person.
  perform ai_write('post.witness', payload, test_sign('post.witness', payload));
  select count(*)::int into n from post_witness where author_id = me and model = 'test';
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a signed witness reading was not written'; end if;

  -- A vetting cannot be replayed onto a business that has changed.
  select jsonb_agg(jsonb_build_object('law_id', 'law_' || i, 'verdict', 'aligned', 'reasoning', 'ok'))
    into readings from generate_series(1, 10) i;
  v := register_vendor('Signed Soap', 'Hand-made soap from a kitchen in the old bakery.',
    'Oils bought from a co-operative, everything weighed and labelled, two staff on the living wage '
    || 'and a full ingredient list published.', 'https://signed-soap.example');
  payload := jsonb_build_object('vendor_id', v, 'content_hash', vendor_current_hash(v), 'readings', readings,
    'prompt_id', 'marketplace.vetting', 'prompt_version', '1.0.0', 'model', 'test', 'issued_at', now())::text;
  update vendors set description = 'Now selling soap imported in bulk and relabelled as our own.' where id = v;
  begin
    perform ai_write('marketplace.vetting', payload, test_sign('marketplace.vetting', payload));
    fails := fails + 1; raise warning 'FAIL: an old clean vetting was replayed onto a changed business';
  exception when others then passes := passes + 1; end;

  payload := jsonb_set(payload::jsonb, '{content_hash}', to_jsonb(vendor_current_hash(v)))::text;
  vet := ai_write('marketplace.vetting', payload, test_sign('marketplace.vetting', payload));
  if vet ? 'id' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a fresh signed vetting was not written'; end if;

  raise notice ' ';
  raise notice '  Signed AI: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;

reset role;
-- Enforcement off again for whatever runs after.
delete from private.ai_signing_key;
drop function test_sign(text, text);

set role app;
do $$
begin
  perform set_config('test.uid', 'a1414141-4141-4141-4141-41414141414a', true);
  insert into post_witness (author_id, body_sha256, first_hand, verdict, prompt_id, prompt_version, model)
  values ('a1414141-4141-4141-4141-41414141414a', 'def', 0.9, 'Unenforced.', 'post.witness', '1.1.0', 'test');
  raise notice '  Signed AI (off without a key): 1 passed, 0 failed';
end $$;
reset role;
