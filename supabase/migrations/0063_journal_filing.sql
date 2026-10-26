-- 0063 — The journal files itself (Vault › Journal).
--
-- Mackenzie, 26 October 2026: "make it simple to journal and automatically
-- file with option to edit and then store it as a section in the vault".
--
-- Every journal entry gets a FOLDER — one of the five Know yourself areas
-- (Health, Relationships, Money, Work, Purpose), or none ("Other") — and up
-- to eight LABELS. The app files it when it is written; the person can move
-- it or relabel it with a tap, and from then on `filed_by = 'you'` and the
-- app never refiles it. Filing is the whole examination now, so a new
-- journal entry is written straight as examined: nothing waits in a pile.
--
-- Same table, same owner-only policy (entries_own, 0002): nobody else can
-- read a folder or a label, exactly as nobody else can read the entry.

alter table entries add column if not exists folder    text;
alter table entries add column if not exists labels    text[] not null default '{}';
alter table entries add column if not exists filed_by  text   not null default 'auto';
alter table entries add column if not exists filed_at  timestamptz;
alter table entries add column if not exists edited_at timestamptz;

do $$ begin
  alter table entries add constraint entries_folder_known
    check (folder is null or folder in ('Health', 'Relationships', 'Money', 'Work', 'Purpose'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table entries add constraint entries_filed_by_known
    check (filed_by in ('auto', 'you'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table entries add constraint entries_labels_few
    check (coalesce(array_length(labels, 1), 0) <= 8);
exception when duplicate_object then null; end $$;

create index if not exists entries_journal_folder
  on entries (profile_id, mode, folder, created_at desc);
create index if not exists entries_labels on entries using gin (labels);

-- Journal entries already waiting are filed by being read: the Journal
-- screen labels any it finds with filed_at null the first time it opens.
update entries
   set state = 'examined', examined_at = coalesce(examined_at, now())
 where mode = 'journal' and state = 'unexamined';
