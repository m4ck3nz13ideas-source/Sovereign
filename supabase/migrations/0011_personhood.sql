-- =============================================================================
-- 0011 — PERSONHOOD: one human, one voice, and nothing else known about them
--
--   "Auth: Email + invite link. No identity theatre."          Overview, Tech
--   "Self-Sovereign Identity (SID); user owns identity and credentials"
--   Rule 3 of Universal Law: sovereignty of the individual.
--
-- The hole this closes: a place has no register. Anyone who says they are on
-- this street can read, write and resonate there, which is exactly the
-- openness the scope engine exists to provide — and it means one person with
-- five email addresses can carry a local proposal on their own. At the scale
-- of a street that is visible and self-correcting; at the scale of a country
-- it is the whole system defeated by a spreadsheet.
--
-- So: proof of personhood, and ONLY proof of personhood.
--
-- What is stored is a NULLIFIER — an opaque hash the verifier derives per
-- application, which is the same for the same human every time and cannot be
-- turned back into them. No name, no document, no image, no biometric, no
-- account at the provider. A unique index on that hash is the entire
-- guarantee: one human, one account, enforced by Postgres rather than by
-- anybody's good intentions.
--
-- What it proves: a distinct living person. What it does not prove: who they
-- are, what they are called, where they live, or that they are entitled to
-- anything. The place claim stays a claim, checkable by the people standing
-- next to them, exactly as before.
--
-- Where it binds: resonance, and only where the scope rule says so. Reading,
-- writing proposals, asking questions and raising concerns stay open to
-- everyone verified or not, because the argument should be open and only the
-- count needs defending. Subsidiarity applied to identity: your own street
-- needs no proof, a country does.
-- =============================================================================

do $$ begin
  if not exists (select 1 from pg_type where typname = 'personhood_method') then
    -- biometric: a verifier that has physically seen one live human once.
    -- seed:      an instance's first people, before any verifier existed. Kept
    --            as its own value rather than dressed up as a proof, so the
    --            provenance of an instance is visible in its own data.
    create type personhood_method as enum ('biometric', 'seed');
  end if;
end $$;

create table if not exists personhood_proofs (
  profile_id  uuid primary key references profiles on delete cascade,
  method      personhood_method not null,

  -- Who did the seeing. 'worldid', or whichever verifier is configured; the
  -- application layer holds the adapter, this holds its name for the record.
  provider    text not null,

  -- The provider's own word for how strong this was — 'orb' and 'device' for
  -- World ID, for example. Stored verbatim, interpreted nowhere in SQL, so a
  -- change of verifier does not need a migration.
  level       text,

  -- THE nullifier. Opaque, per-application, stable for one human. This is the
  -- only thing about a person's body that ever reaches this database, and it
  -- is not reversible into them.
  nullifier   text not null check (length(btrim(nullifier)) >= 16),

  verified_at timestamptz not null default now(),
  -- Some verifiers expire. Null means it does not.
  expires_at  timestamptz,

  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);

-- One human, one account. Everything else here is commentary on this line.
create unique index if not exists personhood_nullifier_unique
  on personhood_proofs (nullifier) where revoked_at is null;

comment on table personhood_proofs is
  'Proof that an account is a distinct living person. Holds an opaque nullifier and nothing else about them — no name, document, image or biometric.';
comment on column personhood_proofs.nullifier is
  'Per-application hash from the verifier. Same human, same hash; not reversible into the human. The unique index on it is the one-person-one-account rule.';
comment on column personhood_proofs.method is
  'biometric: a verifier saw a live human. seed: an instance''s first people, recorded honestly as unverified-by-anybody rather than disguised as a proof.';

alter table personhood_proofs enable row level security;

-- -----------------------------------------------------------------------------
-- Reading it
--
-- Whether somebody is verified is public — a decision record that says how
-- many of its voices were verified is useless if nobody can check. The proof
-- itself is not: the nullifier is the person's, and a policy that let members
-- read each other's would let anyone correlate accounts across instances.
-- So there is a public FUNCTION and a private TABLE.
-- -----------------------------------------------------------------------------

drop policy if exists personhood_own on personhood_proofs;
create policy personhood_own on personhood_proofs for select
  using (profile_id = auth.uid());

grant select on personhood_proofs to authenticated;

