-- Witness: a post is read before anybody sees it, the words do not move
-- afterwards, what you keep is yours alone, and the feed has no opinion.
\set ON_ERROR_STOP on
\pset pager off

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'app') then create role app login; end if;
end $$;

grant usage on schema public, auth to app;
grant select, insert, update, delete on all tables in schema public to app;
grant usage, select on all sequences in schema public to app;
grant execute on all functions in schema public to app;
grant execute on function auth.uid() to app;
grant select on auth.users to app;

insert into auth.users (id, email) values
  ('f2000001-0000-0000-0000-000000000000', 'wit1@example.com'),
  ('f2000002-0000-0000-0000-000000000000', 'wit2@example.com'),
  ('f2000003-0000-0000-0000-000000000000', 'wit3@example.com');

set role app;

do $$
declare
  ida uuid := 'f2000001-0000-0000-0000-000000000000';  -- Ida
  jon uuid := 'f2000002-0000-0000-0000-000000000000';  -- Jon, same street
  kit uuid := 'f2000003-0000-0000-0000-000000000000';  -- Kit, another street
  v_post uuid; w_id uuid; other_w uuid; n int; t text; b numeric;
  passes int := 0; fails int := 0;
  words text := 'Rebuilt the drystone wall at the top of the lane this weekend. Took two days and I got the batter wrong on the first ten feet, so that bit will come down again.';
  other text := 'Something else entirely, which nobody has read.';
