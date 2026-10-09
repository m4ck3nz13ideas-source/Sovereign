-- 0044 — Learn (rule 41).
--
-- Mackenzie's direction: an education tab inside Individual, where a person
-- learns what is important and true for them. He chose all of it: a library
-- of lessons and courses, the Universal Laws and how Sovereign works,
-- background on the proposals they are deciding, and lessons chosen from
-- their own Know yourself results.
--
-- The lessons themselves are content and ship with the build
-- (`src/lib/learn.ts`), like the laws. What lives here is the person's side
-- of it: which lessons they have finished, and what they wrote down about
-- what is true for them.
--
-- What it is not, deliberately:
--
--   * Not visible to anybody else. Owner-only, like the journal (rule 1).
--     What somebody wrote about a lesson on Justice is not evidence of how
--     they will vote on a justice proposal, and no group or reviewer reads it.
--   * Not a credential. Finishing lessons gates nothing: no function that
--     decides who may respond, propose or reach anything reads this table.
--     Understanding before action is enforced per proposal (rule 4), by
--     reading that proposal, not by a course certificate.
--   * Not paid. Nothing mints SOV for a lesson. A reward for finishing is a
--     reward for tapping "done", which is the farmable kind (rule 33).
--   `38_learning.sql` checks all three.

create table if not exists lesson_progress (
  profile_id   uuid not null default auth.uid() references profiles(id) on delete cascade,
  lesson_id    text not null check (lesson_id ~ '^[a-z0-9-]{1,64}$'),
  completed_at timestamptz,
  reflection   text check (reflection is null or length(reflection) <= 2000),
  updated_at   timestamptz not null default now(),
  primary key (profile_id, lesson_id)
);

alter table lesson_progress enable row level security;

drop policy if exists lesson_progress_own_read on lesson_progress;
create policy lesson_progress_own_read on lesson_progress
  for select using (profile_id = auth.uid());
drop policy if exists lesson_progress_own_insert on lesson_progress;
create policy lesson_progress_own_insert on lesson_progress
  for insert with check (profile_id = auth.uid());
drop policy if exists lesson_progress_own_update on lesson_progress;
create policy lesson_progress_own_update on lesson_progress
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
drop policy if exists lesson_progress_own_delete on lesson_progress;
create policy lesson_progress_own_delete on lesson_progress
  for delete using (profile_id = auth.uid());

grant select, insert, update, delete on lesson_progress to authenticated;

comment on table lesson_progress is
  'Learn (rule 41): what a person finished and wrote. Owner-only; gates nothing; earns nothing.';
