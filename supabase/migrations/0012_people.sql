-- =============================================================================
-- 0012 — PEOPLE: two relationships doing two different jobs
--
--   "Public profiles and reputation visible for governance"   Overview
--   "COLLECTIVE — Feed, Proposals, Debate, Resonance, Public Profiles"
--
-- Until now the only way anyone here is connected to anyone else is by
-- accident: you share a street, or somebody invited you into a group. That is
-- the right basis for who may DECIDE together, and a poor basis for who you
-- want to hear from — the two questions are not the same and this splits them.
--
-- FOLLOW is one-way and public. You put someone in your feed. They find out,
-- they do not approve it, and it gives you nothing except their public record
-- arriving where you will see it.
--
-- FRIEND is mutual and asked for. Both sides agree, either side can end it,
-- and it is what will carry private conversation. It gives no governance
-- power whatsoever: a friend cannot see your journal, your drafts, your values
-- unless you shared them with everyone, or how you resonated on anything.
--
-- The line that matters: NEITHER OF THESE CHANGES WHAT YOU MAY DECIDE. Your
-- address decides that, and it always will. A thousand followers does not make
-- your resonance worth more, does not get you into a group, and does not reach
-- a proposal on a street you do not live on. If you ever find yourself writing
-- a policy that reads the follow graph to answer an eligibility question, stop:
-- that is the moment this turns into the thing it was built against.
--
-- There is also no directory. You cannot browse everyone — a governance tool
-- that ships a searchable index of every human on it has built a target, not a
-- feature. A handle is an address: if somebody gives you theirs you can find
-- them, and otherwise you meet people the way you would anywhere, by being in
-- the same place.
-- =============================================================================

-- A handle is how somebody is findable. Lowercase, boring on purpose, and
-- optional — plenty of people will never want one.
alter table profiles drop constraint if exists profiles_handle_shape;
alter table profiles add constraint profiles_handle_shape check (
  handle is null
  or (handle = lower(handle) and handle ~ '^[a-z0-9][a-z0-9_.]{2,29}$')
);

-- -----------------------------------------------------------------------------
-- Follow
-- -----------------------------------------------------------------------------

create table if not exists follows (
  follower_id uuid not null references profiles on delete cascade,
  followed_id uuid not null references profiles on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followed_id),
  constraint follows_not_self check (follower_id <> followed_id)
);

create index if not exists follows_followed_idx on follows (followed_id);

comment on table follows is
  'One-way and public. Puts somebody''s public record in your feed and gives you nothing else.';

alter table follows enable row level security;

-- You can see your own edges in both directions — who you follow, and who
-- follows you. You cannot see anybody else's, because a readable social graph
-- is a map of who knows whom, and that is not ours to publish.
drop policy if exists follows_read on follows;
create policy follows_read on follows for select
  using (follower_id = auth.uid() or followed_id = auth.uid());

drop policy if exists follows_write on follows;
create policy follows_write on follows for insert
  with check (follower_id = auth.uid());

drop policy if exists follows_delete on follows;
create policy follows_delete on follows for delete
  using (follower_id = auth.uid());

grant select, insert, delete on follows to authenticated;

-- -----------------------------------------------------------------------------
-- Friendship
--
-- One row per pair, ordered so the pair cannot be entered twice with the
-- names the other way round. Who asked is remembered, because who asked is
-- what the other person needs to know.
-- -----------------------------------------------------------------------------

create table if not exists friendships (
  lower_id     uuid not null references profiles on delete cascade,
  higher_id    uuid not null references profiles on delete cascade,
  requested_by uuid not null references profiles on delete cascade,
  accepted_at  timestamptz,
  created_at   timestamptz not null default now(),
  primary key (lower_id, higher_id),
  constraint friendships_ordered check (lower_id < higher_id)
);

comment on table friendships is
  'Mutual and asked for. Carries private conversation and nothing else — no governance power, no access to anything the other person has not published.';

alter table friendships enable row level security;

drop policy if exists friendships_read on friendships;
create policy friendships_read on friendships for select
  using (lower_id = auth.uid() or higher_id = auth.uid());

grant select on friendships to authenticated;

