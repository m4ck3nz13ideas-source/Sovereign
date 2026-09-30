-- =============================================================================
-- 0025 — WITNESS: a feed of first-hand things, and a gate instead of a ranker
--
--   "COLLECTIVE — Feed, Proposals, Debate, Resonance, Public Profiles"
--   "a feed of positive media, with proposals, posts, videos etc that are
--    feel good or genuine or truthful"                        Mackenzie, 30 Sep
--
-- `posts` has existed since 0001 and was never finished. It carries text, it
-- reaches whoever shares a group or a place with the author, and `post_reactions`
-- counts how many people pressed a button on it. This finishes it, and the
-- shape of the answer is the whole design:
--
-- A FEED SELECTS. There is no such thing as one that does not — even time order
-- is a selection, it just happens to be an honest one. So the only question is
-- WHERE the selecting happens, and there are exactly two places to put it:
-- at the door, once, on the way in; or afterwards, continuously, by ranking
-- what is already there. This puts it at the door. Everything else in this
-- product does the same — a proposal is sharpened before anyone sees it (0007),
-- a survey is refused below two lenses (0019). None of them score the thing
-- afterwards and sort by it.
--
-- WHY THE GATE IS NOT "IS THIS POSITIVE"
--
-- Because the first thing a positivity gate filters out is a member honestly
-- reporting that a project failed, and that report is the single most valuable
-- artefact this system produces — the reflections are what the reviewer reads
-- back on the next proposal (0003). A feed that is pleasant because the
-- disappointments were held at the door is not truthful, and Universal Law 2 is
-- Truth and Transparency, not Cheerfulness.
--
-- So the gate asks whether a post is FIRST-HAND: the author's own experience,
-- work, making or question, told straight. What it keeps out is recirculated
-- content, advertising, a claim dressed as a finding, and writing shaped to
-- provoke rather than to say something. What it lets through includes bad news,
-- and should.
--
-- The pleasantness belongs to the reader instead, and it is theirs to set:
-- `feed_settings` is where somebody says which kinds they want, how long they
-- meant to be here, and which days they would rather not be. That is the
-- Overview's Filter Feed, Timed Scroll and Digital Sabbath, and putting them on
-- the reader's side rather than the publisher's is the difference between a
-- person choosing what they read and a system deciding what everybody reads.
--
-- WHAT LEAVES: THE REACTION COUNT
--
-- `post_reactions` is from 0001 and predates rules 1, 19 and 20. A visible
-- count of who pressed a button is engagement ranking with the ranking left as
-- an exercise for the reader — the same dynamic rule 3 hides live resonance
-- averages to prevent, and rule 20 keeps resonance out of the feed to prevent.
-- It cannot sit in this product beside those.
--
-- The row survives and changes meaning: a reaction becomes a KEEP, private to
-- the person who made it, with no count, no notification and no policy by which
-- an author can learn of it. What you keep is yours, the way `chat_marks` is the
-- reader's (rule 23). The read policy it had was also wrong on its own terms —
-- `exists (select 1 from posts p where p.id = post_id)` is true for every post
-- in the table, so anybody could read every reaction on anything. Same hole in
-- `post_comments`. Both are closed here.
--
-- WHAT A POST STILL DOES NOT DO
--
-- It reaches no proposal, no decision, no project and no ledger. Nothing about
-- posting appears in `person_standing()`: a record of governance acts is not
-- somewhere to put how much somebody posts, and the moment it is, this is a
-- product that rewards posting. There is no reply thread, because there are
-- already two places to talk — deliberation, where what is said is attached to
-- a decision, and chat, where it reaches nothing — and a third that is neither
-- is where the arguing would go.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- What a post is now
-- -----------------------------------------------------------------------------

alter table posts add column if not exists kind text;
alter table posts add column if not exists media_url text;
alter table posts add column if not exists media_kind text;
alter table posts add column if not exists witness_id uuid;

comment on column posts.kind is
  'What the author says this is: made, saw, asked, thanks, learned. Declared, '
  'never inferred, and it is what the reader''s own filter works on.';
