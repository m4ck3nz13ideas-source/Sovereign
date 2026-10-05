-- 0037 — What a visitor can see before signing in.
--
-- The explore page shows that something is happening without showing anybody.
-- Four totals and nothing else: how many people, how many decisions closed,
-- how many projects finished, how many businesses approved. No names, no
-- titles, no places, nothing per person — a visitor learns the size of the
-- thing, never who is in it. Readable by `anon`, which is the only function
-- in the schema that is.

create or replace function public_pulse()
returns table (people int, decisions int, projects_done int, businesses int)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::int from profiles where onboarded_at is not null),
    (select count(*)::int from decisions),
    (select count(*)::int from projects where status = 'completed'),
    (select count(*)::int from vendors v where vendor_approved(v.id));
$$;

revoke all on function public_pulse() from public;
grant execute on function public_pulse() to anon, authenticated;
