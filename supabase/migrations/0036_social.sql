-- 0036 — Likes you can see, comments you can join (rule 32, revised).
--
-- Mackenzie's direction: Home is the social space, people can like and
-- comment on each other's posts, and everyone sees how many likes a post has.
--
-- What changes from 0025: a LIKE now exists beside the private KEEP. A keep is
-- still a shelf only you can see. A like is public: anybody who can see a
-- post can see how many people liked it, and whether they did.
--
-- What does NOT change, deliberately: the feed is still time order and nothing
-- else. Likes are shown, never ranked by — `witness_feed()` is untouched, and
-- `30_social.sql` fails if it ever mentions likes. A count you can see is a
-- reaction; a count that decides what everyone else sees is an engagement
-- machine, and that is the version this product exists to not be. Likes also
-- reach no decision, mint no SOV and appear in no standing.

create table if not exists post_likes (
  post_id    uuid not null references posts(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);

create index if not exists post_likes_profile_idx on post_likes (profile_id);

alter table post_likes enable row level security;

-- Who liked what is visible to anybody who can see the post: a like is a
-- public act, like a comment.
drop policy if exists post_likes_read on post_likes;
create policy post_likes_read on post_likes
  for select using (can_see_post(post_id));

drop policy if exists post_likes_write on post_likes;
create policy post_likes_write on post_likes
  for insert with check (profile_id = auth.uid() and can_see_post(post_id));

drop policy if exists post_likes_delete on post_likes;
create policy post_likes_delete on post_likes
  for delete using (profile_id = auth.uid());

-- Counts for a page of posts, and whether the viewer liked each one. Only for
-- posts the viewer can see; anything else simply does not come back.
create or replace function post_counts(p_ids uuid[])
returns table (post_id uuid, likes int, comments int, i_liked boolean)
language sql
stable
security definer
set search_path = public
as $$
  select p.id,
         (select count(*)::int from post_likes l where l.post_id = p.id),
         (select count(*)::int from post_comments c where c.post_id = p.id),
         exists (select 1 from post_likes l where l.post_id = p.id and l.profile_id = auth.uid())
    from posts p
   where p.id = any (p_ids) and can_see_post(p.id);
$$;

-- A post's comments, oldest first, with who wrote them.
create or replace function post_thread(p_post_id uuid)
returns table (id uuid, author_id uuid, author_name text, author_handle text,
               body text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.author_id, pr.display_name, pr.handle, c.body, c.created_at
    from post_comments c
    join profiles pr on pr.id = c.author_id
   where c.post_id = p_post_id and can_see_post(p_post_id)
   order by c.created_at asc;
$$;

grant execute on function post_counts(uuid[]), post_thread(uuid) to authenticated;
