-- Minimal local stand-in for the parts of Supabase the migrations touch.
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('test.uid', true), '')::uuid;
$$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role;
  end if;
end $$;

-- Supabase grants every new table in public to anon and authenticated by
-- default, and a migration that wants less has to revoke it. Mirrored here so
-- a suite running as `authenticated` sees the privileges the live API does
-- (45_law_audit_integrity.sql depends on it).
grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
-- And every new FUNCTION, to both roles directly (0060). Postgres alone only
-- grants functions to PUBLIC, so `revoke ... from public` looked like enough
-- here while Supabase still let every signed-in user call the function —
-- which is how place_at() ended up callable on production.
alter default privileges in schema public grant execute on functions to anon, authenticated;