begin
  perform set_config('test.uid', ida::text, true);
  update profiles set place_local = 'Witness Lane', place_national = 'United Kingdom',
                      place_set_at = now() where id = ida;
  perform set_config('test.uid', jon::text, true);
  update profiles set place_local = 'Witness Lane', place_national = 'United Kingdom',
                      place_set_at = now() where id = jon;
  perform set_config('test.uid', kit::text, true);
  update profiles set place_local = 'Elsewhere Road', place_national = 'United Kingdom',
                      place_set_at = now() where id = kit;

  perform set_config('test.uid', ida::text, true);

  ------------------------------------------------ nothing is published unread
  begin
    insert into posts (author_id, body) values (ida, words);
    fails := fails + 1;
    raise warning 'FAIL: a post was published with no reading at all';
  exception when others then passes := passes + 1;
  end;

  ------------------------------------------------------ and not below the floor
  insert into post_witness (author_id, body_sha256, first_hand, verdict,
                            prompt_id, prompt_version, model)
  values (ida, post_body_hash(words), 0.410, 'Reads like an advert.',
          'post.witness', '1.0.0', 'test');

  begin
    insert into posts (author_id, body) values (ida, words);
    fails := fails + 1;
    raise warning 'FAIL: a post was published on a reading below the floor';
  exception when others then passes := passes + 1;
  end;

  ------------------------------------------- a reading is of one exact text
  insert into post_witness (author_id, body_sha256, first_hand, verdict,
                            prompt_id, prompt_version, model)
  values (ida, post_body_hash(other), 0.910, 'Fine.',
          'post.witness', '1.0.0', 'test');

  begin
    insert into posts (author_id, body) values (ida, words);
    fails := fails + 1;
    raise warning 'FAIL: a reading of different words admitted this text';
  exception when others then passes := passes + 1;
  end;

  ------------------------------------------ somebody else's reading is not yours
  perform set_config('test.uid', jon::text, true);
  insert into post_witness (author_id, body_sha256, first_hand, verdict,
                            prompt_id, prompt_version, model)
  values (jon, post_body_hash(words), 0.880, 'Jon''s reading of Ida''s words.',
          'post.witness', '1.0.0', 'test')
  returning id into other_w;

  perform set_config('test.uid', ida::text, true);
  begin
    insert into posts (author_id, body) values (ida, words);
    fails := fails + 1;
    raise warning 'FAIL: another person''s reading admitted this post';
  exception when others then passes := passes + 1;
  end;

  ------------------------------------------------------------ and now it works
  insert into post_witness (author_id, body_sha256, first_hand, verdict,
                            prompt_id, prompt_version, model)
  values (ida, post_body_hash(words), 0.840, 'First-hand, and it says what went wrong.',
          'post.witness', '1.0.0', 'test')
  returning id into w_id;

  insert into posts (author_id, body, kind) values (ida, words, 'made')
  returning id into v_post;
  passes := passes + 1;

  ------------------------------------------------------ the reading is attached
  select witness_id::text into t from posts where id = v_post;
  if t = w_id::text then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the post did not carry the reading that admitted it'; end if;

  select count(*)::int into n from post_witness w where w.id = w_id and w.post_id = v_post;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the reading was not spent on the post'; end if;

  ---------------------------------------------------- and it is spent, once
  begin
    insert into posts (author_id, body) values (ida, words);
    fails := fails + 1;
    raise warning 'FAIL: one reading admitted a second post';
  exception when others then passes := passes + 1;
  end;

  ------------------------------------------------------- the words do not move
  --
  -- Two things stop this and the suite checks both, because they fail
  -- differently. `posts` has no update policy at all, so a member's update
  -- matches no row and raises nothing — the assertion has to be that the words
  -- did not change, not that an error was thrown. `freeze_post()` is the
  -- backstop underneath, for anything reaching the table another way, and the
  -- absences block asserts the trigger is still there.
  update posts set body = 'Actually it was a hedge.' where id = v_post;
  select body into t from posts where id = v_post;
  if t = words then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a published post was rewritten'; end if;

  update posts set witness_id = other_w where id = v_post;
  select witness_id::text into t from posts where id = v_post;
  if t = w_id::text then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a post was re-pointed at a different reading'; end if;

  -- And the trigger refuses it even with the policy out of the way, which is
  -- what would happen to anything arriving through a definer function later.
  begin
    set local role postgres;
    update posts set body = 'Actually it was a hedge.' where id = v_post;
    set local role app;
    fails := fails + 1;
    raise warning 'FAIL: freeze_post did not stop a privileged rewrite';
  exception when others then
    passes := passes + 1;
  end;
  set local role app;

  -- But taking it down still works, which is why the text is frozen and the
  -- row is not.
  select count(*)::int into n from posts where id = v_post;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the post went missing'; end if;

  ------------------------------------------------------------------- the media
  insert into post_witness (author_id, body_sha256, first_hand, verdict,
                            prompt_id, prompt_version, model)
  values (ida, post_body_hash('A video of the wall going up.'), 0.900, 'Fine.',
          'post.witness', '1.0.0', 'test');

  begin
    insert into posts (author_id, body, media_url, media_kind)
    values (ida, 'A video of the wall going up.', 'javascript:alert(1)', 'video');
    fails := fails + 1;
    raise warning 'FAIL: a javascript: url was accepted as media';
  exception when others then passes := passes + 1;
  end;

  begin
    insert into posts (author_id, body, media_url, media_kind)
    values (ida, 'A video of the wall going up.', 'https://example.com/wall.mp4', 'hologram');
    fails := fails + 1;
    raise warning 'FAIL: an unknown media kind was accepted';
  exception when others then passes := passes + 1;
  end;

  begin
    insert into posts (author_id, body, media_url)
    values (ida, 'A video of the wall going up.', 'https://example.com/wall.mp4');
    fails := fails + 1;
    raise warning 'FAIL: a media url was accepted with no kind';
  exception when others then passes := passes + 1;
  end;

  insert into posts (author_id, body, media_url, media_kind, kind)
  values (ida, 'A video of the wall going up.', 'https://example.com/wall.mp4', 'video', 'made');
  passes := passes + 1;

  --------------------------------------------------------- a kind is a known one
  insert into post_witness (author_id, body_sha256, first_hand, verdict,
                            prompt_id, prompt_version, model)
  values (ida, post_body_hash('Another one.'), 0.900, 'Fine.',
          'post.witness', '1.0.0', 'test');
  begin
    insert into posts (author_id, body, kind) values (ida, 'Another one.', 'sponsored');
    fails := fails + 1;
    raise warning 'FAIL: an invented post kind was accepted';
  exception when others then passes := passes + 1;
  end;

  raise notice ' ';
  raise notice '  Witness (the gate): % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then
    raise exception '% checks failed', fails;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Who sees it, what you keep, and what the feed does
-- -----------------------------------------------------------------------------