comment on column posts.media_url is
  'One link to something the post is about. No uploads: there is no bucket, and '
  'saying so is better than a half-built one.';
comment on column posts.witness_id is
  'The reading that admitted this post. Without one it cannot be published, the '
  'same way a proposal cannot be submitted without a sharpening.';

-- Author-declared, and a closed set so the reader's filter means something.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'posts_kind_known') then
    alter table posts add constraint posts_kind_known check (
      kind is null or kind in ('made', 'saw', 'asked', 'thanks', 'learned')
    ) not valid;
  end if;
end $$;

-- A link, and only a link this app could ever render. No javascript:, no data:,
-- no file:.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'posts_media_shape') then
    alter table posts add constraint posts_media_shape check (
      (media_url is null and media_kind is null)
      or (
        -- Bounded repetition in a Postgres regex tops out at 255, so the
        -- length bound is its own clause rather than a {3,500} that looks
        -- fine and is rejected at insert time.
        media_url ~ '^https?://[^[:space:]]{3,}$'
        and length(media_url) <= 500
        -- `media_kind in (...)` alone is NULL when the kind is missing, and a
        -- check constraint passes on NULL. The explicit not-null is what makes
        -- this refuse a link with nothing saying what it is.
        and media_kind is not null
        and media_kind in ('image', 'video', 'audio', 'page')
      )
    ) not valid;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'posts_body_length') then
    alter table posts add constraint posts_body_length
      check (length(btrim(body)) between 1 and 2000) not valid;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- The gate
--
-- Mirrors `proposal_readiness` (0007) deliberately: a reading is bound to one
-- exact text by its hash, it is spent when it admits something, and it is the
-- database that refuses, not the interface. The floor is lower than a
-- proposal's 0.70 because a post is not a proposal — the bar is "this is yours
-- and it is straight", not "this has been thought through".
-- -----------------------------------------------------------------------------

create or replace function post_floor()
returns numeric language sql immutable as $$ select 0.60::numeric $$;

create or replace function post_body_hash(p_body text)
returns text language plpgsql immutable security definer
set search_path = public, extensions as $$
begin
  return encode(digest(btrim(coalesce(p_body, '')), 'sha256'), 'hex');
end;
$$;

grant execute on function post_floor(), post_body_hash(text) to authenticated;

create table if not exists post_witness (
  id             uuid primary key default gen_random_uuid(),
  author_id      uuid not null references profiles on delete cascade,
  post_id        uuid references posts on delete cascade,

  -- sha256 of the exact text this reading was made against, so a post cannot be
  -- read, admitted, and then published saying something else.
  body_sha256    text not null,

  first_hand     numeric(4,3) not null check (first_hand >= 0 and first_hand <= 1),
  verdict        text not null,
  -- What the reader could not vouch for, in its own words. Shown to the author
  -- when it refuses, so a refusal is answerable rather than a closed door.
  concerns       jsonb not null default '[]'::jsonb,

  prompt_id      text not null,
  prompt_version text not null,
  model          text not null,

  created_at     timestamptz not null default now()
);

create index if not exists post_witness_author_idx
  on post_witness (author_id, created_at desc);

comment on table post_witness is
  'A reading of a draft post before anybody sees it. Bound to one exact text, '
  'spent when it admits one post. Never shown on the published post and never '
  'totalled per author: it is a judgement about a draft, not a rating of a person.';

alter table post_witness enable row level security;

-- Yours and nobody else's, in both directions. A reading of a draft that was
-- refused is a record of something a person wrote and thought better of.
drop policy if exists post_witness_read on post_witness;
create policy post_witness_read on post_witness for select
  using (author_id = auth.uid());

drop policy if exists post_witness_write on post_witness;
create policy post_witness_write on post_witness for insert
  with check (author_id = auth.uid());

grant select, insert on post_witness to authenticated;

