-- =============================================================================
-- 0052 — THREADS: chats with more than two people (rule 48)
--
-- 0014 gave two friends a conversation. Connection (12 October) asked for the
-- rest: a chat with several friends at once, a chat for each group, and a
-- chat for the people working on a proposal. Three kinds of thread, one table,
-- one way in.
--
--   circle    friends you chose to talk to together. Anyone in it can add a
--             friend of theirs; anyone can leave.
--   group     every member of a Sovereign group. Membership is the group's,
--             not the thread's — join the group and you are in, leave it and
--             you are out. There is no separate roster to fall out of step.
--   proposal  the author and everybody with a live commitment to it. Those
--             are already public, attributed acts. Who RESPONDED is not, and
--             is never used here: a chat whose members were the people who
--             voted would be a list of the people who voted (rule 3).
--
-- WHAT THIS IS NOT, the same as 0014: no back channel for governance. Nothing
-- said in a thread reaches a proposal, a decision, a flag, the ledger or SOV.
-- No read receipts, no typing, no online dot. Your read place is yours.
--
-- Who may read a thread is ONE question, `in_thread()`, asked by every policy
-- and every function — the same discipline as `can_reach_proposal()`.
-- =============================================================================

do $$ begin
  create type thread_kind as enum ('circle', 'group', 'proposal');
exception when duplicate_object then null; end $$;

create table if not exists threads (
  id          uuid primary key default gen_random_uuid(),
  kind        thread_kind not null,
  name        text,
  group_id    uuid references groups on delete cascade,
  proposal_id uuid references proposals on delete cascade,
  created_by  uuid references profiles on delete set null,
  created_at  timestamptz not null default now(),

  constraint threads_shape check (
    (kind = 'circle'   and group_id is null     and proposal_id is null     and name is not null) or
    (kind = 'group'    and group_id is not null and proposal_id is null) or
    (kind = 'proposal' and proposal_id is not null and group_id is null)
  ),
  constraint threads_name_len check (name is null or length(btrim(name)) between 1 and 80)
);

create unique index if not exists threads_one_per_group    on threads (group_id)    where group_id is not null;
create unique index if not exists threads_one_per_proposal on threads (proposal_id) where proposal_id is not null;

-- Only circles keep a roster. The other two read theirs from the thing they
-- belong to, so they cannot disagree with it.
create table if not exists thread_members (
  thread_id  uuid not null references threads on delete cascade,
  profile_id uuid not null references profiles on delete cascade,
  added_by   uuid references profiles on delete set null,
  added_at   timestamptz not null default now(),
  primary key (thread_id, profile_id)
);
create index if not exists thread_members_profile_idx on thread_members (profile_id);

