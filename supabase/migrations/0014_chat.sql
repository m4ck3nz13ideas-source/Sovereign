-- =============================================================================
-- 0014 — CHAT: the thing friendship was for
--
-- 0012 built two relationships and said friendship "carries private
-- conversation". It carried nothing. A screen that describes a capability the
-- app does not have is a lie with good intentions, and this closes it.
--
-- WHAT THIS IS NOT
--
-- It is not a back channel for governance. Nothing said here reaches a
-- proposal, a decision, a flag or the ledger, and nothing here is evidence of
-- anything. Two people talking privately about a proposal is how people have
-- always decided things and it is none of the system's business — what the
-- system holds is what they then did in the open, attributed.
--
-- WHAT IS DELIBERATELY ABSENT
--
-- Read receipts. Typing indicators. Online status. Last seen. Every one of
-- those is a mechanism for making somebody anxious about not replying, and
-- rule 1 of the overview is calm over noise. Read state exists here — but it
-- is YOURS, so the app can show you what is new. The other person cannot see
-- it and there is no policy by which they could. That inversion is the whole
-- design: you get to know where you were, they do not get to know whether you
-- have looked.
--
-- WHAT HAPPENS WHEN A FRIENDSHIP ENDS
--
-- New messages stop. The old ones stay, readable by both. Deleting your half
-- of somebody else's conversation is not something this can do honestly — the
-- words were said to them, and they have them. What either person can do is
-- delete their own message, which removes it for both, because a private
-- conversation is not a public record and there is no integrity argument for
-- holding somebody to a sentence they regret saying to one person.
-- =============================================================================

create table if not exists messages (
  id         uuid primary key default gen_random_uuid(),

  -- The pair, ordered the same way friendships are, so a conversation is one
  -- address rather than two.
  lower_id   uuid not null references profiles on delete cascade,
  higher_id  uuid not null references profiles on delete cascade,

  author_id  uuid not null references profiles on delete cascade,
  body       text not null check (length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),

  constraint messages_ordered check (lower_id < higher_id),
  constraint messages_author_is_in_it check (author_id in (lower_id, higher_id))
);

create index if not exists messages_pair_idx
  on messages (lower_id, higher_id, created_at desc);

comment on table messages is
  'Private conversation between two friends. Reaches no proposal, no decision and no ledger. No read receipts: read state is the reader''s own and the other person cannot see it.';

-- Where you had got to. Yours, and only ever yours.
create table if not exists chat_marks (
  profile_id   uuid not null references profiles on delete cascade,
  other_id     uuid not null references profiles on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (profile_id, other_id)
);

comment on table chat_marks is
  'Your own place in a conversation, so the app can show you what is new. The other person has no way to read it — that is the point.';

alter table messages enable row level security;
alter table chat_marks enable row level security;

-- Only the two of them, ever. Note what this policy does NOT say: it does not
-- ask whether they are still friends. Ending a friendship stops new messages;
-- it does not reach into what was already said.
drop policy if exists messages_read on messages;
create policy messages_read on messages for select
  using (lower_id = auth.uid() or higher_id = auth.uid());

-- Your own, and removing it removes it for both. A private conversation is not
-- a public record — there is no integrity argument for holding somebody to a
-- sentence they regret saying to one person.
drop policy if exists messages_delete_own on messages;
create policy messages_delete_own on messages for delete
  using (author_id = auth.uid());

drop policy if exists chat_marks_own on chat_marks;
create policy chat_marks_own on chat_marks for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

grant select, delete on messages to authenticated;
grant select, insert, update, delete on chat_marks to authenticated;

-- -----------------------------------------------------------------------------
-- Saying something
--
-- There is no insert policy. The only way in is this function, because "are
-- you two still friends" is a question a policy would have to ask on every
-- row, and because an unfriending that silently left the door open would be
-- the worst kind of bug here.
-- -----------------------------------------------------------------------------

create or replace function send_message(p_to uuid, p_body text)
returns uuid language plpgsql security definer
set search_path = public, extensions as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_to = auth.uid() then raise exception 'you are already in touch with yourself'; end if;

  if not is_friend(p_to) then
    raise exception 'you are not friends — a conversation here needs both of you to have agreed to it';
  end if;

  if length(btrim(coalesce(p_body, ''))) = 0 then
    raise exception 'nothing to send';
  end if;

  insert into messages (lower_id, higher_id, author_id, body)
  values (least(auth.uid(), p_to), greatest(auth.uid(), p_to), auth.uid(), btrim(p_body))
  returning id into v_id;

  -- Your own message is read by definition. Without this, sending would leave
  -- your own words sitting in your unread count, which is absurd.
  insert into chat_marks (profile_id, other_id, last_read_at)
  values (auth.uid(), p_to, now())
  on conflict (profile_id, other_id) do update set last_read_at = now();

  return v_id;
end;
$$;

create or replace function mark_conversation_read(p_other uuid)
returns void language sql security definer
set search_path = public, extensions as $$
  insert into chat_marks (profile_id, other_id, last_read_at)
  values (auth.uid(), p_other, now())
  on conflict (profile_id, other_id) do update set last_read_at = now();
$$;

grant execute on function send_message(uuid, text), mark_conversation_read(uuid)
to authenticated;

-- -----------------------------------------------------------------------------
-- Reading
-- -----------------------------------------------------------------------------

drop function if exists conversation_with(uuid, integer);
create or replace function conversation_with(p_other uuid, p_limit integer default 100)
returns table (
  id         uuid,
  author_id  uuid,
  mine       boolean,
  body       text,
  created_at timestamptz
)
language sql security definer stable set search_path = public, extensions as $$
  select m.id, m.author_id, m.author_id = auth.uid(), m.body, m.created_at
    from messages m
   where m.lower_id = least(auth.uid(), p_other)
     and m.higher_id = greatest(auth.uid(), p_other)
     and (m.lower_id = auth.uid() or m.higher_id = auth.uid())
   order by m.created_at desc
   limit greatest(p_limit, 1);
$$;

-- One row per friend, whether or not anything has been said. A conversation
-- you have not started is still a conversation you could.
drop function if exists my_conversations();
create or replace function my_conversations()
returns table (
  profile_id   uuid,
  display_name text,
  handle       text,
  last_body    text,
  last_at      timestamptz,
  last_was_mine boolean,
  unread       integer
)
language sql security definer stable set search_path = public, extensions as $$
  with friends as (
    select case when lower_id = auth.uid() then higher_id else lower_id end as person
      from friendships
     where (lower_id = auth.uid() or higher_id = auth.uid())
       and accepted_at is not null
  ),
  last_msg as (
    select distinct on (f.person)
           f.person, m.body, m.created_at, m.author_id = auth.uid() as mine
      from friends f
      left join messages m
        on m.lower_id = least(auth.uid(), f.person)
       and m.higher_id = greatest(auth.uid(), f.person)
     order by f.person, m.created_at desc
  )
  select
    p.id, p.display_name, p.handle,
    l.body, l.created_at, l.mine,
    (select count(*)::int from messages m
      where m.lower_id = least(auth.uid(), p.id)
        and m.higher_id = greatest(auth.uid(), p.id)
        and m.author_id <> auth.uid()
        and m.created_at > coalesce(
              (select last_read_at from chat_marks
                where profile_id = auth.uid() and other_id = p.id),
              '-infinity'::timestamptz))
  from last_msg l
  join profiles p on p.id = l.person
  order by l.created_at desc nulls last, p.display_name;
$$;

grant execute on function conversation_with(uuid, integer), my_conversations()
to authenticated;
