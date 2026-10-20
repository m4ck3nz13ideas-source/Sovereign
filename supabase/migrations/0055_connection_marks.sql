-- =============================================================================
-- 0055 — CONNECTION MARKS: pin and mute, for your eyes only
--
-- Connection became one inbox on 20 October (Mackenzie): friends, circles,
-- groups, proposals and businesses in one list, newest first. Two controls
-- came with it:
--
--   pinned  keeps a conversation at the top of your list.
--   muted   keeps it in your list but stops its unread count from pulling it
--           up or adding to the totals on the filters.
--
-- Both are yours alone. Nobody can learn that you pinned or muted them —
-- there is no policy by which anyone else reads this table, and there must
-- not be (the same reasoning as feed_mutes, 0025).
--
-- `kind` names what `ref_id` points at:
--   person    a friend's profile id (a one-to-one chat)
--   circle    a thread id
--   group     a group id
--   proposal  a proposal id
--   business  a vendor id
--
-- No foreign key on ref_id, because it points at five different tables. A
-- mark on something that no longer exists matches nothing and does no harm.
--
-- Re-runnable.
-- =============================================================================

create table if not exists connection_marks (
  profile_id uuid not null default auth.uid() references profiles on delete cascade,
  kind       text not null,
  ref_id     uuid not null,
  pinned     boolean not null default false,
  muted      boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (profile_id, kind, ref_id),
  constraint connection_marks_kind check (kind in ('person', 'circle', 'group', 'proposal', 'business'))
);

comment on table connection_marks is
  'Pinned and muted conversations in Connection. Private to the person who set '
  'them — there is no policy by which anyone else can read a row, and there must not be.';

alter table connection_marks enable row level security;

drop policy if exists connection_marks_own on connection_marks;
create policy connection_marks_own on connection_marks for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

revoke all on connection_marks from public, anon;
grant select, insert, update, delete on connection_marks to authenticated;

-- A copy and an erasure (rule 42): yours, exported, and deleted with you.
insert into private.data_map (table_name, column_name, export, erase, erase_where, ord, why) values
  ('connection_marks', 'profile_id', true, 'delete', null, 20, 'chats you pinned or muted')
on conflict (table_name, column_name) do nothing;
