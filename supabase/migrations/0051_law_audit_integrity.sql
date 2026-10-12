-- =============================================================================
-- 0051 — A law audit is ten readings, written by the server, of the text as it
-- stands (rule 47)
--
-- What was wrong, checked against every migration since 0004 and the live
-- schema on 12 October 2026:
--
--   1. `law_write` (0004, re-made in 0006) let anyone who could reach a
--      proposal INSERT a reading straight into law_assessments. 0040 put a
--      signature trigger in front of it, but the trigger only bites once
--      `private.ai_signing_key` has a row — and on the live database it has
--      none. So a member could write one "aligned" row for their own proposal
--      and law_standing() called it audited.
--   2. law_standing() said "audited" when at least ONE current reading
--      existed. Nine, one, eleven, a duplicate or a made-up law id all passed.
--   3. record_challenge_audit() (0034) is security definer and was granted to
--      `authenticated` directly, so a challenger could skip ai_write() and its
--      signature entirely and hand in ten "aligned" readings of their own.
--   4. Nothing tied a reading to the text it read. The body is frozen at
--      submission (0007) but the title, summary and budget are not, and the
--      audit reads all of them.
--
-- What this does:
--
--   - Readings are written only by two security definer functions,
--     record_law_audit() and record_challenge_audit(), and each checks the
--     server's HMAC signature itself. There is no insert, update or delete
--     grant on law_assessments for anon or authenticated, and no insert
--     policy. FAILS CLOSED: with no signing key in the database, no audit can
--     be recorded at all. Set AI_SIGNING_SECRET in Vercel, then the database
--     row (see CLAUDE.md rule 38) — until then proposals cannot be audited,
--     which is the honest state: there is no way to tell the server from a
--     member without it.
--   - An audit is exactly ten readings, one for each canonical law id, each
--     with a known verdict and some reasoning. Anything else is refused, and
--     a check constraint and a unique index hold the same line in the table.
--   - Every reading carries `audit_hash`, the sha256 of what the audit read
--     (title, summary, body, scope, place, budget), computed by the database.
--     The signed payload must carry the same hash or it is refused; and
--     law_standing() treats readings of a different text as stale, not as an
--     audit.
--   - Provenance comes from the signed payload, never the caller: prompt id
--     (must be `law.audit`), prompt version, model, provider, the signature's
--     issued_at, an audit_id grouping the ten, and for a re-audit the
--     challenge that caused it.
--   - A challenge is still the only route to a different verdict, and it
--     still goes through the AI. A challenger cannot write a verdict.
--
-- The laws themselves are not touched. Their ids are listed here because the
-- database has to know what "all ten" means; src/lib/universal-law.ts is the
-- source and src/lib/universal-law.test.ts fails if the two drift.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- What "all ten" means
-- -----------------------------------------------------------------------------

create or replace function universal_law_ids()
returns text[] language sql immutable set search_path = public as $$
  select array[
    'sanctity_of_life', 'truth_and_transparency', 'sovereignty_of_the_individual',
    'equity_and_justice', 'subsidiarity', 'reciprocity_and_mutual_care',
    'stewardship_of_earth', 'harmony_of_diversity', 'right_use_of_power',
    'continuous_evolution'
  ]::text[]
$$;

-- -----------------------------------------------------------------------------
-- What the audit read
--
-- Takes the row so PostgREST can select it as a computed column
-- (`select("*, audit_hash")`), which gives the server the hash of exactly the
-- snapshot it is about to send to the model.
-- -----------------------------------------------------------------------------

create or replace function audit_hash(p proposals)
returns text language sql stable set search_path = public, extensions as $$
  select encode(digest(jsonb_build_object(
    'title',           p.title,
    'summary',         p.summary,
    'body',            btrim(coalesce(p.body, '')),
    'scope',           p.scope,
    'place',           p.place,
    'budget_amount',   p.budget_amount,
    'budget_currency', p.budget_currency
  )::text, 'sha256'), 'hex')