create table if not exists thread_messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references threads on delete cascade,
  author_id  uuid not null references profiles on delete cascade,
  body       text not null check (length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists thread_messages_thread_idx on thread_messages (thread_id, created_at desc);

create table if not exists thread_marks (
  profile_id   uuid not null references profiles on delete cascade,
  thread_id    uuid not null references threads on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (profile_id, thread_id)
);

comment on table threads is
  'Chats with more than two people: circles of friends, a group, a proposal''s author and backers. Reach no proposal, decision, ledger or SOV. Readable only through in_thread().';
comment on table thread_marks is
  'Your own place in a thread. Nobody else can read it.';

-- -----------------------------------------------------------------------------
-- The one question
-- -----------------------------------------------------------------------------

create or replace function in_thread(p_thread uuid)
returns boolean language sql security definer stable
set search_path = public, extensions as $$
  select exists (
    select 1 from threads t
     where t.id = p_thread
       and auth.uid() is not null
       and case t.kind
         when 'circle' then exists (
           select 1 from thread_members m
            where m.thread_id = t.id and m.profile_id = auth.uid())
         when 'group' then exists (
           select 1 from group_members g
            where g.group_id = t.group_id and g.profile_id = auth.uid())
         when 'proposal' then exists (
           select 1 from proposals p
            where p.id = t.proposal_id
              and (p.author_id = auth.uid() or exists (
                select 1 from commitments c
                 where c.proposal_id = p.id
                   and c.profile_id = auth.uid()
                   and c.withdrawn_at is null)))
       end
  );
$$;

alter table threads enable row level security;
alter table thread_members enable row level security;
alter table thread_messages enable row level security;
alter table thread_marks enable row level security;

drop policy if exists threads_read on threads;
create policy threads_read on threads for select using (in_thread(id));

drop policy if exists thread_members_read on thread_members;
create policy thread_members_read on thread_members for select using (in_thread(thread_id));

drop policy if exists thread_messages_read on thread_messages;
create policy thread_messages_read on thread_messages for select using (in_thread(thread_id));

-- Your own, removed for everyone, as in 0014.
drop policy if exists thread_messages_delete_own on thread_messages;
create policy thread_messages_delete_own on thread_messages for delete using (author_id = auth.uid());

drop policy if exists thread_marks_own on thread_marks;
create policy thread_marks_own on thread_marks for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- No insert or update policies on the first three: the functions are the way in.
revoke all on threads, thread_members, thread_messages, thread_marks from anon;
grant select on threads, thread_members to authenticated;
grant select, delete on thread_messages to authenticated;
grant select, insert, update, delete on thread_marks to authenticated;

-- -----------------------------------------------------------------------------
-- Circles
-- -----------------------------------------------------------------------------

-- Everyone you put in must be your friend now. Being in a circle does not make
-- two of its members friends of each other, and does not need to.
create or replace function create_circle(p_name text, p_members uuid[])
returns uuid language plpgsql security definer
set search_path = public, extensions as $$
declare v_id uuid; v_m uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if length(btrim(coalesce(p_name, ''))) = 0 then raise exception 'a circle needs a name'; end if;
  if coalesce(array_length(p_members, 1), 0) = 0 then
    raise exception 'a circle needs at least one friend in it';
  end if;
  if array_length(p_members, 1) > 49 then raise exception 'a circle is fifty people at most'; end if;

  foreach v_m in array p_members loop
    if v_m = auth.uid() then continue; end if;
    if not is_friend(v_m) then
      raise exception 'you can only add friends — % is not one', v_m;
    end if;
  end loop;

  insert into threads (kind, name, created_by)
  values ('circle', btrim(p_name), auth.uid())
  returning id into v_id;

  insert into thread_members (thread_id, profile_id, added_by)
  select v_id, x, auth.uid() from (select distinct unnest(p_members || auth.uid()) as x) s;

  return v_id;
end;
$$;

create or replace function add_to_circle(p_thread uuid, p_profile uuid)
returns void language plpgsql security definer
set search_path = public, extensions as $$
begin
  if not exists (select 1 from threads where id = p_thread and kind = 'circle') then
    raise exception 'no such circle';
  end if;
  if not in_thread(p_thread) then raise exception 'you are not in this circle'; end if;
  if not is_friend(p_profile) then raise exception 'you can only add friends'; end if;
  if (select count(*) from thread_members where thread_id = p_thread) >= 50 then
    raise exception 'a circle is fifty people at most';
  end if;
  insert into thread_members (thread_id, profile_id, added_by)
  values (p_thread, p_profile, auth.uid())
  on conflict do nothing;
end;
$$;

-- Leaving takes you out of what comes next. What you already said stays,
-- because it was said to them; delete your own messages first if you want.
create or replace function leave_circle(p_thread uuid)
returns void language sql security definer
set search_path = public, extensions as $$
  delete from thread_members
   where thread_id = p_thread and profile_id = auth.uid()
     and exists (select 1 from threads where id = p_thread and kind = 'circle');
$$;

-- -----------------------------------------------------------------------------
-- The thread for a group or a proposal, made the first time somebody who
-- belongs opens it. Somebody who does not belong gets nothing, not an empty one.
-- -----------------------------------------------------------------------------

create or replace function thread_for_group(p_group uuid)
returns uuid language plpgsql security definer
set search_path = public, extensions as $$
declare v_id uuid;
begin
  if not exists (select 1 from group_members where group_id = p_group and profile_id = auth.uid()) then
    raise exception 'you are not in this group';
  end if;
  insert into threads (kind, group_id, created_by) values ('group', p_group, auth.uid())
  on conflict (group_id) where group_id is not null do nothing;
  select id into v_id from threads where group_id = p_group;
  return v_id;
end;
$$;

create or replace function thread_for_proposal(p_proposal uuid)
returns uuid language plpgsql security definer
set search_path = public, extensions as $$
declare v_id uuid;
begin
  if not exists (
    select 1 from proposals p
     where p.id = p_proposal
       and (p.author_id = auth.uid() or exists (
         select 1 from commitments c
          where c.proposal_id = p.id and c.profile_id = auth.uid() and c.withdrawn_at is null))
  ) then
    raise exception 'this chat is for the author and the people backing it';
  end if;
  insert into threads (kind, proposal_id, created_by) values ('proposal', p_proposal, auth.uid())
  on conflict (proposal_id) where proposal_id is not null do nothing;
  select id into v_id from threads where proposal_id = p_proposal;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Talking and reading
-- -----------------------------------------------------------------------------

create or replace function send_thread_message(p_thread uuid, p_body text)
returns uuid language plpgsql security definer
set search_path = public, extensions as $$
declare v_id uuid;
begin
  if not in_thread(p_thread) then raise exception 'you are not in this chat'; end if;
  if length(btrim(coalesce(p_body, ''))) = 0 then raise exception 'nothing to send'; end if;

  insert into thread_messages (thread_id, author_id, body)
  values (p_thread, auth.uid(), btrim(p_body))
  returning id into v_id;

  insert into thread_marks (profile_id, thread_id, last_read_at)
  values (auth.uid(), p_thread, now())
  on conflict (profile_id, thread_id) do update set last_read_at = now();
  return v_id;
end;
$$;

create or replace function mark_thread_read(p_thread uuid)
returns void language plpgsql security definer
set search_path = public, extensions as $$
begin
  if not in_thread(p_thread) then return; end if;
  insert into thread_marks (profile_id, thread_id, last_read_at)
  values (auth.uid(), p_thread, now())
  on conflict (profile_id, thread_id) do update set last_read_at = now();
end;
$$;

create or replace function thread_messages_page(p_thread uuid, p_limit integer default 100)
returns table (
  id           uuid,
  author_id    uuid,
  display_name text,
  mine         boolean,
  body         text,
  created_at   timestamptz
)
language sql security definer stable set search_path = public, extensions as $$
  select m.id, m.author_id, p.display_name, m.author_id = auth.uid(), m.body, m.created_at
    from thread_messages m
    join profiles p on p.id = m.author_id
   where m.thread_id = p_thread and in_thread(p_thread)
   order by m.created_at desc
   limit greatest(least(p_limit, 500), 1);
$$;

-- What a thread is and who is in it, for its header.
create or replace function thread_info(p_thread uuid)
returns table (id uuid, kind thread_kind, title text, ref_id uuid, members integer)
language sql security definer stable set search_path = public, extensions as $$
  select t.id, t.kind,
         coalesce(t.name, g.name, pr.title),
         coalesce(t.group_id, t.proposal_id),
         case t.kind
           when 'circle' then (select count(*)::int from thread_members m where m.thread_id = t.id)
           when 'group' then (select count(*)::int from group_members gm where gm.group_id = t.group_id)
           else 1 + (select count(distinct c.profile_id)::int from commitments c
                      where c.proposal_id = t.proposal_id and c.withdrawn_at is null
                        and c.profile_id <> pr.author_id)
         end
    from threads t
    left join groups g on g.id = t.group_id
    left join proposals pr on pr.id = t.proposal_id
   where t.id = p_thread and in_thread(p_thread);
$$;

-- Every thread you could open: your circles, every group you are in, every
-- proposal you wrote or back — including the ones nobody has started yet, so
-- the list is the same whether or not anyone has spoken. `thread_id` is null
-- until somebody opens it.
create or replace function my_threads()
returns table (
  kind          thread_kind,
  ref_id        uuid,
  thread_id     uuid,
  title         text,
  last_body     text,
  last_author   text,
  last_at       timestamptz,
  unread        integer
)
language sql security definer stable set search_path = public, extensions as $$
  with mine as (
    select 'circle'::thread_kind as kind, t.id as ref_id, t.id as thread_id, t.name as title
      from threads t join thread_members m on m.thread_id = t.id
     where t.kind = 'circle' and m.profile_id = auth.uid()
    union all
    select 'group', g.id, t.id, g.name
      from group_members gm join groups g on g.id = gm.group_id
      left join threads t on t.group_id = g.id
     where gm.profile_id = auth.uid()
    union all
    select 'proposal', p.id, t.id, p.title
      from proposals p
      left join threads t on t.proposal_id = p.id
     where p.author_id = auth.uid()
        or exists (select 1 from commitments c
                    where c.proposal_id = p.id and c.profile_id = auth.uid() and c.withdrawn_at is null)
  )
  select mi.kind, mi.ref_id, mi.thread_id, mi.title,
         l.body, l.author, l.created_at,
         case when mi.thread_id is null then 0 else
           (select count(*)::int from thread_messages x
             where x.thread_id = mi.thread_id and x.author_id <> auth.uid()
               and x.created_at > coalesce(
                 (select last_read_at from thread_marks k
                   where k.profile_id = auth.uid() and k.thread_id = mi.thread_id),
                 '-infinity'::timestamptz))
         end
    from mine mi
    left join lateral (
      select x.body, pp.display_name as author, x.created_at
        from thread_messages x join profiles pp on pp.id = x.author_id
       where x.thread_id = mi.thread_id
       order by x.created_at desc limit 1
    ) l on true
   order by l.created_at desc nulls last, mi.title;
$$;

revoke all on function
  in_thread(uuid), create_circle(text, uuid[]), add_to_circle(uuid, uuid),
  leave_circle(uuid), thread_for_group(uuid), thread_for_proposal(uuid),
  send_thread_message(uuid, text), mark_thread_read(uuid),
  thread_messages_page(uuid, integer), thread_info(uuid), my_threads()
from public, anon;

grant execute on function
  in_thread(uuid), create_circle(text, uuid[]), add_to_circle(uuid, uuid),
  leave_circle(uuid), thread_for_group(uuid), thread_for_proposal(uuid),
  send_thread_message(uuid, text), mark_thread_read(uuid),
  thread_messages_page(uuid, integer), thread_info(uuid), my_threads()
to authenticated;

-- -----------------------------------------------------------------------------
-- A copy and an erasure (rule 42): what you wrote goes with you; the thread,
-- and what everybody else said in it, stays theirs.
-- -----------------------------------------------------------------------------
insert into private.data_map (table_name, column_name, export, erase, erase_where, ord, why) values
  ('thread_messages', 'author_id',  true,  'delete', null, 30,  'messages you wrote in group chats'),
  ('thread_marks',    'profile_id', true,  'delete', null, 20,  'your read state'),
  ('thread_members',  'profile_id', true,  'delete', null, 20,  'circles you are in'),
  ('thread_members',  'added_by',   false, 'keep',   null, 100, 'who added somebody else is part of their membership'),
  ('threads',         'created_by', true,  'keep',   null, 100, 'a chat you started stays with the people in it')
on conflict (table_name, column_name) do nothing;