create or replace function is_verified_person(p_profile_id uuid default null)
returns boolean language sql security definer stable
set search_path = public, extensions as $$
  select exists (
    select 1 from personhood_proofs
     where profile_id = coalesce(p_profile_id, auth.uid())
       and revoked_at is null
       and (expires_at is null or expires_at > now())
  );
$$;

grant execute on function is_verified_person(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Which scales ask for it
--
-- Local and regional do not. The people are near enough to each other that a
-- fake is visible, and demanding a verifier before somebody can say what they
-- think about their own street is the opposite of what this is for.
-- -----------------------------------------------------------------------------

alter table scope_rules
  add column if not exists require_personhood boolean not null default false;

comment on column scope_rules.require_personhood is
  'Whether resonance at this scale requires proof of personhood. Reading and writing never do.';

update scope_rules set require_personhood = true
 where scope in ('national', 'continental', 'global');

update scope_rules
   set note = coalesce(note || ' ', '')
     || 'Proof of personhood is required to resonate at this scale: the people are too far apart to see each other, so the count is the only thing holding, and an uncounted duplicate is worth more here than an argument.'
 where scope in ('national', 'continental', 'global')
   and coalesce(note, '') not like '%proof of personhood%';

-- -----------------------------------------------------------------------------
-- Recording a proof
--
-- The application layer talks to the verifier and hands the nullifier over;
-- this function is what makes it a fact. It is the only way in — there is no
-- insert policy — and it refuses a nullifier that already belongs to somebody
-- else rather than letting the unique index produce a constraint error nobody
-- can read.
-- -----------------------------------------------------------------------------

create or replace function record_personhood(
  p_provider   text,
  p_nullifier  text,
  p_level      text default null,
  p_method     personhood_method default 'biometric',
  p_expires_at timestamptz default null
)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare v_owner uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  if length(btrim(coalesce(p_nullifier, ''))) < 16 then
    raise exception 'that is not a nullifier';
  end if;

  select profile_id into v_owner
    from personhood_proofs
   where nullifier = btrim(p_nullifier) and revoked_at is null;

  if v_owner is not null and v_owner <> auth.uid() then
    raise exception 'that proof already belongs to another account — one person, one voice';
  end if;

  insert into personhood_proofs (profile_id, method, provider, level, nullifier, expires_at)
  values (auth.uid(), p_method, btrim(p_provider), p_level, btrim(p_nullifier), p_expires_at)
  on conflict (profile_id) do update
    set method = excluded.method,
        provider = excluded.provider,
        level = excluded.level,
        nullifier = excluded.nullifier,
        expires_at = excluded.expires_at,
        verified_at = now(),
        revoked_at = null;

  -- The ledger records that a person was verified, by whom and how strongly.
  -- It does not record the nullifier: the ledger is the public record and the
  -- nullifier is the one thing here that must never be public.
  perform record_ledger_event(null, 'personhood.verified', 'profile', auth.uid(),
    jsonb_build_object('provider', btrim(p_provider),
                       'level', p_level,
                       'method', p_method));
end;
$$;

-- Nobody can take this away from somebody else. A steward cannot, a group
-- cannot, and there is no policy that would let them: you unlink your own, and
-- the nullifier is released so the same human can verify a different account.
create or replace function revoke_personhood()
returns void language plpgsql security definer
set search_path = public, extensions as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  update personhood_proofs
     set revoked_at = now()
   where profile_id = auth.uid() and revoked_at is null;

  perform record_ledger_event(null, 'personhood.revoked', 'profile', auth.uid(), '{}'::jsonb);
end;
$$;

grant execute on function
  record_personhood(text, text, text, personhood_method, timestamptz),
  revoke_personhood()
to authenticated;

-- -----------------------------------------------------------------------------
-- The gate
--
-- One line added to resonance, and nothing else changed anywhere. Everything
-- above this line in cast_resonance() is 0006's, verbatim: the order of the
-- checks and the wording of every error are part of what the tests assert, and
-- a personhood feature has no business rewriting them.
-- -----------------------------------------------------------------------------

create or replace function cast_resonance(
  p_proposal_id uuid,
  p_alignment   numeric,
  p_confidence  numeric,
  p_urgency     numeric,
  p_note        text default null
) returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_group  uuid;
  v_status proposal_status;
  v_violations integer;
  v_scope  group_scope;
  v_needs_person boolean;
begin
  select group_id, status, scope into v_group, v_status, v_scope
    from proposals where id = p_proposal_id;
  if not found then raise exception 'no such proposal'; end if;
  if not can_reach_proposal(p_proposal_id) then
    raise exception 'this proposal is not addressed to you';
  end if;

  if v_status = 'in_review'
     or not exists (select 1 from proposal_reviews where proposal_id = p_proposal_id) then
    raise exception 'the review has not landed yet';
  end if;

  if v_status not in ('in_deliberation', 'voting') then
    raise exception 'this proposal is closed';
  end if;

  select count(*)::int into v_violations
    from law_assessments
   where proposal_id = p_proposal_id and superseded_at is null and verdict = 'violation';

  if v_violations > 0 then
    raise exception 'this proposal violates Universal Law and cannot proceed to resonance';
  end if;

  if not exists (select 1 from proposal_reads
                 where proposal_id = p_proposal_id and profile_id = auth.uid()) then
    raise exception 'read the review before recording resonance';
  end if;

  -- Only a place proposal has a scale that anybody is far apart at. A group
  -- has a register — the membership list — so it already knows how many
  -- people it has, and asking its members to prove they exist to each other
  -- would be theatre.
  if v_group is null then
    select require_personhood into v_needs_person from scope_rules where scope = v_scope;
    if coalesce(v_needs_person, false) and not is_verified_person() then
      raise exception 'resonance at % scale needs proof that you are one person — you can still read, ask and object without it', v_scope;
    end if;
  end if;

  insert into resonance_votes (proposal_id, profile_id, alignment, confidence, urgency, note)
  values (p_proposal_id, auth.uid(), p_alignment, p_confidence, p_urgency, p_note)
  on conflict (proposal_id, profile_id) do update
    set alignment = excluded.alignment,
        confidence = excluded.confidence,
        urgency = excluded.urgency,
        note = excluded.note,
        updated_at = now();

  if v_status = 'in_deliberation' then
    update proposals set status = 'voting' where id = p_proposal_id;
  end if;

  perform record_ledger_event(v_group, 'resonance.recorded', 'proposal', p_proposal_id, '{}'::jsonb);
end;
$$;

grant execute on function cast_resonance(uuid, numeric, numeric, numeric, text) to authenticated;

-- -----------------------------------------------------------------------------
-- And the count, on every decision, whether the scale asked for it or not
--
-- This is the part that works even where the gate is off. A local decision
-- carried by four voices, none of whom is verified, is a different object from
-- one carried by four who are, and a record that reported them identically
-- would be doing the thing rule 14 exists to stop.
-- -----------------------------------------------------------------------------

alter table decisions
  add column if not exists verified_voices integer;

comment on column decisions.verified_voices is
  'How many of the voices in this decision had proof of personhood at the time it closed. Recorded at every scale, required at some.';

create or replace function verified_voice_count(p_proposal_id uuid)
returns integer language sql security definer stable
set search_path = public, extensions as $$
  select count(*)::int
    from resonance_votes v
    join personhood_proofs p on p.profile_id = v.profile_id
   where v.proposal_id = p_proposal_id
     and p.revoked_at is null
     and (p.expires_at is null or p.expires_at > now());
$$;

grant execute on function verified_voice_count(uuid) to authenticated;

-- close_proposal() fills it in. Rather than restate the whole function, the
-- count is written by a trigger on the decision itself: the decision row is
-- inserted once and never updated, so there is exactly one moment to measure.
create or replace function stamp_verified_voices()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
begin
  new.verified_voices := verified_voice_count(new.proposal_id);
  return new;
end;
$$;

drop trigger if exists decisions_stamp_verified on decisions;
create trigger decisions_stamp_verified before insert on decisions
  for each row execute function stamp_verified_voices();

-- -----------------------------------------------------------------------------
-- How a place stands
--
-- For the screen that has to say, honestly, what this instance's count is
-- worth. Nobody is named: this is a tally, not a list of who to distrust.
-- -----------------------------------------------------------------------------

drop function if exists personhood_standing(group_scope);
create or replace function personhood_standing(p_scope group_scope default null)
returns table (
  scope              group_scope,
  required           boolean,
  min_voices         integer,
  you_are_verified   boolean
)
language sql security definer stable set search_path = public, extensions as $$
  select r.scope, r.require_personhood, r.min_voices, is_verified_person()
    from scope_rules r
   where p_scope is null or r.scope = p_scope
   order by array_position(
     array['local','regional','national','continental','global']::group_scope[], r.scope);
$$;

grant execute on function personhood_standing(group_scope) to authenticated;
