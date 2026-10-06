-- 0040 — What the AI says is signed by the server (rule 38).
--
-- Until now an AI artefact — a review, a Universal Law reading, a post's
-- witness reading, a proposal's conditions, a business's vetting — was written
-- by the server action running as the signed-in person. That made it
-- forgeable: somebody who called the database directly could write a clean
-- law reading for their own proposal, or soft conditions, or a passing
-- vetting for their own business.
--
-- Now every one of them goes through `ai_write()`, carrying an HMAC-SHA256
-- signature made by the server with a secret only the server and this
-- database know. The database checks it, checks it is fresh, and only then
-- writes — as the person, so every existing policy and check still applies.
-- A write of any of those tables that did not come through a valid signature
-- is refused by trigger.
--
-- THE SECRET lives in `private.ai_signing_key`, a schema the API does not
-- expose and no role but the owner can read, and in Vercel as
-- AI_SIGNING_SECRET. Enforcement starts the moment the row exists. Until then
-- (and in the test suites) signatures are optional and everything behaves as
-- before — set the Vercel variable first, then the database row, so there is
-- no window in which the live site cannot write.
--
-- REPLAY. A signature covers the whole payload, which names its subject and
-- carries `issued_at`; anything older than fifteen minutes is refused. A
-- vetting also carries the hash of the business it read, so an old clean
-- reading cannot be replayed after the business rewrites itself.

create schema if not exists private;
revoke all on schema private from public;

create table if not exists private.ai_signing_key (
  only_row boolean primary key default true check (only_row),
  secret   text not null check (length(secret) >= 32)
);
revoke all on private.ai_signing_key from public;

create or replace function signing_required()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (select 1 from private.ai_signing_key);
$$;

create or replace function ai_signature_valid(p_kind text, p_payload text, p_sig text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private, extensions
as $$
declare k text; issued timestamptz;
begin
  select secret into k from private.ai_signing_key;
  if k is null then return true; end if;           -- not enforced yet
  if p_sig is null then return false; end if;
  if encode(hmac(p_kind || E'\n' || p_payload, k, 'sha256'), 'hex') <> lower(p_sig) then
    return false;
  end if;
  issued := (p_payload::jsonb ->> 'issued_at')::timestamptz;
  return issued is not null and issued > now() - interval '15 minutes' and issued < now() + interval '1 minute';
end;
$$;

revoke all on function signing_required(), ai_signature_valid(text, text, text) from public;
grant execute on function signing_required(), ai_signature_valid(text, text, text) to authenticated;

-- Set only inside ai_write(), for the rest of that transaction.
create or replace function ai_write_in_progress()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('sovereign.ai_signed', true), '') = 'on';
$$;

create or replace function refuse_unsigned_ai()
returns trigger
language plpgsql
as $$
begin
  if signing_required() and not ai_write_in_progress() then
    raise exception '% is written by the AI layer, signed by the server — not directly', tg_table_name;
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['proposal_reviews', 'proposal_flags', 'law_assessments', 'post_witness',
                           'proposal_conditions', 'vendor_vettings'] loop
    execute format('drop trigger if exists %I on %I', t || '_signed', t);
    execute format('create trigger %I before insert on %I for each row execute function refuse_unsigned_ai()',
                   t || '_signed', t);
  end loop;
end $$;

-- The one door. Runs as the caller (security invoker), so row-level security
-- and every existing function's checks apply exactly as before; the only thing
-- it adds is the proof that the content came from the server's AI layer.
create or replace function ai_write(p_kind text, p_payload text, p_sig text default null)
returns jsonb
language plpgsql
as $$
declare
  d jsonb := p_payload::jsonb;
  v_id uuid;
  v_out jsonb := '{}'::jsonb;
  r jsonb;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not ai_signature_valid(p_kind, p_payload, p_sig) then
    raise exception 'this did not come from the AI layer, or it is too old: refused';
  end if;

  perform set_config('sovereign.ai_signed', 'on', true);

  if p_kind = 'proposal.review' then
    insert into proposal_reviews (proposal_id, prompt_id, prompt_version, model, clarity, evidence,
                                  feasibility, reversibility, values_alignment, risks, questions,
                                  memory_used, summary)
    values ((d->>'proposal_id')::uuid, d->>'prompt_id', d->>'prompt_version', d->>'model',
            (d->>'clarity')::numeric, (d->>'evidence')::numeric, (d->>'feasibility')::numeric,
            (d->>'reversibility')::numeric, d->'values_alignment', d->'risks', d->'questions',
            d->'memory_used', d->>'summary')
    returning id into v_id;
    for r in select * from jsonb_array_elements(coalesce(d->'flags', '[]'::jsonb)) loop
      insert into proposal_flags (proposal_id, review_id, kind, label, severity, detail)
      values ((d->>'proposal_id')::uuid, v_id, r->>'kind', r->>'label', r->>'severity', r->>'detail');
    end loop;
    v_out := jsonb_build_object('id', v_id);

  elsif p_kind = 'law.audit' then
    for r in select * from jsonb_array_elements(d->'readings') loop
      insert into law_assessments (proposal_id, law_id, verdict, reasoning, law_revision,
                                   prompt_id, prompt_version, model)
      values ((d->>'proposal_id')::uuid, r->>'law_id', (r->>'verdict')::law_verdict, r->>'reasoning',
              coalesce((r->>'law_revision')::int, 1), d->>'prompt_id', d->>'prompt_version', d->>'model');
    end loop;

  elsif p_kind = 'law.challenge' then
    v_out := jsonb_build_object('violations',
      record_challenge_audit((d->>'challenge_id')::uuid, d->'readings',
                             d->>'prompt_id', d->>'prompt_version', d->>'model'));

  elsif p_kind = 'post.witness' then
    insert into post_witness (author_id, body_sha256, first_hand, verdict, concerns,
                              prompt_id, prompt_version, model)
    values (auth.uid(), d->>'body_sha256', (d->>'first_hand')::numeric, d->>'verdict',
            d->'concerns', d->>'prompt_id', d->>'prompt_version', d->>'model')
    returning id into v_id;
    v_out := jsonb_build_object('id', v_id);

  elsif p_kind = 'proposal.conditions' then
    perform record_proposal_conditions((d->>'proposal_id')::uuid, (d->>'min_voices')::int,
                                       (d->>'window_hours')::int, d->'requirements', d->>'rationale',
                                       d->>'prompt_id', d->>'prompt_version', d->>'model');

  elsif p_kind = 'marketplace.vetting' then
    if (select vendor_content_hash(v) from vendors v where v.id = (d->>'vendor_id')::uuid)
       is distinct from d->>'content_hash' then
      raise exception 'the business has changed since it was read: read it again';
    end if;
    v_id := record_vendor_vetting((d->>'vendor_id')::uuid, d->'readings',
                                  d->>'prompt_id', d->>'prompt_version', d->>'model');
    v_out := jsonb_build_object('id', v_id);

  else
    raise exception 'unknown kind of AI write: %', p_kind;
  end if;

  perform set_config('sovereign.ai_signed', 'off', true);
  return v_out;
end;
$$;

grant execute on function ai_write(text, text, text) to authenticated;

-- The vetting payload needs the hash the database will compare against.
create or replace function vendor_current_hash(p_vendor_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select vendor_content_hash(v) from vendors v where v.id = p_vendor_id and v.owner_id = auth.uid();
$$;
grant execute on function vendor_current_hash(uuid) to authenticated;