$$;

create or replace function proposal_audit_hash(p_proposal_id uuid)
returns text language sql stable security definer set search_path = public, extensions as $$
  select audit_hash(p) from proposals p where p.id = p_proposal_id
$$;

-- -----------------------------------------------------------------------------
-- Provenance on every reading
-- -----------------------------------------------------------------------------

alter table law_assessments
  add column if not exists audit_id     uuid,
  add column if not exists audit_hash   text,
  add column if not exists challenge_id uuid references law_challenges on delete set null,
  add column if not exists provider     text,
  add column if not exists issued_at    timestamptz;

comment on column law_assessments.audit_hash is
  'sha256 of the proposal as the audit read it (audit_hash()). A reading of a different text is stale, not an audit.';
comment on column law_assessments.audit_id is
  'Groups the ten readings of one audit.';
comment on column law_assessments.challenge_id is
  'The challenge that caused this re-audit, or null for a first audit.';

-- Readings from before this migration were made of the text as it stands
-- (nothing could change the body, and there are none on the live database).
update law_assessments a
   set audit_hash = proposal_audit_hash(a.proposal_id)
 where a.audit_hash is null
   and a.superseded_at is null;

-- The hash is the database's, never the caller's: filled in on insert.
create or replace function stamp_law_assessment()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  new.audit_hash := proposal_audit_hash(new.proposal_id);
  return new;
end;
$$;

drop trigger if exists law_assessments_stamp on law_assessments;
create trigger law_assessments_stamp before insert on law_assessments
  for each row execute function stamp_law_assessment();

-- Only the ten laws, and one reading of each in force at a time.
alter table law_assessments drop constraint if exists law_assessments_canonical_law;
alter table law_assessments add constraint law_assessments_canonical_law
  check (law_id = any (universal_law_ids()));

create unique index if not exists law_assessments_one_current
  on law_assessments (proposal_id, law_id) where superseded_at is null;

-- The record stays a record, including the new columns (extends 0029).
create or replace function freeze_law_assessment()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  if new.id             is distinct from old.id
  or new.proposal_id    is distinct from old.proposal_id
  or new.law_id         is distinct from old.law_id
  or new.verdict        is distinct from old.verdict
  or new.reasoning      is distinct from old.reasoning
  or new.prompt_id      is distinct from old.prompt_id
  or new.prompt_version is distinct from old.prompt_version
  or new.model          is distinct from old.model
  or new.created_at     is distinct from old.created_at
  or new.law_revision   is distinct from old.law_revision
  or new.audit_id       is distinct from old.audit_id
  or new.audit_hash     is distinct from old.audit_hash
  or new.provider       is distinct from old.provider
  or new.issued_at      is distinct from old.issued_at
  -- review_id and challenge_id may only fall to null, when what they point at goes
  or (new.review_id is distinct from old.review_id and new.review_id is not null)
  or (new.challenge_id is distinct from old.challenge_id and new.challenge_id is not null)
  then
    raise exception 'a law reading is a record: what it said cannot be changed — challenge it instead';
  end if;

  if not frozen_once(old.resolution, new.resolution)
  or not frozen_once(old.resolved_at, new.resolved_at)
  or not frozen_person(old.resolved_by, new.resolved_by)
  or not frozen_once(old.superseded_at, new.superseded_at)
  then
    raise exception 'that reading has already been answered or superseded, and the answer stands';
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Nobody writes a reading directly
-- -----------------------------------------------------------------------------

drop policy if exists law_write on law_assessments;
revoke insert, update, delete, truncate on law_assessments from public, anon, authenticated;

-- A challenge is raised by a member (challenge_create stays) and answered only
-- by the re-audit. Nobody edits or removes one.
revoke update, delete, truncate on law_challenges from public, anon, authenticated;
revoke insert on law_challenges from public, anon;

