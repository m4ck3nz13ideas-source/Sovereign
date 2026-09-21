-- ============================================================
-- RESET — clears a half-applied Sovereign install.
--
-- This DROPS EVERYTHING in the public schema. It is safe on a
-- fresh project with no data; do not run it on one that has any.
-- Supabase's own auth tables live in the auth schema and are not
-- touched, so your account and any sign-ins survive.
--
-- The grants afterwards restore what Supabase sets up by default.
-- Without them the API can see no tables at all, whatever the
-- policies say.
-- ============================================================

drop trigger if exists on_auth_user_created on auth.users;

drop schema if exists public cascade;
create schema public;

-- Only grant to roles that exist, so this also runs on a plain
-- Postgres that has no Supabase roles.
do $reset$
declare r text;
begin
  execute 'alter schema public owner to pg_database_owner';
  foreach r in array array['postgres','anon','authenticated','service_role'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant usage on schema public to %I', r);
      execute format('grant all   on schema public to %I', r);
      execute format('alter default privileges in schema public grant all on tables    to %I', r);
      execute format('alter default privileges in schema public grant all on functions to %I', r);
      execute format('alter default privileges in schema public grant all on sequences to %I', r);
    end if;
  end loop;
end
$reset$;

-- ------------------------------------------------------------
-- After this, apply the three migrations in supabase/migrations
-- in order, then run the grants at the bottom of this file.
-- ------------------------------------------------------------

-- ============================================================
-- Belt and braces: grant on the objects just created. Row-level
-- security is still what protects the data — these grants only
-- let the API attempt a query at all.
-- ============================================================

do $grants$
declare r text;
begin
  foreach r in array array['anon','authenticated','service_role'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant all on all tables    in schema public to %I', r);
      execute format('grant all on all sequences in schema public to %I', r);
      execute format('grant all on all functions in schema public to %I', r);
    end if;
  end loop;
end
$grants$;

select 'Sovereign schema installed: '
       || (select count(*) from information_schema.tables
            where table_schema='public' and table_type='BASE TABLE') || ' tables, '
       || (select count(*) from pg_policies where schemaname='public') || ' policies, '
       || (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
            where n.nspname='public') || ' functions' as result;
