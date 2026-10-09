-- 0047 — What matters to you (rule 43): rating the Spheres.
--
-- Mackenzie's direction (9 October 2026): people rate how important each
-- Sphere is to them, in Individual and from a card in the Home feed. Their
-- ratings are theirs; the group or place sees only the combined tally.
-- It filters the person's own feed and informs their own AI and Learn.
--
-- THE SHAPE
--
--   * `sphere_priorities`: one row per person per Sphere, a rating from 1
--     ("not for me") to 5 ("most important"). Owner-only, editable any time —
--     it is a view someone holds, not a record of an act, so changing your
--     mind replaces it.
--   * `sphere_priority_tally(group, scope)`: for the address you are looking
--     at, the average rating per Sphere and how many people rated it — never
--     who. A group: its members. A place: people at YOUR place at that scale
--     (you cannot ask about somewhere you are not). Global: everyone.
--     No averages come back until `priority_floor()` people have rated —
--     only how many have — because an average of two is somebody's answer
--     with a thin disguise.
--   * Home gets three feeds (Mackenzie, same day): FOR YOU — what is happening
--     at the address you are looking at that touches the Spheres you rated 4
--     or 5, newest first, each with the reason it is there; FOLLOWING —
--     `witness_feed()`, unchanged; DISCOVER — `discover_feed()`, below. The
--     For you selection is done in the app (src/lib/foryou.ts), not here, so
--     no function in the database reads a rating to choose what anyone sees.
--
-- WHAT IT NEVER DOES
--
--   Decide anything. Rule 40 holds: no decision, condition, reach, ad, SOV
--   or feed-ordering function reads `sphere_priorities`, and
--   `41_sphere_priorities.sql` fails if one does. A tally of what people say
--   matters is information for people writing and weighing proposals; it is
--   not a vote on any of them. Budget envelopes may build on it later, on
--   purpose, in their own migration.

create table if not exists sphere_priorities (
  profile_id  uuid not null default auth.uid() references profiles(id),
  sphere_id   text not null references spheres(id),
  rating      smallint not null check (rating between 1 and 5),
  updated_at  timestamptz not null default now(),
  primary key (profile_id, sphere_id)
);

alter table sphere_priorities enable row level security;

drop policy if exists sphere_priorities_own_read on sphere_priorities;
create policy sphere_priorities_own_read on sphere_priorities
  for select using (profile_id = auth.uid());
drop policy if exists sphere_priorities_own_insert on sphere_priorities;
create policy sphere_priorities_own_insert on sphere_priorities
  for insert with check (profile_id = auth.uid());
drop policy if exists sphere_priorities_own_update on sphere_priorities;
create policy sphere_priorities_own_update on sphere_priorities
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
drop policy if exists sphere_priorities_own_delete on sphere_priorities;
create policy sphere_priorities_own_delete on sphere_priorities
  for delete using (profile_id = auth.uid());

grant select, insert, update, delete on sphere_priorities to authenticated;

create or replace function priority_floor()
returns int language sql immutable as $$ select 5 $$;

create or replace function sphere_priority_tally(
  p_group_id uuid default null,
  p_scope    group_scope default null
)
returns table (sphere_id text, name text, average numeric, raters int, people int)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  v_place text;
  v_people int;
begin
  if me is null then raise exception 'sign in first'; end if;
  if p_group_id is null and p_scope is null then return; end if;
  if p_group_id is not null and not is_group_member(p_group_id) then
    raise exception 'you are not in this group';
  end if;

  if p_group_id is null and p_scope <> 'global' then
    select case p_scope
             when 'local'       then place_local
             when 'regional'    then place_regional
             when 'national'    then place_national
             when 'continental' then place_continental
           end
      into v_place from profiles where id = me;
    if place_key(v_place) is null then return; end if;
  end if;

  return query
  with who as (
    select gm.profile_id as id
      from group_members gm
     where p_group_id is not null and gm.group_id = p_group_id
    union
    select p.id
      from profiles p
     where p_group_id is null and p.erased_at is null
       and (p_scope = 'global' or in_scope(p.id, p_scope, v_place))
  ),
  rated as (
    select sp.* from sphere_priorities sp join who on who.id = sp.profile_id
  ),
  n as (select count(distinct profile_id)::int as people from rated)
  select s.id, s.name,
         case when n.people >= priority_floor() then round(avg(r.rating)::numeric, 2) end,
         case when n.people >= priority_floor() then count(r.rating)::int else 0 end,
         n.people
    from spheres s
    cross join n
    left join rated r on r.sphere_id = s.id and n.people >= priority_floor()
   group by s.id, s.name, s.ordinal, n.people
   order by avg(r.rating) desc nulls last, s.ordinal;