do $$
declare
  ida uuid := 'f2000001-0000-0000-0000-000000000000';
  jon uuid := 'f2000002-0000-0000-0000-000000000000';
  kit uuid := 'f2000003-0000-0000-0000-000000000000';
  v_post uuid; n int; ok_flag boolean;
  passes int := 0; fails int := 0;
  words text := 'Rebuilt the drystone wall at the top of the lane this weekend. Took two days and I got the batter wrong on the first ten feet, so that bit will come down again.';
begin
  -- `set_config(..., true)` is transaction-local and each DO block is its own
  -- transaction, so this block starts with no signed-in user at all. Every
  -- suite that splits into more than one block has to say who it is again.
  perform set_config('test.uid', ida::text, true);

  select id into v_post from posts where author_id = ida and body = words;

  ------------------------------------------------- the street sees it, Kit does not
  perform set_config('test.uid', jon::text, true);
  select count(*)::int into n from posts where id = v_post;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: somebody on the same street could not see the post'; end if;

  perform set_config('test.uid', kit::text, true);
  select count(*)::int into n from posts where id = v_post;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: another street saw the post'; end if;

  select can_see_post(v_post) into ok_flag;
  if ok_flag is not true then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: can_see_post said yes to another street'; end if;

  ----------------------------------------- following is a reason, as 0012 made it
  perform follow_person(ida);
  select count(*)::int into n from posts where id = v_post;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: following did not bring the post into reach'; end if;

  ------------------------------------------------------- a keep is private
  insert into post_reactions (post_id, profile_id) values (v_post, kit);
  passes := passes + 1;

  select i_kept(v_post) into ok_flag;
  if ok_flag then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: Kit''s own keep did not read back'; end if;

  select count(*)::int into n from my_keeps(50) where post_id = v_post;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a keep did not appear on its own shelf'; end if;

  -- Ida wrote it and cannot tell. This is the whole difference between a keep
  -- and a like.
  perform set_config('test.uid', ida::text, true);
  select count(*)::int into n from post_reactions where post_id = v_post;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the author could read % keeps on their own post', n; end if;

  select i_kept(v_post) into ok_flag;
  if ok_flag is false then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: i_kept() leaked somebody else''s keep'; end if;

  select count(*)::int into n from my_keeps(50);
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: somebody else''s keep appeared on Ida''s shelf'; end if;

  -- And nobody can put one in anybody else's name.
  begin
    insert into post_reactions (post_id, profile_id) values (v_post, jon);
    fails := fails + 1;
    raise warning 'FAIL: a keep was written in another person''s name';
  exception when others then passes := passes + 1;
  end;

  ------------------------------------------------------------------ the feed
  perform set_config('test.uid', jon::text, true);
  select count(*)::int into n from witness_feed(40) where item_id = v_post;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the post was not in the feed of somebody it reaches'; end if;

  select count(*)::int into n from witness_feed(40)
   where item_id = v_post and source = 'post' and body is not null;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the post did not arrive in the feed as a post with its words'; end if;

  perform set_config('test.uid', kit::text, true);
  select count(*)::int into n from witness_feed(40) where item_id = v_post;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a follower did not get the post in their feed'; end if;

  ------------------------------------------------- the reader's own filter
  insert into feed_settings (profile_id, shows) values (kit, '{saw}')
  on conflict (profile_id) do update set shows = '{saw}';

  select count(*)::int into n from witness_feed(40) where item_id = v_post;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a filter of "saw" still showed a post marked "made"'; end if;

  update feed_settings set shows = '{made,saw}' where profile_id = kit;
  select count(*)::int into n from witness_feed(40) where item_id = v_post;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a filter including "made" hid a post marked "made"'; end if;

  update feed_settings set shows = '{}' where profile_id = kit;
  select count(*)::int into n from witness_feed(40) where item_id = v_post;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: an empty filter did not mean everything'; end if;

  ---------------------------------------------------------------- and muting
  insert into feed_mutes (profile_id, muted_id) values (kit, ida);
  select count(*)::int into n from witness_feed(40) where item_id = v_post;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a muted person was still in the feed'; end if;

  -- Muting is not unfollowing: the post is still reachable, it is just not
  -- arriving.
  select count(*)::int into n from posts where id = v_post;
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: muting removed reach as well as arrival'; end if;

  -- And Ida cannot find out.
  perform set_config('test.uid', ida::text, true);
  select count(*)::int into n from feed_mutes;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a muted person could see they were muted'; end if;

  select count(*)::int into n from feed_settings;
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: somebody else''s feed settings were readable'; end if;

  perform set_config('test.uid', kit::text, true);
  delete from feed_mutes where profile_id = kit and muted_id = ida;

  raise notice ' ';
  raise notice '  Witness (reach, keeps, feed): % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then
    raise exception '% checks failed', fails;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- The absences