-- The old challenge door took readings as arguments with no signature check.
drop function if exists record_challenge_audit(uuid, jsonb, text, text, text);

-- -----------------------------------------------------------------------------
-- The checks both doors share
-- -----------------------------------------------------------------------------

create or replace function law_audit_payload(p_kind text, p_payload text, p_sig text)
returns jsonb language plpgsql stable security definer set search_path = public, private, extensions as $$
declare d jsonb; r jsonb; n int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  if not signing_required() then
    raise exception 'law audits are written only by the server''s AI layer, and its signing key is not set: no audit can be recorded until it is';
  end if;
  if not ai_signature_valid(p_kind, p_payload, p_sig) then
    raise exception 'this did not come from the AI layer, or it is too old: refused';
  end if;

  d := p_payload::jsonb;

  if d->>'prompt_id' is distinct from 'law.audit' then
    raise exception 'a law audit is made with the law.audit prompt';
  end if;
  if length(btrim(coalesce(d->>'prompt_version', ''))) = 0
     or length(btrim(coalesce(d->>'model', ''))) = 0 then
    raise exception 'a law audit says which prompt version and model produced it';
  end if;
  if length(coalesce(d->>'audit_hash', '')) <> 64 then
    raise exception 'a law audit names the text it read';
  end if;

  if jsonb_typeof(d->'readings') is distinct from 'array' or jsonb_array_length(d->'readings') <> 10 then
    raise exception 'an audit reads all ten laws, once each';
  end if;

  for r in select * from jsonb_array_elements(d->'readings') loop
    if jsonb_typeof(r) <> 'object'
       or jsonb_typeof(r->'law_id') is distinct from 'string'
       or not (r->>'law_id' = any (universal_law_ids())) then
      raise exception 'not one of the ten Universal Laws: %', coalesce(r->>'law_id', 'nothing');
    end if;
    if r->>'verdict' is null or not (r->>'verdict' in ('aligned', 'tension', 'violation')) then
      raise exception 'a reading is aligned, tension or violation, not %', coalesce(r->>'verdict', 'nothing');
    end if;
    if length(btrim(coalesce(r->>'reasoning', ''))) = 0 then
      raise exception 'every reading gives its reasoning';
    end if;
  end loop;

  select count(distinct x->>'law_id') into n from jsonb_array_elements(d->'readings') x;
  if n <> 10 then
    raise exception 'an audit reads all ten laws, once each';
  end if;

  return d;
end;
$$;

-- Insert the ten. Called only from the two doors below, after the checks.
create or replace function law_insert_readings(
  p_proposal_id uuid, d jsonb, p_challenge_id uuid
) returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_audit uuid := gen_random_uuid(); r jsonb; v_rev int;
          v_was text := coalesce(current_setting('sovereign.ai_signed', true), '');
begin
  -- The signature was checked by law_audit_payload(); tell 0040's trigger so.
  perform set_config('sovereign.ai_signed', 'on', true);
  for r in select * from jsonb_array_elements(d->'readings') loop
    v_rev := law_current_revision(r->>'law_id');
    if r ? 'law_revision' and (r->>'law_revision')::int is distinct from v_rev then
      raise exception 'that law was amended while it was being read: audit it again';
    end if;

    insert into law_assessments (proposal_id, law_id, verdict, reasoning, law_revision,
                                 prompt_id, prompt_version, model, provider, issued_at,
                                 audit_id, challenge_id)
    values (p_proposal_id, r->>'law_id', (r->>'verdict')::law_verdict, btrim(r->>'reasoning'), v_rev,
            d->>'prompt_id', d->>'prompt_version', d->>'model', nullif(d->>'provider', ''),
            (d->>'issued_at')::timestamptz, v_audit, p_challenge_id);
  end loop;
  perform set_config('sovereign.ai_signed', v_was, true);
  return v_audit;
end;
$$;

