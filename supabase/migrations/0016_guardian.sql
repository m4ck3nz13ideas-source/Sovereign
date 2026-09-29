-- =============================================================================
-- 0016 — THE GUARDIAN: a reader that never speaks first
--
--   "Personal AI Guardian | Individual Space | Helps you think, learn, draft,
--    reflect."                                        Overview, Role of AI
--   "AI Guardian: personal assistant ensuring lawful participation."
--   "AI should always: clarify, summarize, simulate, guide. AI should never
--    feel like it is: ruling, manipulating, forcing, replacing consent."
--
-- Two readings of "a personal AI trained on your values, ensuring lawful
-- participation" are available, and one of them is a catastrophe.
--
-- The catastrophe: a thing that reads your private journal, builds a model of
-- what you believe from how you have voted, and then tells you how to vote
-- next. That is surveillance with a friendly face, and it replaces the consent
-- the overview says AI must never replace. It would also be the single most
-- valuable thing in this database to an attacker, and the most corrosive thing
-- in it to the person it is supposedly serving.
--
-- What is built instead:
--
--   1. IT NEVER SPEAKS FIRST. Every output is a response to somebody pressing
--      something. No notifications, no nudges, no "have you considered". Rule
--      1 of the overview is calm over noise, and an AI that starts
--      conversations is the opposite of calm whatever it says.
--
--   2. IT HAS NO OPINION ABOUT A DECISION. It does not tell you how to
--      resonate, does not score a proposal for you, does not say whether it
--      matches your values. It asks you questions. The difference between
--      "this conflicts with what you said you care about" and "you said you
--      care about X and this does not mention X — is that a gap?" is the
--      difference between a guardian and a handler.
--
--   3. IT LEARNS NOTHING. No behavioural profile, no inferred preferences, no
--      running model of you. What it knows about you is what you WROTE in your
--      own values — which you can read, edit and delete. A guardian that
--      builds a picture of you from what you read and how you voted is the
--      surveillance product again, arriving by a side door.
--
--   4. IT REACHES NOTHING. Nothing it produces touches a proposal, a decision,
--      a flag or the ledger. Like a chat, and for the same reason: what the
--      system holds is what you then did in the open, attributed.
--
-- Everything here is owner-only, with no share path and no group-visibility
-- path — rule 1 of this codebase. And unlike every governance record, THIS one
-- can be deleted, because it is yours and it is not evidence of anything.
-- =============================================================================

do $$ begin
  if not exists (select 1 from pg_type where typname = 'guardian_kind') then
    -- prepare: before you respond to somebody else's proposal.
    -- draft:   before you submit your own, so a problem is yours to fix in
    --          private rather than something a public audit finds for you.
    create type guardian_kind as enum ('prepare', 'draft');
  end if;
end $$;

create table if not exists guardian_notes (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles on delete cascade,
  kind        guardian_kind not null,

  -- What it was about. A proposal for 'prepare'; null for a draft, which does
  -- not exist anywhere but the author's browser until it is submitted.
  proposal_id uuid references proposals on delete cascade,

  -- [ "question" ] — things for you to answer to yourself, not for anybody.
  questions   jsonb not null default '[]'::jsonb,
  -- [ { value, note } ] — where something you wrote down is not addressed.
  gaps        jsonb not null default '[]'::jsonb,
  -- One paragraph, to you. Never a recommendation.
  reading     text,

  prompt_id      text not null,
  prompt_version text not null,
  model          text not null,
  created_at  timestamptz not null default now()
);

create index if not exists guardian_notes_mine
  on guardian_notes (profile_id, created_at desc);

comment on table guardian_notes is
  'Private notes from your own guardian. Owner-only with no share path. Reaches no proposal, no decision and no ledger, and stores no model of you — what it knows is what you wrote in your values.';
comment on column guardian_notes.questions is
  'Questions for you to answer to yourself. Never a recommendation and never a score.';

alter table guardian_notes enable row level security;

-- Yours. Every verb, and nobody else's, ever. Note there is no policy here
-- mentioning groups, places or stewardship: if one ever appears, this has
-- stopped being a private counsel and become a record about a member.
drop policy if exists guardian_own on guardian_notes;
create policy guardian_own on guardian_notes for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

grant select, insert, delete on guardian_notes to authenticated;

-- -----------------------------------------------------------------------------
-- What it is allowed to be given
--
-- The guardian is handed a proposal you can already read and the values YOU
-- wrote down. That is the whole context, and this function is what says so in
-- a place a reviewer can check.
--
-- Not given: your journal, your drafts, your ideas, how you resonated on
-- anything, what you have read, who you follow, your chats. Some of those
-- would be genuinely useful and every one of them is the beginning of the
-- surveillance version. If a future change needs more context, it should be
-- added here, visibly, rather than quietly widened in a server action.
-- -----------------------------------------------------------------------------

drop function if exists guardian_context();
create or replace function guardian_context()
returns table (
  value_name  text,
  definition  text
)
language sql security definer stable set search_path = public, extensions as $$
  select v.name, v.definition
    from profile_values v
   where v.profile_id = auth.uid()
   order by v.position;
$$;

grant execute on function guardian_context() to authenticated;

-- -----------------------------------------------------------------------------
-- What it has said to you, and forgetting it
-- -----------------------------------------------------------------------------

drop function if exists my_guardian_notes(integer);
create or replace function my_guardian_notes(p_limit integer default 30)
returns table (
  id          uuid,
  kind        guardian_kind,
  proposal_id uuid,
  title       text,
  questions   jsonb,
  gaps        jsonb,
  reading     text,
  model       text,
  created_at  timestamptz
)
language sql security definer stable set search_path = public, extensions as $$
  select n.id, n.kind, n.proposal_id, p.title, n.questions, n.gaps, n.reading,
         n.model, n.created_at
    from guardian_notes n
    left join proposals p on p.id = n.proposal_id
   where n.profile_id = auth.uid()
   order by n.created_at desc
   limit greatest(p_limit, 1);
$$;

grant execute on function my_guardian_notes(integer) to authenticated;

-- Forgetting is a real verb here, unlike anywhere else in this schema. A
-- governance record is kept because other people are entitled to it. Nobody
-- is entitled to this.
create or replace function forget_guardian_notes()
returns void language sql security definer
set search_path = public, extensions as $$
  delete from guardian_notes where profile_id = auth.uid();
$$;

grant execute on function forget_guardian_notes() to authenticated;