--
-- Every one of these is a small, reasonable-looking addition that would turn
-- this back into the thing it was built instead of.
-- -----------------------------------------------------------------------------

do $$
declare
  n int; src text;
  passes int := 0; fails int := 0;
begin
  ----------------------------------------------------- nothing to compete over
  select count(*)::int into n from information_schema.columns
   where table_name = 'posts'
     and column_name in ('likes', 'like_count', 'reactions', 'reaction_count',
                         'score', 'rank', 'views', 'view_count', 'shares',
                         'boost', 'boosted', 'pinned', 'trending', 'reach',
                         'impressions', 'hot', 'popularity', 'engagement');
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: posts grew % column(s) to compete over', n; end if;

  select count(*)::int into n from information_schema.columns
   where table_name = 'post_reactions' and column_name not in
         ('post_id', 'profile_id', 'created_at');
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: post_reactions grew % column(s) beyond who and when', n; end if;

  ------------------------------------ and no policy by which a count is readable
  select count(*)::int into n from pg_policies
   where tablename = 'post_reactions' and cmd = 'SELECT'
     and qual not like '%auth.uid()%';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a keep is readable by somebody other than the person who made it'; end if;

  ------------------------------------------- the feed has no second sort key
  select prosrc into src from pg_proc where proname = 'witness_feed';
  if src !~* '(score|rank|popular|trending|weight|boost|count\(\*\) *desc)' then
    passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: witness_feed has something in it to rank by'; end if;

  if src ~* 'order by[^;]*happened_at desc' then passes := passes + 1;
  else fails := fails + 1;
    raise warning 'FAIL: the feed is not ordered by time'; end if;

  ------------------------------------------- and it carries no resonance (rule 20)
  if src !~* 'resonance' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: resonance reached the feed'; end if;

  ------------------------------------------------- posting is not a governance act
  select prosrc into src from pg_proc where proname = 'person_standing';
  if src !~* '(posts|post_reactions|witness)' then passes := passes + 1;
  else fails := fails + 1;
    raise warning 'FAIL: person_standing counts posting'; end if;

  ------------------------------------------ and reaches no decision anywhere
  select string_agg(prosrc, ' ') into src from pg_proc
   where proname in ('close_proposal', 'cast_resonance', 'can_reach_proposal',
                     'activate_proposal', 'alignment_shape', 'bind_proposal_readiness');
  if src !~* '(\mposts\M|post_reactions|post_witness|feed_settings|feed_mutes)' then
    passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a decision function reads the feed'; end if;

  ------------------------------------------------- no aggregate of readings per author
  --
  -- A reading is a judgement about one draft. The moment anything averages or
  -- totals them per person, it is a rating of a writer, and it would look on
  -- screen exactly like a fact.
  select count(*)::int into n from pg_proc
   where proname ~* '(witness|first_hand)'
     and proname ~* '(score|scores|average|avg|total|standing|rank|rating|quality)';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % function(s) total up somebody''s readings', n; end if;

  -- And the readings themselves are readable only by the person who wrote the
  -- draft — a refused reading is a record of something somebody thought better
  -- of publishing.
  select count(*)::int into n from pg_policies
   where tablename = 'post_witness' and cmd = 'SELECT'
     and qual not like '%auth.uid()%';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: somebody else can read a draft reading'; end if;

  ----------------------------------------------- the gate is a trigger, not a request
  select count(*)::int into n from pg_trigger
   where tgname in ('posts_bind_witness', 'posts_spend_witness', 'posts_freeze')
     and not tgisinternal;
  if n = 3 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % of the three post triggers exist — without them the rules above are decoration', n; end if;

  ------------------------------------------------- append-only where it matters
  select count(*)::int into n from pg_policies
   where tablename = 'post_witness' and cmd in ('UPDATE', 'DELETE');
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a reading can be rewritten after the fact'; end if;

  raise notice ' ';
  raise notice '  Witness (absences): % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then
    raise exception '% checks failed', fails;
  end if;
end $$;

reset role;
