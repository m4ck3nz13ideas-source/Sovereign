-- =============================================================================
-- 0058 — The founder's dashboard: how the founding 50 are getting on
-- =============================================================================
--
-- Mackenzie, 25 October 2026: a dashboard for him alone, to see whether the
-- founding 50 are really using Sovereign before it is promoted in 2027.
--
-- `founders` says who may read it. Like `marketplace_reviewers`, nobody adds
-- themselves: a founder is added from the SQL editor, and the table has
-- row-level security with no policy at all.
--
-- `founder_pulse()` returns COUNTS AND NOTHING ELSE — one row, no name, no
-- id, no handle, no per-person row and no figure about any single person.
-- It is a view of the funnel and of the record's health, not of anybody:
-- who wrote, read or responded stays exactly as private as it was (rules 1,
-- 3, 19). It reads no rating (rule 43), no Know yourself (rule 39), no
-- journal text and no ballot; the one place it touches resonance is a count
-- of distinct people who have ever responded, which says THAT, never how
-- (the ledger already says as much). `51_founder_pulse.sql` reads its
-- source and fails if that changes.
-- =============================================================================

create table if not exists founders (
  profile_id uuid primary key references profiles(id) on delete cascade,
  added_at   timestamptz not null default now()
);
alter table founders enable row level security;
revoke all on founders from public, anon, authenticated;

insert into private.data_map (table_name, column_name, export, erase, erase_where, ord, why) values
  ('founders', 'profile_id', true, 'delete', null, 10, 'that you can read the founder dashboard')
on conflict (table_name, column_name) do nothing;

create or replace function is_founder()
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from founders where profile_id = auth.uid())
$$;

create or replace function founder_pulse()
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare
  w7  timestamptz := now() - interval '7 days';
  w30 timestamptz := now() - interval '30 days';
  live_people int;
  out jsonb;
begin
  if not is_founder() then
    raise exception 'the founder dashboard is for Sovereign''s founders';
  end if;

  -- Active: anybody who wrote, posted, responded, read a proposal or did
  -- anything the ledger records in the last seven days. A count of people.
  select count(distinct who)::int into live_people from (
    select profile_id as who from entries where created_at >= w7
    union select author_id from posts where created_at >= w7
    union select profile_id from resonance_votes where coalesce(updated_at, created_at) >= w7
    union select profile_id from proposal_reads where read_at >= w7
    union select actor_id from ledger_events where created_at >= w7 and actor_id is not null
  ) a;

  select jsonb_build_object(
    'funnel', jsonb_build_object(
      'signed_up',  (select count(*) from profiles where erased_at is null),
      'consented',  (select count(distinct d.profile_id) from data_consents d
                       join profiles p on p.id = d.profile_id where p.erased_at is null),
      'agreed_laws',(select count(*) from (select profile_id from law_acceptances group by profile_id
                       having count(distinct law_id) >= 10) x),
      'onboarded',  (select count(*) from profiles where onboarded_at is not null and erased_at is null),
      'in_a_group', (select count(distinct profile_id) from group_members),
      'responded',  (select count(distinct profile_id) from resonance_votes),
      'proposed',   (select count(distinct author_id) from proposals)
    ),
    'active_7d',    live_people,
    'new_7d',       (select count(*) from profiles where created_at >= w7 and erased_at is null),
    'weekly_signups', (
      select coalesce(jsonb_agg(jsonb_build_object('week', wk, 'n', n) order by wk), '[]'::jsonb)
        from (select date_trunc('week', created_at)::date as wk, count(*)::int as n
                from profiles where created_at >= now() - interval '8 weeks' and erased_at is null
               group by 1) s
    ),
    'groups',       (select count(*) from groups),
    'proposals', jsonb_build_object(
      'held',     (select count(*) from proposals where status = 'in_review'),
      'open',     (select count(*) from proposals where status in ('in_deliberation', 'voting')),
      'passed',   (select count(*) from proposals where status in ('passed', 'executing', 'completed')),
      'failed',   (select count(*) from proposals where status = 'failed'),
      'withdrawn',(select count(*) from proposals where status = 'withdrawn')
    ),
    'posts_7d',     (select count(*) from posts where created_at >= w7),
    'attention', jsonb_build_object(
      'open_flags',        (select count(*) from proposal_flags where resolved_at is null),
      'open_concerns',     (select count(*) from vendor_concerns where closed_at is null),
      'held_over_7d',      (select count(*) from proposals where status = 'in_review' and submitted_at < w7),
      'passed_waiting',    (select count(*) from proposals where status = 'passed' and charter_change is null)
    ),
    'ai_30d', jsonb_build_object(
      'reviews',     (select count(*) from proposal_reviews where created_at >= w30),
      'law_audits',  (select count(distinct audit_id) from law_assessments where created_at >= w30),
      'conditions',  (select count(*) from proposal_conditions where created_at >= w30),
      'by_stand_in', (select count(*) from proposal_reviews where created_at >= w30 and model = 'mock')
    )
  ) into out;

  return out;
end;
$$;

revoke all on function is_founder(), founder_pulse() from public, anon;
grant execute on function is_founder(), founder_pulse() to authenticated;

-- Mackenzie is added from the SQL editor, by email, once:
--   insert into founders (profile_id)
--   select id from auth.users where email = 'mackenzie@mackiavelli.co.uk'
--   on conflict do nothing;

notify pgrst, 'reload schema';