-- -----------------------------------------------------------------------------
-- Publishing
--
-- The only way a post reaches the table. A direct insert is refused by the
-- trigger below, exactly as a proposal without a sharpening is.
-- -----------------------------------------------------------------------------

create or replace function bind_post_witness()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_reading post_witness%rowtype;
  v_hash    text;
begin
  v_hash := post_body_hash(new.body);

  select * into v_reading
    from post_witness w
   where w.author_id = new.author_id
     and w.post_id is null
     and w.body_sha256 = v_hash
     and w.first_hand >= post_floor()
     and w.created_at > now() - interval '24 hours'
   order by w.created_at desc
   limit 1;

  if not found then
    raise exception 'a post is read before it is published — this one has no reading of these exact words at or above %', post_floor();
  end if;

  new.witness_id := v_reading.id;
  return new;
end;
$$;

drop trigger if exists posts_bind_witness on posts;
create trigger posts_bind_witness before insert on posts
  for each row execute function bind_post_witness();

-- Spent on the way out, so one reading admits one post.
create or replace function spend_post_witness()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
begin
  update post_witness set post_id = new.id where id = new.witness_id;
  return new;
end;
$$;

drop trigger if exists posts_spend_witness on posts;
create trigger posts_spend_witness after insert on posts
  for each row execute function spend_post_witness();

-- And the words do not move afterwards. Same treatment 0007 gives a proposal
-- body and 0024 gives its lineage: a reading vouches for a text, so a text that
-- can change afterwards makes the reading a decoration.
create or replace function freeze_post()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  if new.body is distinct from old.body
     or new.media_url is distinct from old.media_url
     or new.witness_id is distinct from old.witness_id then
    raise exception 'a post is fixed once published — it was read as these words. Take it down and write another';
  end if;
  return new;
end;
$$;

drop trigger if exists posts_freeze on posts;
create trigger posts_freeze before update on posts
  for each row execute function freeze_post();

-- -----------------------------------------------------------------------------
-- Who can see a post
--
-- One function, the way `can_reach_proposal()` is the one answer for proposals.
-- The reach is the 0001 policy — your group, or a place you share — widened by
-- the graph, because 0012 made following the thing that decides whose work
-- arrives where you will see it (rule 18). It decides nothing else.
-- -----------------------------------------------------------------------------

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
            ))
       )
  );
$$;

grant execute on function can_see_post(uuid) to authenticated;

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
       ))
  );

-- -----------------------------------------------------------------------------
-- A reaction becomes a keep
--
-- Same row, different meaning, and the difference is entirely in who can read
-- it. Nobody but you. There is no count anywhere, no policy by which an author
-- learns of one, and nothing that orders anything by how many there are.
-- -----------------------------------------------------------------------------

comment on table post_reactions is
  'Something you kept. Private to you: no count, no notification, and no policy '
  'by which the author can learn of it. It orders nothing.';

drop policy if exists reactions_read on post_reactions;
drop policy if exists reactions_all on post_reactions;

create policy keeps_read on post_reactions for select
  using (profile_id = auth.uid());

create policy keeps_write on post_reactions for insert
  with check (profile_id = auth.uid() and can_see_post(post_id));

create policy keeps_delete on post_reactions for delete
  using (profile_id = auth.uid());

-- `post_comments` had the same hole: readable for any post that exists. It is
-- unused by the app and stays that way — see the header on why a post has no
-- reply thread — but a table with an open policy is a leak whether or not
-- anything writes to it.
drop policy if exists post_comments_read on post_comments;
create policy post_comments_read on post_comments for select
  using (can_see_post(post_id));

drop policy if exists post_comments_create on post_comments;
create policy post_comments_create on post_comments for insert
  with check (author_id = auth.uid() and can_see_post(post_id));

-- -----------------------------------------------------------------------------
-- The reader's own settings
--
-- The Overview asks for Filter Feed, Timed Scroll, Mindful Mode and a Digital
-- Sabbath. All four are the same idea: the person reading decides what this
-- costs them. None of them touch what anybody else sees, and none of them are
-- defaults somebody else chose.
--
-- `minutes` and `quiet_days` are advisory and the app says so — the server will
-- not lock somebody out of their own governance tool on a Sunday, and a limit
-- that cannot be passed is a limit somebody will route around by not using the
-- app. It is a line they drew, shown back to them when they cross it.
-- -----------------------------------------------------------------------------

