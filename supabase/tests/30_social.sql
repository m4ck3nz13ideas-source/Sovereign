-- Likes you can see, comments you can join, and a feed still ordered by time
-- alone (0036, rule 32).
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
  ('a1010101-0101-0101-0101-01010101010a', 'soc-amy@example.com'),
  ('b1010101-0101-0101-0101-01010101010b', 'soc-bo@example.com'),
  ('c1010101-0101-0101-0101-01010101010c', 'soc-cy@example.com'),
  ('d1010101-0101-0101-0101-01010101010d', 'soc-far@example.com');

set role app;

do $$
declare
  amy uuid := 'a1010101-0101-0101-0101-01010101010a';
  bo  uuid := 'b1010101-0101-0101-0101-01010101010b';
  cy  uuid := 'c1010101-0101-0101-0101-01010101010c';
  far uuid := 'd1010101-0101-0101-0101-01010101010d';
  words text := 'Planted forty hedging whips along the school fence this morning with the kids.';
  v_post uuid; n int; c record;
  passes int := 0; fails int := 0;
begin
  perform set_config('test.uid', amy::text, true);
  update profiles set place_local = 'Social Street', place_national = 'United Kingdom', place_set_at = now() where id = amy;
  perform set_config('test.uid', bo::text, true);
  update profiles set place_local = 'Social Street', place_national = 'United Kingdom', place_set_at = now() where id = bo;
  perform set_config('test.uid', cy::text, true);
  update profiles set place_local = 'Social Street', place_national = 'United Kingdom', place_set_at = now() where id = cy;
  perform set_config('test.uid', far::text, true);
  update profiles set place_local = 'Far Away Lane', place_national = 'United Kingdom', place_set_at = now() where id = far;

  perform set_config('test.uid', amy::text, true);
  insert into post_witness (author_id, body_sha256, first_hand, verdict, prompt_id, prompt_version, model)
  values (amy, post_body_hash(words), 0.9, 'First-hand.', 'post.witness', '1.1.0', 'test');
  insert into posts (author_id, body, kind) values (amy, words, 'made') returning id into v_post;

  --------------------------------------------------------------- likes
  perform set_config('test.uid', bo::text, true);
  insert into post_likes (post_id, profile_id) values (v_post, bo);
  perform set_config('test.uid', cy::text, true);
  insert into post_likes (post_id, profile_id) values (v_post, cy);

  begin
    insert into post_likes (post_id, profile_id) values (v_post, cy);
    fails := fails + 1; raise warning 'FAIL: one person liked the same post twice';
  exception when others then passes := passes + 1; end;

  begin
    insert into post_likes (post_id, profile_id) values (v_post, bo);
    fails := fails + 1; raise warning 'FAIL: a like was written in someone else''s name';
  exception when others then passes := passes + 1; end;

  -- Everyone who can see the post sees the count, including the author.
  perform set_config('test.uid', amy::text, true);
  select * into c from post_counts(array[v_post]);
  if c.likes = 2 and not c.i_liked then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the author should see 2 likes and not their own (got %, %)', c.likes, c.i_liked; end if;

  perform set_config('test.uid', bo::text, true);
  select * into c from post_counts(array[v_post]);
  if c.likes = 2 and c.i_liked then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a liker should see the count and their own like'; end if;

  -- Somebody who cannot see the post learns nothing about it.
  perform set_config('test.uid', far::text, true);
  select count(*)::int into n from post_counts(array[v_post]);
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: counts leaked for a post the viewer cannot see'; end if;
  begin
    insert into post_likes (post_id, profile_id) values (v_post, far);
    fails := fails + 1; raise warning 'FAIL: someone liked a post they cannot see';
  exception when others then passes := passes + 1; end;

  -- Unliking.
  perform set_config('test.uid', cy::text, true);
  delete from post_likes where post_id = v_post and profile_id = cy;
  select likes into n from post_counts(array[v_post]);
  if n = 1 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: unliking did not take the count down (%)', n; end if;

  ------------------------------------------------------------ comments
  perform set_config('test.uid', bo::text, true);
  insert into post_comments (post_id, author_id, body) values (v_post, bo, 'Which species did you plant?');
  perform set_config('test.uid', amy::text, true);
  insert into post_comments (post_id, author_id, body) values (v_post, amy, 'Hawthorn and blackthorn mostly.');

  select count(*)::int into n from post_thread(v_post);
  if n = 2 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the thread should have 2 comments, has %', n; end if;
  select comments into n from post_counts(array[v_post]);
  if n = 2 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the comment count is wrong (%)', n; end if;

  perform set_config('test.uid', far::text, true);
  select count(*)::int into n from post_thread(v_post);
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: a thread leaked to someone who cannot see the post'; end if;

  raise notice ' ';
  raise notice '  Social: % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;

reset role;

do $$
declare src text; n int; passes int := 0; fails int := 0;
begin
  -- Likes are shown, never ranked by.
  select prosrc into src from pg_proc where proname = 'witness_feed';
  if src !~* 'post_likes|likes' then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: the feed reads likes'; end if;

  -- And they reach no decision, no SOV and no standing.
  select count(*)::int into n from pg_proc
   where proname in ('close_proposal', 'cast_resonance', 'activate_proposal', 'person_standing',
                     'mint_for_act', 'vendor_status', 'ad_fit')
     and prosrc ~* 'post_likes';
  if n = 0 then passes := passes + 1; else fails := fails + 1;
    raise warning 'FAIL: % function(s) reading likes where they should not', n; end if;

  raise notice ' ';
  raise notice '  Social (absences): % passed, % failed', passes, fails;
  raise notice ' ';
  if fails > 0 then raise exception '% checks failed', fails; end if;
end $$;
