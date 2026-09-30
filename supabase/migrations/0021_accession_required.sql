-- =============================================================================
-- 0021 — ACCESSION IS A GATE, NOT A SCREEN
--
-- Onboarding shows the ten laws and asks somebody to agree. Until now the only
-- thing making that a necessary step was the order of the screens — which is
-- to say, the interface. A client that set onboarded_at without passing
-- through step two would have been let through, and step two failing quietly
-- (a stale PostgREST schema cache, say) looked exactly like step two being
-- skipped.
--
-- Rule 1 of this codebase is that rules live in the database. So: you cannot
-- finish onboarding without having agreed to all ten laws at their current
-- wording. A trigger refuses the write.
--
-- WHAT THIS DOES NOT DO
--
-- It does not gate reading, writing, asking, objecting or resonating — rule 28
-- stands, and accession is still not a permission system. Nothing in
-- can_reach_proposal() or cast_resonance() reads law_acceptances. The only
-- thing it gates is the claim "this person has finished arriving", which
-- ought to be false if they never read the constitution they are arriving
-- into.
--
-- It also does not re-gate anybody after an amendment. Somebody already
-- onboarded stays onboarded when a law's wording moves; they are told, through
-- my_law_accession().amended_since, and what they do about it is theirs. This
-- trigger fires only on the null-to-not-null transition.
--
-- ON THE SCHEMA CACHE
--
-- PostgREST caches which functions exist. A migration that adds one is invisible
-- to the API until that cache reloads, and the error it produces — "Could not
-- find the function public.x in the schema cache" — reads like the function
-- was never written rather than like a cache being stale. Supabase reloads on
-- its own eventually; `notify pgrst, 'reload schema'` at the end of a migration
-- makes it immediate, and every migration from 0018 on now ends with one.
-- =============================================================================

create or replace function require_accession_before_onboarding()
returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_agreed integer;
begin
  -- Only the moment of arriving. Not every later update to a profile, and not
  -- an amendment landing afterwards.
  if new.onboarded_at is null or old.onboarded_at is not null then
    return new;
  end if;

  select count(distinct a.law_id)
    into v_agreed
    from law_acceptances a
   where a.profile_id = new.id
     and a.revision = law_current_revision(a.law_id);

  if coalesce(v_agreed, 0) < 10 then
    raise exception
      'onboarding cannot finish without agreeing to the ten Universal Laws — % of 10 are on the record for this person',
      coalesce(v_agreed, 0)
      using hint = 'The laws step calls accept_universal_law(). If it appeared to succeed, check that migration 0018 has been applied and that PostgREST has reloaded its schema cache.';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_require_accession on profiles;
create trigger profiles_require_accession
  before update on profiles
  for each row execute function require_accession_before_onboarding();

-- -----------------------------------------------------------------------------
-- Is the function actually reachable?
--
-- Exists so the app can tell "the database has not been migrated" apart from
-- "you have not agreed yet", which are the same screen otherwise and have
-- completely different fixes. Callable by anybody signed in, returns nothing
-- about anybody.
-- -----------------------------------------------------------------------------

drop function if exists accession_ready();
create or replace function accession_ready()
returns table (
  ready        boolean,
  missing      text
)
language sql stable set search_path = public, extensions as $$
  select
    (to_regprocedure('public.accept_universal_law(text[])') is not null
     and to_regclass('public.law_acceptances') is not null),
    case
      when to_regclass('public.law_acceptances') is null
        then 'law_acceptances is missing — migration 0018 has not been applied to this database'
      when to_regprocedure('public.accept_universal_law(text[])') is null
        then 'accept_universal_law(text[]) is missing — migration 0018 has not been applied to this database'
      else null
    end;
$$;

grant execute on function accession_ready() to authenticated, anon;

-- Make both of these visible to the API immediately rather than whenever the
-- cache next turns over.
notify pgrst, 'reload schema';