create table if not exists feed_settings (
  profile_id  uuid primary key references profiles on delete cascade,
  -- Which kinds they want. Empty means all of them: an explicit "everything"
  -- rather than a null that three screens each interpret differently.
  shows       text[] not null default '{}',
  -- Their own reading limit, in minutes. Null is no limit.
  minutes     integer check (minutes is null or minutes between 1 and 600),
  -- Days of the week they would rather not (0 = Sunday).
  quiet_days  integer[] not null default '{}',
  updated_at  timestamptz not null default now()
);

comment on table feed_settings is
  'The reader''s own filter. Affects nothing anybody else sees, and is nobody '
  'else''s business.';

alter table feed_settings enable row level security;

drop policy if exists feed_settings_own on feed_settings;
create policy feed_settings_own on feed_settings for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

grant select, insert, update, delete on feed_settings to authenticated;

-- Muting somebody you follow. Private, and permanently so: a mute the other
-- person could discover is worse than no mute, because then the only safe
-- option is unfollowing and that is a thing they can see.
create table if not exists feed_mutes (
  profile_id uuid not null references profiles on delete cascade,
  muted_id   uuid not null references profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, muted_id),
  constraint feed_mutes_not_self check (profile_id <> muted_id)
);

comment on table feed_mutes is
  'Quieter, not gone. Private to the person who set it — there is no policy by '
  'which the muted person can learn of it, and there must not be.';

alter table feed_mutes enable row level security;

drop policy if exists feed_mutes_own on feed_mutes;
create policy feed_mutes_own on feed_mutes for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

grant select, insert, delete on feed_mutes to authenticated;

-- -----------------------------------------------------------------------------
-- The feed
--
-- Posts and governance acts in one stream, in time order, and that is the whole
-- algorithm. `people_feed()` (0012) stays exactly as it is — it answers a
-- narrower question, "what have the people I know done", and 10_people.sql
-- holds it to that.
--
-- What is deliberately absent, restating 0012 because it is the thing that
-- would be undone first: resonance. Whether somebody responded to a proposal is
-- not news and putting it here is a bandwagon with a friendly face.
--
-- Nothing is ranked. There is no score column to rank by, no view count to
-- infer one from, and the order is `happened_at desc` with no second key that
-- could quietly become one.
-- -----------------------------------------------------------------------------

drop function if exists witness_feed(integer);
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

grant execute on function witness_feed(integer) to authenticated;

-- Have I kept this one. Your own answer about your own keeps; there is no
-- version of this that counts them or that takes somebody else's id.
create or replace function i_kept(p_post_id uuid)
returns boolean language sql security definer stable
set search_path = public, extensions as $$
  select exists (
    select 1 from post_reactions
     where post_id = p_post_id and profile_id = auth.uid()
  );
$$;

grant execute on function i_kept(uuid) to authenticated;

-- What you kept, for you. The one place keeps are readable, and it is your own
-- shelf rather than anybody's score.
drop function if exists my_keeps(integer);
create or replace function my_keeps(p_limit integer default 50)
returns table (
  post_id     uuid,
  author_name text,
  body        text,
  media_url   text,
  media_kind  text,
  kind        text,
  kept_at     timestamptz
)
language sql security definer stable set search_path = public, extensions as $$
  select p.id, pr.display_name, p.body, p.media_url, p.media_kind,
         coalesce(p.kind, 'saw'), k.created_at
    from post_reactions k
    join posts p on p.id = k.post_id
    join profiles pr on pr.id = p.author_id
   where k.profile_id = auth.uid()
     and can_see_post(p.id)
   order by k.created_at desc
   limit greatest(p_limit, 1);
$$;

grant execute on function my_keeps(integer) to authenticated;
