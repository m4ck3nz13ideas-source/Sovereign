-- =============================================================================
-- 0053 — A PAGE FOR EVERY GROUP AND EVERY BUSINESS (rule 49)
--
-- Mackenzie, 12 October: tapping a group or a business should open a full
-- rundown — what it is for, what it is trying to do, the values it holds —
-- and a feed with its media that everyone it is for can see.
--
-- GROUPS. `purpose` already existed. This adds `goal` and `group_values`, the
-- values the group says it holds, set by its stewards through the existing
-- steward update policy. Alongside those, `group_shared_values()` reports the
-- values its members hold in common — but only from members who have chosen to
-- share their values (profiles.share_values, rule in 0002), only values named
-- by two or more of them, and only as a count. Nobody's own list is exposed by
-- it: a count of two is the same information those two already chose to show
-- the group. The feed is the group's own posts, which members could already
-- read (posts_read, group_id).
--
-- BUSINESSES. `mission` and `vendor_values` join what a vetting reads: they
-- are claims, and a claim on an approved page has to have been read against
-- the Universal Laws (rule 37). `vendor_content_hash()` takes them in a way
-- that leaves every existing hash unchanged while they are empty —
-- concat_ws() skips nulls — so no current approval lapses. Filling them in
-- makes the business `changed` until it is read again, exactly like editing
-- its description.
--
-- A business's updates are posts with `vendor_id`, written only by its owner,
-- through the same witness every post passes. Anyone signed in can read them
-- while the business is approved; the owner always can.
-- =============================================================================

------------------------------------------------------------------ groups

alter table groups add column if not exists goal text;
alter table groups add column if not exists group_values text[] not null default '{}';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'groups_goal_len') then
    alter table groups add constraint groups_goal_len
      check (goal is null or length(btrim(goal)) between 1 and 600);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'groups_values_shape') then
    alter table groups add constraint groups_values_shape
      check (cardinality(group_values) <= 12
             and array_position(group_values, null) is null);
  end if;
end $$;

create or replace function group_shared_values(p_group uuid)
returns table (value text, holders integer)
language sql security definer stable set search_path = public, extensions as $$
  select min(btrim(v.name)) as value, count(distinct v.profile_id)::int as holders
    from profile_values v
    join group_members m on m.profile_id = v.profile_id and m.group_id = p_group
    join profiles p on p.id = v.profile_id and p.share_values
   where is_group_member(p_group)
   group by lower(btrim(v.name))
  having count(distinct v.profile_id) >= 2
   order by holders desc, value;
$$;

revoke all on function group_shared_values(uuid) from public, anon;
grant execute on function group_shared_values(uuid) to authenticated;

-------------------------------------------------------------- businesses

alter table vendors add column if not exists mission text;
alter table vendors add column if not exists vendor_values text[] not null default '{}';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'vendors_mission_len') then
    alter table vendors add constraint vendors_mission_len
      check (mission is null or length(btrim(mission)) between 1 and 600);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'vendors_values_shape') then
    alter table vendors add constraint vendors_values_shape
      check (cardinality(vendor_values) <= 12
             and array_position(vendor_values, null) is null);
  end if;
end $$;

-- Unchanged for every business that has not filled in the new fields.
create or replace function vendor_content_hash(v vendors)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select md5(concat_ws(E'\x1f', v.name, v.description, v.evidence, v.website, coalesce(v.location, ''),
                       v.mission, nullif(array_to_string(v.vendor_values, E'\x1e'), '')));
$$;

------------------------------------------------------------ business posts

alter table posts add column if not exists vendor_id uuid references vendors on delete cascade;
create index if not exists posts_vendor_idx on posts (vendor_id, created_at desc) where vendor_id is not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'posts_vendor_shape') then
    alter table posts add constraint posts_vendor_shape
      check (vendor_id is null or (group_id is null and audience = 'people'));
  end if;
end $$;

-- Only a business's owner speaks for it.
create or replace function check_vendor_post()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.vendor_id is not null and not exists (
    select 1 from vendors where id = new.vendor_id and owner_id = new.author_id
  ) then
    raise exception 'only the business''s owner can post as it';
  end if;
  return new;
end;
$$;

drop trigger if exists posts_vendor_owner on posts;
create trigger posts_vendor_owner before insert or update of vendor_id on posts
  for each row execute function check_vendor_post();

revoke all on function check_vendor_post() from public, anon, authenticated;

