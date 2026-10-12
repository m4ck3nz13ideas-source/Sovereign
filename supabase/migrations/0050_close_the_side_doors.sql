-- 0050: close the side doors.
--
-- Three things the Supabase security advisor found on 12 October 2026.
--
-- 1. conditions_epoch had no row-level security, and Supabase grants every
--    new table to anon and authenticated. Anyone holding the public anon key
--    could move `since` (or delete the row) and so switch off the rule that a
--    proposal's conditions are set before anybody responds (rule 13, 0039).
--    The only reader is require_conditions_before_votes(), a security definer
--    trigger, so nobody else needs to touch it at all.
--
-- 2. Every security definer function in public was executable by anon,
--    because Supabase's default privileges grant new functions to anon and
--    Postgres grants them to PUBLIC. The ones sampled refuse a signed-out
--    caller, but "each function remembers to refuse" is a promise per
--    function; this makes it a property of the schema. Signed-out visitors
--    get exactly two: public_pulse() (the live numbers on /explore) and
--    shared_decision() (a decision page someone chose to share). Signed-in
--    members keep what they had.
--
-- 3. Twenty functions had no fixed search_path. Pinned, so a caller's
--    search_path can never change which table or function a name resolves to.
--
-- Re-runnable.

------------------------------------------------------------------ 1. epoch

alter table conditions_epoch enable row level security;
revoke all on conditions_epoch from public, anon, authenticated;
-- No policy on purpose: with RLS on and no policy, nobody but the owner and
-- security definer code reads or writes it.

------------------------------------------------------------------ 2. anon

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig, p.proname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosecdef
       and not exists (select 1 from pg_depend d
                        where d.objid = p.oid and d.deptype = 'e')  -- not extension-owned
  loop
    -- Keep signed-in access exactly as it was: grant it explicitly before
    -- taking PUBLIC away, because some functions only reached authenticated
    -- through PUBLIC.
    if has_function_privilege('authenticated', f.sig, 'execute') then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
    execute format('grant execute on function %s to service_role', f.sig);
    execute format('revoke execute on function %s from public, anon', f.sig);
  end loop;
end $$;

grant execute on function public_pulse() to anon;
grant execute on function shared_decision(text) to anon;

-- New functions stop reaching anon by default. A function meant for
-- signed-out visitors says so with its own grant, as the two above do.
-- PUBLIC's execute on new functions is a global default in Postgres, and a
-- per-schema default can only add to a global one, so this one is global.
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;
alter default privileges in schema public grant execute on functions to authenticated, service_role;

-- And new tables stop reaching anon by default too. Tables keep their
-- row-level security as the real rule; this is the second lock.
alter default privileges in schema public revoke all on tables from anon;

------------------------------------------------------------------ 3. search_path

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         'frozen_once', 'frozen_person', 'post_floor', 'flat_text',
         'vendor_content_hash', 'touch_vendor', 'lock_sov_holder',
         'website_host', 'answer_requirement', 'ai_write_in_progress',
         'refuse_unsigned_ai', 'ai_write', 'freeze_self_assessment',
         'guard_condition_update', 'consent_version', 'priority_floor',
         'share_floor', 'touch_updated_at', 'amendment_threshold',
         'mirror_floor')
  loop
    execute format('alter function %s set search_path = public, extensions', f.sig);
  end loop;
end $$;
