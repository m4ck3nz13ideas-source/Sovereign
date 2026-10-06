-- 0041 — Know yourself (rule 39).
--
-- Mackenzie's direction: a needs, values, beliefs and goals assessment in
-- Individual, drawing on Tony Robbins' frameworks — the six human needs, a
-- values hierarchy of what you move toward and away from, the beliefs that
-- hold you back and the ones you would rather hold, and goals written as a
-- result, a purpose and the first actions. The questions are our own words;
-- the frameworks are the inspiration.
--
-- The findings are the centre of what a person's own AI understands about
-- them: what they are driven by, what they value, what they are working
-- toward, and what to focus on next.
--
-- What it is not, deliberately:
--   * Not visible to anybody but the person. No policy lets anybody else read
--     it — not a group, not a reviewer, not the owner's app.
--   * Not an input to anything collective. No decision, review, condition,
--     ad, feed or SOV function reads it; `35_self_assessment.sql` checks.
--     It shapes the person's private AI and nothing else.
--   * Not edited after the fact. Taking it again writes a new one, so the
--     person can see how they have changed.

create table if not exists self_assessments (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null default auth.uid() references profiles(id) on delete cascade,
  needs          jsonb not null,
  values_toward  jsonb not null,
  values_away    jsonb not null,
  beliefs        jsonb not null default '[]'::jsonb,
  goals          jsonb not null default '[]'::jsonb,
  focus          text,
  focus_model    text,
  created_at     timestamptz not null default now(),

  constraint self_assessments_needs_shape check (
    jsonb_typeof(needs) = 'object'
    and needs ?& array['certainty', 'variety', 'significance', 'connection', 'growth', 'contribution']
  ),
  constraint self_assessments_toward check (
    jsonb_typeof(values_toward) = 'array' and jsonb_array_length(values_toward) between 1 and 10
  ),
  constraint self_assessments_away check (
    jsonb_typeof(values_away) = 'array' and jsonb_array_length(values_away) <= 6
  ),
  constraint self_assessments_beliefs check (
    jsonb_typeof(beliefs) = 'array' and jsonb_array_length(beliefs) <= 5
  ),
  constraint self_assessments_goals check (
    jsonb_typeof(goals) = 'array' and jsonb_array_length(goals) <= 5
  ),
  constraint self_assessments_focus_len check (focus is null or length(focus) <= 3000)
);

create index if not exists self_assessments_profile_idx on self_assessments (profile_id, created_at desc);

alter table self_assessments enable row level security;

drop policy if exists self_assessments_own_read on self_assessments;
create policy self_assessments_own_read on self_assessments
  for select using (profile_id = auth.uid());

drop policy if exists self_assessments_own_insert on self_assessments;
create policy self_assessments_own_insert on self_assessments
  for insert with check (profile_id = auth.uid());

-- The only update: the AI's focus, written once, onto your own newest one.
drop policy if exists self_assessments_own_focus on self_assessments;
create policy self_assessments_own_focus on self_assessments
  for update using (profile_id = auth.uid() and focus is null)
  with check (profile_id = auth.uid());

drop policy if exists self_assessments_own_delete on self_assessments;
create policy self_assessments_own_delete on self_assessments
  for delete using (profile_id = auth.uid());

create or replace function freeze_self_assessment()
returns trigger
language plpgsql
as $$
begin
  if new.profile_id is distinct from old.profile_id
     or new.needs is distinct from old.needs
     or new.values_toward is distinct from old.values_toward
     or new.values_away is distinct from old.values_away
     or new.beliefs is distinct from old.beliefs
     or new.goals is distinct from old.goals
     or new.created_at is distinct from old.created_at then
    raise exception 'an assessment is a record of a moment: take it again instead';
  end if;
  return new;
end;
$$;

drop trigger if exists self_assessments_freeze on self_assessments;
create trigger self_assessments_freeze before update on self_assessments
  for each row execute function freeze_self_assessment();