-- -----------------------------------------------------------------------------
-- Door one: the first audit (or a fresh one, once the text has moved)
-- -----------------------------------------------------------------------------

create or replace function record_law_audit(p_payload text, p_sig text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  d       jsonb := law_audit_payload('law.audit', p_payload, p_sig);
  p       proposals;
  v_std   record;
  v_audit uuid;
  v_viol  int;
begin
  select * into p from proposals where id = (d->>'proposal_id')::uuid for update;
  if not found or not can_reach_proposal(p.id) then raise exception 'proposal not found'; end if;
  if p.status not in ('in_review', 'in_deliberation', 'voting') then
    raise exception 'the proposal has been decided: its readings are part of what was decided on';
  end if;

  if d->>'audit_hash' is distinct from audit_hash(p) then
    raise exception 'the proposal has changed since it was read: audit it again';
  end if;

  select * into v_std from law_standing(p.id);
  if v_std.audited then
    raise exception 'this proposal already has a complete audit of its current text — challenge a reading instead';
  end if;

  -- Incomplete or stale readings give way to the new ten in the same
  -- transaction, never one without the other (rule 8).
  update law_assessments set superseded_at = now()
   where proposal_id = p.id and superseded_at is null;

  v_audit := law_insert_readings(p.id, d, null);

  select count(*)::int into v_viol from law_assessments
   where audit_id = v_audit and verdict = 'violation';

  perform record_ledger_event(p.group_id, 'law.audited', 'proposal', p.id,
    jsonb_build_object('audit_id', v_audit, 'audit_hash', d->>'audit_hash',
                       'prompt_version', d->>'prompt_version', 'model', d->>'model',
                       'violations', v_viol));

  return jsonb_build_object('audit_id', v_audit, 'violations', v_viol);
end;
$$;

-- -----------------------------------------------------------------------------
-- Door two: a re-audit because somebody challenged a reading
-- -----------------------------------------------------------------------------

create or replace function record_challenge_audit(p_payload text, p_sig text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  d       jsonb := law_audit_payload('law.challenge', p_payload, p_sig);
  c       law_challenges;
  p       proposals;
  v_audit uuid;
  v_viol  int;
begin
  select * into c from law_challenges where id = (d->>'challenge_id')::uuid for update;
  if not found then raise exception 'challenge not found'; end if;
  if c.challenger_id is distinct from auth.uid() then
    raise exception 'only the person who raised a challenge can have it re-audited';
  end if;
  if c.answered_at is not null then
    raise exception 'that challenge has already been answered';
  end if;
  if not exists (select 1 from law_assessments a
                  where a.id = c.assessment_id and a.proposal_id = c.proposal_id) then
    raise exception 'that challenge is not about a reading of this proposal';
  end if;

  select * into p from proposals where id = c.proposal_id for update;
  if not can_reach_proposal(p.id) then raise exception 'proposal not found'; end if;
  if p.status not in ('in_review', 'in_deliberation', 'voting') then
    raise exception 'the proposal has been decided: its readings are part of what was decided on';
  end if;

  if d->>'audit_hash' is distinct from audit_hash(p) then
    raise exception 'the proposal has changed since it was read: audit it again';
  end if;

  update law_assessments set superseded_at = now()
   where proposal_id = p.id and superseded_at is null;

  v_audit := law_insert_readings(p.id, d, c.id);

  update law_challenges set answered_at = now() where id = c.id;

  select count(*)::int into v_viol from law_assessments
   where audit_id = v_audit and verdict = 'violation';

  perform record_ledger_event(p.group_id, 'law.reaudited', 'proposal', p.id,
    jsonb_build_object('audit_id', v_audit, 'challenge_id', c.id,
                       'audit_hash', d->>'audit_hash',
                       'prompt_version', d->>'prompt_version', 'model', d->>'model',
                       'violations', v_viol));

  return jsonb_build_object('audit_id', v_audit, 'violations', v_viol);
end;
$$;

-- -----------------------------------------------------------------------------
-- The gate: ten canonical readings of this text, or it is not an audit
-- -----------------------------------------------------------------------------

drop function if exists law_standing(uuid);
create or replace function law_standing(p_proposal_id uuid)
returns table (
  audited             boolean,
  laws_assessed       integer,
  violations          integer,
  unanswered_tensions integer,
  lawful              boolean,
  stale               boolean
)
language sql security definer stable set search_path = public, extensions as $$
  with cur as (
    select a.* from law_assessments a
     where a.proposal_id = p_proposal_id and a.superseded_at is null
  ),
  s as (
    select
      count(*)::int                                                         as n,
      count(distinct law_id)::int                                           as distinct_laws,
      coalesce(bool_and(law_id = any (universal_law_ids())), false)        as canonical,
      coalesce(bool_and(audit_hash is not distinct from
                        proposal_audit_hash(p_proposal_id)), false)        as current_text,
      count(*) filter (where verdict = 'violation')::int                    as v,
      count(*) filter (where verdict = 'tension' and resolved_at is null)::int as t
    from cur
  ),
  g as (
    select s.*, (s.n = 10 and s.distinct_laws = 10 and s.canonical and s.current_text) as complete
    from s
  )
  select g.complete,
         g.n,
         g.v,
         g.t,
         g.complete and g.v = 0 and g.t = 0,
         g.n > 0 and not g.complete
    from g
   where can_reach_proposal(p_proposal_id);
$$;

-- -----------------------------------------------------------------------------
-- ai_write sends the two law kinds through the doors (replaces 0042's)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ai_write(p_kind text, p_payload text, p_sig text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO public, extensions
AS $function$
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
    v_out := record_law_audit(p_payload, p_sig);

  elsif p_kind = 'law.challenge' then
    v_out := record_challenge_audit(p_payload, p_sig);

  elsif p_kind = 'post.witness' then
    insert into post_witness (author_id, body_sha256, first_hand, verdict, concerns,
                              prompt_id, prompt_version, model)
    values (auth.uid(), d->>'body_sha256', (d->>'first_hand')::numeric, d->>'verdict',
            d->'concerns', d->>'prompt_id', d->>'prompt_version', d->>'model')
    returning id into v_id;
    v_out := jsonb_build_object('id', v_id);

  elsif p_kind = 'proposal.conditions' then
    perform record_proposal_conditions((d->>'proposal_id')::uuid, (d->>'min_voices')::int,
                                       nullif(d->>'window_hours', '')::int, d->'requirements',
                                       coalesce(d->'affected', '[]'::jsonb), d->>'rationale',
                                       d->>'prompt_id', d->>'prompt_version', d->>'model');

  elsif p_kind = 'proposal.conditions.challenge' then
    perform apply_condition_challenge((d->>'challenge_id')::uuid, (d->>'min_voices')::int,
                                      nullif(d->>'window_hours', '')::int, d->'requirements',
                                      coalesce(d->'affected', '[]'::jsonb), d->>'rationale',
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
$function$;

-- -----------------------------------------------------------------------------
-- Who can run what
-- -----------------------------------------------------------------------------

revoke all on function
  universal_law_ids(), audit_hash(proposals), proposal_audit_hash(uuid),
  law_audit_payload(text, text, text), law_insert_readings(uuid, jsonb, uuid),
  record_law_audit(text, text), record_challenge_audit(text, text),
  law_standing(uuid), stamp_law_assessment(), ai_write(text, text, text)
from public, anon;

-- The helpers that write are reachable only from inside the doors.
revoke all on function law_insert_readings(uuid, jsonb, uuid), law_audit_payload(text, text, text)
  from authenticated;

grant execute on function
  universal_law_ids(), audit_hash(proposals), proposal_audit_hash(uuid),
  record_law_audit(text, text), record_challenge_audit(text, text),
  law_standing(uuid), ai_write(text, text, text)
to authenticated;