-- 0048's policy, with one clause added for an approved business's posts.
drop policy if exists posts_read on posts;
create policy posts_read on posts for select
  using (
    author_id = auth.uid()
    or (group_id is not null and is_group_member(group_id))
    or (vendor_id is not null and auth.uid() is not null and vendor_status(vendor_id) = 'approved')
    or (group_id is null and vendor_id is null and (
         shares_group_with(author_id)
         or shares_local_place_with(author_id)
         or follows_person(author_id)
         or is_friend(author_id)
         or post_audience_reaches(author_id, audience)
       ))
  );


-- can_see_post() answers the same question as the policy, for definer code
-- (comments, likes, the feeds).
create or replace function can_see_post(p_post_id uuid)
returns boolean language sql security definer stable
set search_path = public, extensions as $$
  select exists (
    select 1 from posts p
     where p.id = p_post_id
       and (
         p.author_id = auth.uid()
         or (p.group_id is not null and is_group_member(p.group_id))
         or (p.vendor_id is not null and auth.uid() is not null and vendor_status(p.vendor_id) = 'approved')
         or (p.group_id is null and p.vendor_id is null and (
              shares_group_with(p.author_id)
              or shares_local_place_with(p.author_id)
              or follows_person(p.author_id)
              or is_friend(p.author_id)
              or post_audience_reaches(p.author_id, p.audience)
            ))
       )
  );
$$;

-- A business's updates live on its page and nowhere else. Placement in
-- people's feeds is what ads are for (rule 37), so the two feeds below are
-- 0025's and 0047's with one line added: no business posts.

create or replace function witness_feed(p_limit integer default 40)
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
language sql security definer stable set search_path = public, extensions as $$
  with mine as (
    select coalesce((select shows from feed_settings where profile_id = auth.uid()), '{}') as shows
  ),
  muted as (
    select muted_id from feed_mutes where profile_id = auth.uid()
  ),
  graph as (
    select followed_id as person, 'following' as tie
      from follows where follower_id = auth.uid()
    union
    select case when lower_id = auth.uid() then higher_id else lower_id end, 'friend'
      from friendships
     where (lower_id = auth.uid() or higher_id = auth.uid())
       and accepted_at is not null
  ),
  said (item_id, source, actor_id, actor_name, actor_handle, kind, body,
        media_url, media_kind, subject_type, subject_id, title, tie, happened_at) as (
    select
      p.id, 'post'::text, p.author_id, pr.display_name, pr.handle,
      coalesce(p.kind, 'saw'), p.body, p.media_url, p.media_kind,
      null::text, null::uuid, null::text,
      coalesce(g.tie, 'here'), p.created_at
    from posts p
    join profiles pr on pr.id = p.author_id
    left join graph g on g.person = p.author_id
    cross join mine
    where can_see_post(p.id)
      and p.vendor_id is null
      and p.author_id not in (select muted_id from muted)
      and (
        cardinality(mine.shows) = 0
        or coalesce(p.kind, 'saw') = any (mine.shows)
      )
  ),
  did (item_id, source, actor_id, actor_name, actor_handle, kind, body,
       media_url, media_kind, subject_type, subject_id, title, tie, happened_at) as (
    select
      e.id, 'act'::text, e.actor_id, pr.display_name, pr.handle,
      e.kind, null::text, null::text, null::text,
      e.subject_type, e.subject_id, coalesce(p.title, prj.title),
      g.tie, e.created_at
    from ledger_events e
    join graph g on g.person = e.actor_id
    join profiles pr on pr.id = e.actor_id
    left join proposals p on p.id = e.subject_id and e.subject_type = 'proposal'
    left join projects prj on prj.id = e.subject_id and e.subject_type = 'project'
    where e.kind in (
            'proposal.submitted',
            'proposal.decided',
            'project.started',
            'project.completed',
            'projection.resolved'
          )
      and e.actor_id not in (select muted_id from muted)
      and (
        (e.subject_type = 'proposal' and can_reach_proposal(e.subject_id))
        or (e.subject_type = 'project' and can_reach_project(e.subject_id))
      )
  )
  select * from (select * from said union all select * from did) f
  order by f.happened_at desc
  limit greatest(p_limit, 1);
$$;

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
      and p.vendor_id is null
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

-- Data rights (rule 42): a business's posts are its owner's posts, already
-- covered by posts.author_id; the new column points at a business, not a
-- person, so the map needs nothing new.