end;
$$;

revoke all on function sphere_priority_tally(uuid, group_scope) from public;
grant execute on function sphere_priority_tally(uuid, group_scope) to authenticated;

------------------------------------------------------------ discover

-- Discover: what is happening at an address, from people you do not follow
-- yet. Posts you can already see (the post policy is unchanged, so beyond
-- your local place that is mostly group posts), and the public acts at that
-- address: proposals submitted and decided, projects started and finished.
-- Newest first, one sort key, nothing read from likes (rule 32).
create or replace function discover_feed(
  p_group_id uuid default null,
  p_scope    group_scope default null,
  p_limit    integer default 40
)
returns table (
  item_id      uuid,
  source       text,
  actor_id     uuid,
  actor_name   text,
  actor_handle text,
  kind         text,
  body         text,
  media_url    text,
  media_kind   text,
  subject_type text,
  subject_id   uuid,
  title        text,
  tie          text,
  happened_at  timestamptz
)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  v_place text;
begin
  if me is null then raise exception 'sign in first'; end if;
  if p_group_id is null and p_scope is null then return; end if;
  if p_group_id is not null and not is_group_member(p_group_id) then
    raise exception 'you are not in this group';
  end if;
  if p_group_id is null and p_scope <> 'global' then
    select case p_scope
             when 'local'       then place_local
             when 'regional'    then place_regional
             when 'national'    then place_national
             when 'continental' then place_continental
           end
      into v_place from profiles where id = me;
    if place_key(v_place) is null then return; end if;
  end if;

  return query
  with muted as (
    select muted_id from feed_mutes where profile_id = me
  ),
  known as (
    select followed_id as person from follows where follower_id = me
    union
    select case when lower_id = me then higher_id else lower_id end
      from friendships where (lower_id = me or higher_id = me) and accepted_at is not null
    union
    select me
  ),
  said (f_id, f_source, f_actor, f_name, f_handle, f_kind, f_body, f_media, f_media_kind, f_subject_type, f_subject_id, f_title, f_tie, f_at) as (
    select p.id, 'post'::text, p.author_id, pr.display_name, pr.handle,
           coalesce(p.kind, 'saw'), p.body, p.media_url, p.media_kind,
           null::text, null::uuid, null::text, 'here'::text, p.created_at
      from posts p
      join profiles pr on pr.id = p.author_id
     where can_see_post(p.id)
       and p.author_id not in (select person from known)
       and p.author_id not in (select muted_id from muted)
       and (
         (p_group_id is not null and p.group_id = p_group_id)
         or (p_group_id is null and p.group_id is null
             and (p_scope = 'global' or in_scope(p.author_id, p_scope, v_place)))
       )
  ),
  did (f_id, f_source, f_actor, f_name, f_handle, f_kind, f_body, f_media, f_media_kind, f_subject_type, f_subject_id, f_title, f_tie, f_at) as (
    select e.id, 'act'::text, e.actor_id, pr.display_name, pr.handle,
           e.kind, null::text, null::text, null::text,
           e.subject_type, e.subject_id, coalesce(pp.title, prj.title),
           'here'::text, e.created_at
      from ledger_events e
      join profiles pr on pr.id = e.actor_id
      left join projects prj on prj.id = e.subject_id and e.subject_type = 'project'
      left join proposals pp on pp.id = coalesce(prj.proposal_id,
                                  case when e.subject_type = 'proposal' then e.subject_id end)
     where e.kind in ('proposal.submitted', 'proposal.decided', 'project.started', 'project.completed')
       and pp.id is not null
       and can_reach_proposal(pp.id)
       and e.actor_id not in (select muted_id from muted)
       and (
         (p_group_id is not null and pp.group_id = p_group_id)
         or (p_group_id is null and pp.group_id is null and pp.scope = p_scope)
       )
  )
  select * from (select * from said union all select * from did) f
  order by f.f_at desc
  limit greatest(p_limit, 1);
end;
$$;

revoke all on function discover_feed(uuid, group_scope, integer) from public;
grant execute on function discover_feed(uuid, group_scope, integer) to authenticated;

-- Rule 42: every column pointing at a profile is classified.
insert into private.data_map (table_name, column_name, export, erase, erase_where, ord, why) values
  ('sphere_priorities', 'profile_id', true, 'delete', null, 10, 'what matters to you')
on conflict (table_name, column_name) do nothing;

comment on table sphere_priorities is
  'Rule 43: how much each Sphere matters to a person, 1 to 5. Owner-only; the group or place sees a tally above priority_floor(); decides nothing.';