-- -----------------------------------------------------------------------------
-- Asking, answering, ending
--
-- All through functions, because the pair ordering and the "who asked" rule
-- are not things a client should be trusted to get right, and because
-- accepting somebody else's request is an update that a policy cannot
-- distinguish from forging one.
-- -----------------------------------------------------------------------------

create or replace function follow_person(p_profile_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_profile_id = auth.uid() then raise exception 'you already know what you are doing'; end if;
  if not exists (select 1 from profiles where id = p_profile_id) then
    raise exception 'no such person';
  end if;

  insert into follows (follower_id, followed_id)
  values (auth.uid(), p_profile_id)
  on conflict do nothing;
end;
$$;

create or replace function unfollow_person(p_profile_id uuid)
returns void language sql security definer
set search_path = public, extensions as $$
  delete from follows where follower_id = auth.uid() and followed_id = p_profile_id;
$$;

create or replace function request_friendship(p_profile_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare v_lo uuid; v_hi uuid; v_row friendships%rowtype;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_profile_id = auth.uid() then raise exception 'you cannot befriend yourself'; end if;
  if not exists (select 1 from profiles where id = p_profile_id) then
    raise exception 'no such person';
  end if;

  v_lo := least(auth.uid(), p_profile_id);
  v_hi := greatest(auth.uid(), p_profile_id);

  select * into v_row from friendships where lower_id = v_lo and higher_id = v_hi;

  -- They asked first and you are asking back. That is an acceptance, and
  -- treating it as one saves a step nobody understands the point of.
  if found and v_row.accepted_at is null and v_row.requested_by <> auth.uid() then
    update friendships set accepted_at = now()
     where lower_id = v_lo and higher_id = v_hi;
    return;
  end if;

  insert into friendships (lower_id, higher_id, requested_by)
  values (v_lo, v_hi, auth.uid())
  on conflict do nothing;
end;
$$;

create or replace function accept_friendship(p_profile_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare v_lo uuid; v_hi uuid; v_row friendships%rowtype;
begin
  v_lo := least(auth.uid(), p_profile_id);
  v_hi := greatest(auth.uid(), p_profile_id);

  select * into v_row from friendships where lower_id = v_lo and higher_id = v_hi;
  if not found then raise exception 'nobody has asked'; end if;
  if v_row.accepted_at is not null then return; end if;

  -- You cannot accept your own request. Obvious, and exactly the thing a
  -- policy could not have said on its own.
  if v_row.requested_by = auth.uid() then
    raise exception 'you asked — they have to answer';
  end if;

  update friendships set accepted_at = now()
   where lower_id = v_lo and higher_id = v_hi;
end;
$$;

-- Ending covers withdrawing a request, refusing one, and ending a friendship.
-- One verb, because from the other side those are the same event and dressing
-- them up differently would only make a refusal feel like a statement.
create or replace function end_friendship(p_profile_id uuid)
returns void language sql security definer
set search_path = public, extensions as $$
  delete from friendships
   where lower_id = least(auth.uid(), p_profile_id)
     and higher_id = greatest(auth.uid(), p_profile_id)
     and (lower_id = auth.uid() or higher_id = auth.uid());
$$;

create or replace function is_friend(p_profile_id uuid)
returns boolean language sql security definer stable
set search_path = public, extensions as $$
  select exists (
    select 1 from friendships
     where lower_id = least(auth.uid(), p_profile_id)
       and higher_id = greatest(auth.uid(), p_profile_id)
       and accepted_at is not null
  );
$$;

create or replace function follows_person(p_profile_id uuid)
returns boolean language sql security definer stable
set search_path = public, extensions as $$
  select exists (
    select 1 from follows
     where follower_id = auth.uid() and followed_id = p_profile_id
  );
$$;

grant execute on function
  follow_person(uuid), unfollow_person(uuid),
  request_friendship(uuid), accept_friendship(uuid), end_friendship(uuid),
  is_friend(uuid), follows_person(uuid)
to authenticated;

-- -----------------------------------------------------------------------------
-- Seeing each other
--
-- A profile becomes readable once there is a reason: you share a place, you
-- share a group, you follow them, or you are friends. Following is the reason
-- that can be created unilaterally, which is what keeps this from being a
-- closed system — and `find_person` below is how you get there.
-- -----------------------------------------------------------------------------

drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles for select
  using (
    id = auth.uid()
    or shares_group_with(id)
    or shares_local_place_with(id)
    or follows_person(id)
    or is_friend(id)
  );

-- The only lookup there is: an exact handle, one person, nothing fuzzy.
--
-- No prefix search, no listing, no "people you may know". Those are how a
-- directory gets built by accident, and a governance instance with a
-- browsable index of everyone on it is a target rather than a feature. If
-- somebody wants to be found they hand out their handle.
create or replace function find_person(p_handle text)
returns table (
  id           uuid,
  handle       text,
  display_name text,
  bio          text,
  avatar_url   text
)
language sql security definer stable set search_path = public, extensions as $$
  select p.id, p.handle, p.display_name, p.bio, p.avatar_url
    from profiles p
   where p.handle is not null
     and p.handle = lower(btrim(p_handle))
     and p.id <> auth.uid();
$$;

grant execute on function find_person(text) to authenticated;

-- -----------------------------------------------------------------------------
-- A public profile
--
-- What a person has actually done, and nothing about what they think.
--
-- Note what is not here and will not be: how they resonated on anything, their
-- entries, their drafts, their values unless they published them, their place,
-- their followers. And no ratio, no rank, no percentage — "proposals written:
-- 12, passed: 3" is a record; "success rate 25%" is a score, and this product
-- does not score people. The difference is one division and the whole design.
-- -----------------------------------------------------------------------------

drop function if exists person_standing(uuid);
create or replace function person_standing(p_profile_id uuid)
returns table (
  proposals_written   integer,
  proposals_passed    integer,
  projects_finished   integer,
  predictions_marked  integer,
  questions_answered  integer,
  joined_at           timestamptz,
  you_follow          boolean,
  you_are_friends     boolean,
  they_follow_you     boolean,
  friendship          text
)
language sql security definer stable set search_path = public, extensions as $$
  select
    (select count(*)::int from proposals where author_id = p_profile_id
       and can_reach_proposal(id)),
    (select count(*)::int from proposals where author_id = p_profile_id
       and status in ('passed', 'executing', 'completed') and can_reach_proposal(id)),
    (select count(*)::int from projects pr
       join proposals p on p.id = pr.proposal_id
      where p.author_id = p_profile_id and pr.status = 'completed'
        and can_reach_proposal(p.id)),
    (select count(*)::int from projections
      where resolved_by = p_profile_id and can_reach_proposal(proposal_id)),
    (select count(*)::int from deliberation_comments
      where answered_by = p_profile_id and can_reach_proposal(proposal_id)),
    (select created_at from profiles where id = p_profile_id),
    follows_person(p_profile_id),
    is_friend(p_profile_id),
    exists (select 1 from follows where follower_id = p_profile_id and followed_id = auth.uid()),
    coalesce((
      select case
        when f.accepted_at is not null then 'friends'
        when f.requested_by = auth.uid() then 'you asked'
        else 'they asked'
      end
      from friendships f
      where f.lower_id = least(auth.uid(), p_profile_id)
        and f.higher_id = greatest(auth.uid(), p_profile_id)
    ), 'none');
$$;

grant execute on function person_standing(uuid) to authenticated;

-- Who has asked you, and who you have asked. Both, because a request you sent
-- and forgot about is a thing you should be able to see and withdraw.
drop function if exists friendship_requests();
create or replace function friendship_requests()
returns table (
  profile_id   uuid,
  display_name text,
  handle       text,
  direction    text,
  asked_at     timestamptz
)
language sql security definer stable set search_path = public, extensions as $$
  select
    case when f.lower_id = auth.uid() then f.higher_id else f.lower_id end,
    p.display_name,
    p.handle,
    case when f.requested_by = auth.uid() then 'you asked' else 'they asked' end,
    f.created_at
  from friendships f
  join profiles p
    on p.id = case when f.lower_id = auth.uid() then f.higher_id else f.lower_id end
  where (f.lower_id = auth.uid() or f.higher_id = auth.uid())
    and f.accepted_at is null
  order by f.created_at desc;
$$;

grant execute on function friendship_requests() to authenticated;

-- -----------------------------------------------------------------------------
-- The social feed
--
-- What the people you follow and the people you are friends with have
-- actually done, read straight off the ledger — so there is nothing new to
-- record, and eligibility is answered by the same function that answers it
-- everywhere else.
--
-- WHAT IS DELIBERATELY NOT IN IT
--
-- Resonance. "Four people you follow have responded to this" is the single
-- most effective engagement mechanic there is and it is a bandwagon with a
-- friendly face — the same dynamic rule 3 hides live averages to prevent.
-- Whether somebody voted is not news; what they built is.
--
-- Nothing is counted, nothing is ranked, and the order is time. A feed sorted
-- by anything else is a feed with an opinion about what you should care about,
-- and this one does not have one.
-- -----------------------------------------------------------------------------

drop function if exists people_feed(integer);
create or replace function people_feed(p_limit integer default 30)
returns table (
  event_id     uuid,
  actor_id     uuid,
  actor_name   text,
  actor_handle text,
  kind         text,
  subject_type text,
  subject_id   uuid,
  title        text,
  tie          text,
  happened_at  timestamptz
)
language sql security definer stable set search_path = public, extensions as $$
  with graph as (
    select followed_id as person, 'following' as tie
      from follows where follower_id = auth.uid()
    union
    select case when lower_id = auth.uid() then higher_id else lower_id end, 'friend'
      from friendships
     where (lower_id = auth.uid() or higher_id = auth.uid())
       and accepted_at is not null
  )
  select
    e.id,
    e.actor_id,
    pr.display_name,
    pr.handle,
    e.kind,
    e.subject_type,
    e.subject_id,
    coalesce(p.title, prj.title),
    g.tie,
    e.created_at
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
    and (
      (e.subject_type = 'proposal' and can_reach_proposal(e.subject_id))
      or (e.subject_type = 'project' and can_reach_project(e.subject_id))
    )
  order by e.created_at desc
  limit greatest(p_limit, 1);
$$;

grant execute on function people_feed(integer) to authenticated;

-- -----------------------------------------------------------------------------
-- Who you know
-- -----------------------------------------------------------------------------

drop function if exists my_people();
create or replace function my_people()
returns table (
  profile_id   uuid,
  display_name text,
  handle       text,
  tie          text
)
language sql security definer stable set search_path = public, extensions as $$
  select p.id, p.display_name, p.handle, g.tie
  from (
    select case when lower_id = auth.uid() then higher_id else lower_id end as person,
           'friend' as tie
      from friendships
     where (lower_id = auth.uid() or higher_id = auth.uid())
       and accepted_at is not null
    union
    select f.followed_id, 'following'
      from follows f
     where f.follower_id = auth.uid()
       and not exists (
         select 1 from friendships fr
          where fr.lower_id = least(auth.uid(), f.followed_id)
            and fr.higher_id = greatest(auth.uid(), f.followed_id)
            and fr.accepted_at is not null
       )
  ) g
  join profiles p on p.id = g.person
  order by g.tie, p.display_name;
$$;

grant execute on function my_people() to authenticated;

-- -----------------------------------------------------------------------------
-- The ledger records a submission, rather than the application remembering to
--
-- Building the feed off the ledger exposed this: `proposal.submitted` was
-- written by a server action, so a proposal that reached the table any other
-- way left no trace. Every other decisive act here — closing, activating,
-- completing, answering a flag — is recorded by the function that performs it,
-- because a tamper-evident record that depends on the caller being
-- conscientious is not one. Submission was the last one that did not, and the
-- feed would have quietly disagreed with the proposal list forever.
--
-- The server action's own call is removed in the same commit. Two writers on
-- one event is worse than none.
-- -----------------------------------------------------------------------------

create or replace function record_proposal_submitted()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
begin
  perform record_ledger_event(
    new.group_id, 'proposal.submitted', 'proposal', new.id,
    jsonb_build_object('scope', new.scope, 'place', new.place, 'title', new.title));
  return new;
end;
$$;

drop trigger if exists proposals_record_submission on proposals;
create trigger proposals_record_submission after insert on proposals
  for each row execute function record_proposal_submitted();
