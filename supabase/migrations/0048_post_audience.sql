-- 0048 — Who a post is for (rule 44): the author chooses its audience.
--
-- Until now a post that was not in a group reached the people around its
-- author and nobody further: their groups, their local place, the people who
-- follow them and their friends. 0006 said why — "sharing a continent is not
-- a relationship" — and that still holds as the DEFAULT. What changes
-- (Mackenzie's direction, 9–10 October 2026) is that the author may choose to
-- say something to a wider place, so that Discover at regional, national,
-- continental and global scale has posts in it, not only proposals.
--
-- THE SHAPE
--
--   * `posts.audience`: 'people' (the default and the old behaviour), or a
--     scale — 'regional', 'national', 'continental', 'global'. A wider
--     audience INCLUDES everybody the default reaches.
--   * A regional post reaches people whose region is the author's region at
--     the moment of reading; national, the same nation; and so on. Global is
--     everyone signed in. Your region is a claim you made about yourself
--     (0006), and so is theirs: nothing here is a location.
--   * A group post is for its group and nobody else, so a group post's
--     audience is always 'people' (checked).
--   * Chosen once. The witness read these words for this audience, and
--     `freeze_post()` now fixes the audience with the words — widening a post
--     after people have reacted to it would be a different post.
--
-- WHAT IT NEVER DOES
--
--   Rank anything (rule 32): the feeds stay in time order and nothing reads
--   the audience except the reach check. It does not make a post public to
--   people who are signed out — `can_see_post()` is still asked as somebody.

alter table posts add column if not exists audience text not null default 'people';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'posts_audience_valid') then
    alter table posts add constraint posts_audience_valid
      check (audience in ('people', 'regional', 'national', 'continental', 'global'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'posts_group_audience') then
    alter table posts add constraint posts_group_audience
      check (group_id is null or audience = 'people');
  end if;
end $$;

-- Where somebody is, at one scale. Null when they have not said.
create or replace function place_at(p_profile uuid, p_scale text)
returns text language sql stable security definer set search_path = public as $$
  select case p_scale
           when 'local'       then place_local
           when 'regional'    then place_regional
           when 'national'    then place_national
           when 'continental' then place_continental
         end
    from profiles where id = p_profile;
$$;

revoke all on function place_at(uuid, text) from public;

-- Does a post's chosen audience reach the person asking?
create or replace function post_audience_reaches(p_author uuid, p_audience text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is null then false
    when p_audience = 'global' then true
    when p_audience in ('regional', 'national', 'continental') then
      in_scope(auth.uid(), p_audience::group_scope, place_at(p_author, p_audience))
    else false
  end;
$$;

grant execute on function post_audience_reaches(uuid, text) to authenticated;

create or replace function can_see_post(p_post_id uuid)
returns boolean language sql security definer stable
set search_path = public, extensions as $$
  select exists (
    select 1 from posts p
     where p.id = p_post_id
       and (
         p.author_id = auth.uid()
         or (p.group_id is not null and is_group_member(p.group_id))
         or (p.group_id is null and (
              shares_group_with(p.author_id)
              or shares_local_place_with(p.author_id)
              or follows_person(p.author_id)
              or is_friend(p.author_id)
              or post_audience_reaches(p.author_id, p.audience)
            ))
       )
  );
$$;

drop policy if exists posts_read on posts;
create policy posts_read on posts for select
  using (
    author_id = auth.uid()
    or (group_id is not null and is_group_member(group_id))
    or (group_id is null and (
         shares_group_with(author_id)
         or shares_local_place_with(author_id)
         or follows_person(author_id)
         or is_friend(author_id)
         or post_audience_reaches(author_id, audience)
       ))
  );

create or replace function freeze_post()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  if new.body is distinct from old.body
     or new.media_url is distinct from old.media_url
     or new.witness_id is distinct from old.witness_id
     or new.audience is distinct from old.audience then
    raise exception 'a post is fixed once published — it was read as these words, for these people. Take it down and write another';
  end if;
  return new;
end;
$$;

comment on column posts.audience is
  'Rule 44: who the author chose to tell. people (default: groups, local place, followers, friends) or a wider scale that includes them. Fixed once published.';
