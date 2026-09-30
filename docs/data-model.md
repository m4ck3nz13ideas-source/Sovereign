# Data model

Every table, what it is for, and why the constraints are where they are.
Source of truth is `supabase/migrations/`.

## Individual — private, always

Owner-only policies and no group-visibility path anywhere. `profiles`,
`entries`, `concepts`, `concept_entries`, `statement_revisions`,
`profile_values`, `profile_passions`, `guardian_notes` and `law_acceptances`.

### `profiles`
One row per auth user, created automatically by a trigger on `auth.users`.

`place_local`, `place_regional`, `place_national` and `place_continental` are
where this person is, as they wrote it, with `place_set_at`. These decide
eligibility for every place-addressed proposal. Never a coordinate — matching
goes through `place_key()`, which lowercases and collapses whitespace so the
stored text can stay exactly as typed.

Holds the current `faith_statement` and `purpose` alongside their
`*_updated_at`. Disclosure is three booleans — `share_values`, `share_purpose`,
`share_faith` — all false by default. Column-level disclosure is handled by the
`public_profiles` view, which returns null for anything not shared, because RLS
operates on rows rather than columns.

### `entries`
Everything written in Launch. One table, four modes, and the mode alone decides
where it surfaces:

| mode | surfaces in |
|---|---|
| `journal` | Reflection |
| `faith` | Profile |
| `idea` | Pipeline |
| `output` | Connection |

There is no routing state and no destination column. An entry is `unexamined`
until it is sat with, then `examined`. `expanded_body` holds the longer version
when someone chose to develop it rather than file it.

### `concepts` and `concept_entries`
Pipeline's knowledge store. `source_path` is set when a concept came from a
markdown file, so re-importing that path updates rather than duplicates — this
is what makes a future vault sync an adapter rather than a migration.

`concept_entries` links the ideas that fed a concept. The entries stay; the
link is the work.

### `statement_revisions`
Every version of a faith or purpose statement, never overwritten.

**Always private, even when the current statement is shared.** How a belief
moved is a different thing from what it currently is, and the second being
public should not make the first public.

### `profile_values`, `profile_passions`
What you value, with your own definition of each, and what you keep returning
to. Unique on `(profile_id, name)` for values. These are the rubric every
proposal is scored against — a review reads the union of the group's members'
value names and definitions, and a group whose members have named nothing gets
scored on nothing, which is why onboarding insists on at least one.

### `guardian_notes`
Every row exists because somebody pressed something. `questions` and `gaps` are
jsonb, `reading` is one paragraph addressed to its owner, and the prompt id,
version and model are recorded like every other AI artefact so a reading can be
traced to the rubric behind it.

Owner-only `for all`, with no share path. It holds no `verdict`, `score`,
`recommendation`, `alignment`, `profile_model`, `inferred_values` or
`sentiment` column, and the suite asserts each of those absences — they are the
difference between a counsel and a handler. `proposal_id` is null for a note
about a draft, because a draft does not exist anywhere but its author's browser.

It is also the only thing in this schema that can be forgotten
(`forget_guardian_notes()`), because nobody else is entitled to it.

### `law_acceptances`
One row per person, per law, per revision of its wording, with `accepted_at`.
Primary key across all three.

Not a boolean, and the reason is rule 24: the wording of a law can be amended,
so "agreed to the laws" would claim consent to whatever the text has since
become. `accept_universal_law()` takes the law ids the screen displayed and
stamps the revision itself — a client that could name the revision could name
an older and weaker one — and refuses any call that does not name ten, because
the constitution is ten.

No update policy and no delete policy. An acceptance is a record of what
somebody read on a date; one that can be revised afterwards is not a record. An
amendment leaves every prior row standing and surfaces through
`my_law_accession().amended_since`.

**It gates nothing.** Nothing in `can_reach_proposal()` or `cast_resonance()`
reads this table, and the suite fails if either ever does. Accession is a
record, not a permission system.

## Collective — visible to one group, or to one place

### `groups`
Name, purpose, scope, and three thresholds:

| | default | what it does |
|---|---|---|
| `threshold_alignment` | 0.600 | mean alignment a proposal must reach |
| `threshold_participation` | 0.600 | share of members who must respond |
| `threshold_values_floor` | 0.300 | below this, a value score becomes a flag |

These are guesses and they are meant to be tuned. They are editable in Settings
and readable by every member, because a group being governed by a rule should
be able to read the rule.

### `group_members`, `group_invites`
Invite-only. `redeem_invite()` is `SECURITY DEFINER` and checks expiry and use
count. There is no self-join path and no public directory.

### `scope_rules`
One row per scale, seeded by `0006`. `threshold_alignment` is 0.618 everywhere;
`min_voices` and `deliberation_days` rise with the scale.

Readable by everyone — `using (true)` — and there is no insert, update or
delete policy at all, so an instance operator changes it in SQL, deliberately.
A person governed by a rule can read the rule.

Local ships at one voice and no waiting period so a new instance can get
through a decision on day one. It is the first number to raise.

### `proposals`
Only submitted proposals exist here.

**Six sections.** `intent`, `change`, `constraints`, `risks`, `alternatives`
and the optional `evidence`, with minimum lengths on the first five in
`proposals_sections`. `body` is these concatenated, built in exactly one place
so the hash below cannot drift from what was read. `readiness` and
`body_sha256` are stamped by the trigger, not supplied by the client.

**Addressed to a group or to a place.** `group_id` is nullable; when it is
null the proposal is addressed to `place` at `scope`, and `proposals_addressed`
checks that one of the two is present (global needs no place). `closes_at` is
set by the `proposals_set_window` trigger at insert, from the scale's rule.

`freeze_proposal_address()` refuses any update that changes `group_id`,
`scope`, `place` or `closes_at`. The author-withdraw policy permits withdrawal,
not re-aiming.

Eligibility everywhere below is `can_reach_proposal()` — membership for a group
proposal, `in_scope()` for a place one. The one exception is `proposals_read`
itself, which is written against the row's own columns: a function that looks
the proposal up cannot see the row an `INSERT ... RETURNING` is in the middle
of writing. Drafts live in the author's browser — the
private-first rule made structural rather than enforced by a status column.

Not editable after submission. The RLS policy allows an author to update only
while `in_review` or `in_deliberation`, and the UI offers no edit path:
amendments go in the deliberation thread where the group can see what changed,
and a failed proposal is rewritten as a new one.

Status moves forward only:

```
in_review ──► in_deliberation ──► voting ──► passed ──► executing ──► completed
                                         └──► failed
```

`in_review → in_deliberation` happens when the review lands.
`in_deliberation → voting` happens on the first resonance recorded — there is
no separate "open voting" step, because the sliders unlock on understanding,
not on an administrative action.

### `proposal_reviews`
One row per review run, with `prompt_id`, `prompt_version` and `model` stored
alongside the scores. Any score can be traced back to the exact rubric that
produced it.

`values_alignment` is `{ "<value name>": 0.0–1.0 }`, keyed by the group's own
value names. `memory_used` records which past decisions the reviewer actually
drew on — an empty array is a real answer, not a failure.

### `proposal_flags`
A flag is created for any value scored below the group's floor, or any
high-severity risk.

The `flags_resolve` policy requires the update to carry a resolution of at
least twenty characters attributed to the caller. **There is no delete policy
and no path to null a resolution.** A flag cannot be dismissed, only answered.

An unresolved flag fails the proposal regardless of every other number. This is
the mechanism that lets a weak proposal be retired early without anyone having
to be the person who objected.

### `deliberation_comments`
`kind` is one of `question`, `amendment`, `alternative`, `concern` at the top
level, or `reply` underneath. `comments_kind_shape` enforces both directions —
a top-level contribution cannot be a reply, and a reply cannot be a question —
because everything counted downstream depends on the kinds meaning something.

`answer`, `answered_by`, `answered_at` on questions and concerns. Twenty
characters, attributed, and no policy permits an answer to change or be
removed. `adopted_at` on amendments only: the author saying they will carry it
into a rewrite. It alters nothing about the live proposal, whose text is frozen.

An unanswered question or concern does **not** fail a proposal. It is shown
above the sliders and counted onto the decision. A flag is the review finding
something below the group's floor; a concern is a person disagreeing, and one
person able to hold a proposal until satisfied is a veto.

### `debate_summaries`
One row per reading of a thread, with `covers` — the number of contributions it
was written across, so a stale summary is visibly behind rather than quietly
wrong. `polarization` is a reading of the argument, never of the votes, which
are hidden until close.

No update policy and no delete policy. A summary that was wrong is superseded
by a later one and both stay, the same rule as a superseded law reading.

### `resonance_votes`
Three dimensions, each constrained to 0–1: alignment, confidence, urgency.

Two policies. You may always read and write your own row. You may read
everyone's rows only once the proposal has closed. The aggregate comes from
`resonance_summary()`, which returns counts always and averages only once
closed.

The counts matter: a member should be able to see that the group has
responded. The averages are the problem — a running average changes what people
report.

There is no `resonance_summary` *view*, deliberately. A `security_invoker` view
would inherit the policy and count only the caller's own vote; a
`security_definer` view would leak live averages to anyone who queried it. The
function checks membership itself and withholds the numbers.

### `proposal_readiness`
The sharpening a draft had to clear. Written before the proposal exists, so
`proposal_id` is null until submission binds it — and while it is null the row
is readable only by its author, which is the private-first rule holding for
things derived from a draft as well as the draft itself.

`body_sha256` binds a reading to one exact text. No update policy and no
delete policy: a sharpening is not revised, a rewritten draft gets a new one,
and the old reading stays.

`bind_proposal_readiness()` takes `min(readiness)` across the author's
unattached readings of this text, not the most recent. Asking again about the
same words can only lower where they stand.

### `proposals.supersedes`
The thread back to the proposal a second attempt was written from. Nullable,
self-referencing, `on delete set null` — losing the original should lose the
link, not the attempt.

`check_supersedes()` requires the same address, so taking one up again cannot
move a proposal that failed in one place to a friendlier one and call it the
same idea. Nothing else is inherited: the new proposal is sharpened and
audited from scratch.

### `law_assessments`, `law_challenges`
One row per law per audit, so an audit always covers all ten — a missing row
means the audit did not finish, rather than "nothing to report". There is no
policy permitting `verdict` to change and none permitting a delete; a tension
gains a `resolution`, and a violation gains nothing.

`superseded_at` marks readings replaced by a later audit after a challenge.
The old ones stay.

### `proposal_needs`, `commitments`
What a proposal would take, and who has actually said yes. Quantities rather
than prose, so `activation_standing()` can answer the question mechanically.
`commitments_own` restricts insert and update to `profile_id = auth.uid()`:
nobody commits anyone else.

### `decisions`
Written by `close_proposal()`, which applies the rule — Universal Law first,
and not as a threshold:

```
passed  ⟺  no Universal Law violation
       ∧  no unanswered Universal Law tension
       ∧  no unresolved critical flag
       ∧  participation ≥ threshold_participation
       ∧  mean alignment ≥ threshold_alignment   (0.618 by default)
```

A proposal that passes stops at `passed`. `activate_proposal()` creates the
project, and only once every need has a name against it.

`dispersion` is the population standard deviation of alignment and `polarized`
marks a real split — spread, with both ends occupied. A mean alone reports
everyone-at-0.50 and half-at-0.10-half-at-0.90 identically, and those are not
the same group. `open_questions` and `open_concerns` record what was still
unanswered when the group decided.

`participation` is **null** for a place decision, and `member_count` is zero.
There is no register of everyone in a city, so there is no share to compute —
`voter_count` against the scale's `min_voices` is what the rule actually
applied, and that is what the interface shows.

Stores the numbers as they were at the moment of closing, so changing a
threshold later never reinterprets a past decision. `values_invoked` is the
union of value names the review scored — this is the key retrieval runs on.

### `projections`
Dated, falsifiable predictions attached to a proposal before it closes. An
`effect` is what it is meant to do; a `risk` is what it might cost, and both
are marked the same way. `statement` is 20–240 characters, `horizon_days` 1 to
3650 — days from the decision, not a date, because the decision has not
happened yet. `source` records whether the words were a model's or a person's,
and `created_by` records who put them on the record; both, always.

No insert policy and no delete policy: the only way in is `record_projection()`,
which refuses once the proposal has closed, and there is no way out at all. A
trigger rejects any edit to the words. The one permitted update is a
resolution, and `resolve_projection()` allows an early mark only as `held` — an
observation can arrive ahead of schedule, a failure cannot be declared before
the horizon it was given.

`complete_project()` refuses while a projection that has come due is unmarked.

### `contentions`, `contention_members`, `preferences`
Two or more proposals that cannot both happen, and the order the survivors go
looking for resources in. A contention carries the shared address — group, or
scope and place — and every member has to match it, which is what stops one
street's proposal being contended against another's.

A unique index gives a proposal at most one set. `preferences` is keyed on
`(contention_id, profile_id)`, so one first choice each, and it has no readable
select policy beyond your own until `resolved_at` is set — the same withholding
as resonance averages and for the same reason.

**A preference orders, it never passes.** `close_proposal()` settled each
proposal on its own terms and a contention cannot reach back into it; what
`activate_proposal()` does is refuse to start while a sibling with more
preferences is still live. `stand_down_proposal()` needs twenty attributed
characters and is the only thing that releases the next answer.

### `law_revisions`
An amended wording of one of the ten. `revision` starts at 2 — revision 1 is
the shipped text in `src/lib/universal-law.ts` and never appears here. Unique
on `(law_id, revision)`.

`adopted_from` is `not null references proposals on delete restrict`: there is
no other way a row gets here, and the proposal that carried it cannot be
deleted out from under it. Written only by `enact_amendment()`, which refuses
unless the **lowest** single voice is at `amendment_threshold()` or above — not
the mean, because a mean lets a majority carry a constitution over a minority's
objection. `law_assessments.law_revision` records which wording produced a
verdict.

There is no repeal, no merge and no eleventh law anywhere in the schema.

### `personhood_proofs`
Keyed by `profile_id`, so one per person. Holds `method`, the `provider` that
did the seeing, that provider's own word for `level`, and the **nullifier** —
opaque, per-application, stable for one human, at least 16 characters. A
partial unique index makes it unique across everyone not revoked.

That is the entire record. No name, no document, no image, no biometric, and
nowhere to put one. Only the person can revoke their own.

Required to resonate only where `scope_rules.require_personhood` says so — off
locally and regionally, on from national up — and never for reading, writing,
asking or objecting, and never inside a group. Every decision stores
`verified_voices` whether the scale asked for it or not.

### `inquiries`, `positions`
A question a proposal turns on, and what several ways of knowing hold about
it. The lens enum is `empirical`, `scripture`, `philosophy`, `literature`,
`screen`, `practice`, `testimony`.

**It returns a survey, never an answer**, and the schema is what enforces that
rather than the copy. `positions` carries no score, rank, weight, confidence or
verdict column and there is nowhere to put one — a ranked survey is an answer
wearing a survey's clothes. `ordinal` is the order the lenses came back in and
nothing else. `record_inquiry()` refuses fewer than two *distinct* lenses,
because one position speaking alone is an oracle with extra steps.

No insert policy on either table: the function is the only way in, which is
what makes that floor a rule rather than a request. No update policy anywhere —
asking again makes a new inquiry rather than editing an old one. Read follows
the proposal, because research only its asker can see is research somebody
repeats. The asker alone may withdraw their own, which is permitted here and
nowhere else in the schema: an inquiry reaches no decision, unlike a flag, a
concern or a projection.

`source_hint` names a work or thinker to go and read. It is not a citation and
the screen says so every time it renders one. The mock adapter **refuses** to
produce a survey at all rather than inventing one.

## Projects and Impact

### `projects`
Created by `activate_proposal()`, keyed by `proposal_id`, which is also how the
URL addresses it: the project is downstream of the decision, not a separate
thing. `group_id` is nullable and inherited, so a project inherits its
proposal's address and `can_reach_project()` answers who can see it.

`budget_committed` comes from the proposal. `budget_spent` accumulates from
`project_updates.spend_delta` through the `Treasury` interface.

### `reflections`
One per project. `actual_outcome` has a check constraint of eighty characters,
and `complete_project()` refuses to run without a row here.

This is the only hard gate on finishing something, and it is the one that makes
the system able to learn: `related_decisions()` joins through here, so a group
that writes nothing gets reviews that know nothing.

`assumption_wrong` is optional and is the most valuable field in the schema.

## The ledger

### `ledger_events`
Append-only, hash-chained per group. Each row's `hash` commits to `prev_hash`,
so a removed or altered row is detectable by replay.

**No insert policy at all.** Writes go only through `record_ledger_event()`, so
a client cannot forge, reorder or backdate an event. Read access follows group
membership — and events with a null `group_id`, which is every place-addressed
governance act, are readable by anyone. That is deliberate: a decision taken in
the open should be auditable in the open.

`verify_ledger()` replays and returns the first `seq` at which the chain
breaks. See `docs/architecture.md` for exactly what that does and does not
prove.

## Connection

`posts`, `post_reactions`, `post_comments`. A post with a `group_id` is visible
to that group; without one, to anyone sharing a group **or a local place** with
the author. Local is the only scale used here — sharing a continent is not a
relationship, and a feed that behaved as though it were would be the thing this
product is not.

There is no repost and no engagement count on the card.

## People

### `follows`, `friendships`
A follow is one-way and public to the person followed; a friendship is mutual
and has to be asked for. `friendships` is keyed on `(lower_id, higher_id)` with
a check that `lower_id < higher_id`, so a pair is one row rather than two, and
`requested_by` plus a nullable `accepted_at` carry the asking. Asking back is
how you accept.

**The graph never touches eligibility.** It decides whose work reaches your
feed and who you can talk to, and nothing else. `can_reach_proposal()` is the
only answer to who may resonate, read or reach a proposal, and the moment the
graph gets a vote this is a different product.

There is no directory. `find_person()` matches an exact handle and nothing
else — no prefix search, no listing, no people-you-may-know — and nobody can
read anybody else's follow graph. `person_standing()` returns counts of
finished acts and no ratio anywhere: "written 12, passed 3" is a record, and
"25%" is a score, and the distance between them is one division.

`people_feed()` reads acts off the ledger — submissions, decisions, projects,
marked predictions — in time order. Resonance is excluded on purpose: "four
people you follow have responded to this" is the most effective engagement
mechanic there is, and it is the bandwagon that hiding live averages exists to
prevent, wearing a friendly face.

### `messages`, `chat_marks`
Private conversation between friends, addressed by the same ordered pair as
`friendships` so a conversation is one address rather than two. A check
constrains `author_id` to one of the pair. `send_message()` requires
`is_friend()`; a delete policy covers your own messages only.

**A chat reaches nothing.** No proposal, no decision, no ledger entry, and
nothing said in one is evidence of anything.

`chat_marks` is read state, keyed on `(profile_id, other_id)`, and it belongs
to the reader — the other person has no policy by which to see it. There are no
`read_at`, `seen_at` or `typing` columns anywhere, and there will not be: each
one is a mechanism for making somebody anxious about not replying. Ending a
friendship stops new messages and leaves the old ones readable by both.

## Functions

| Function | What it guarantees |
|---|---|
| `is_group_member`, `is_group_steward` | Membership checks that do not recurse through RLS |
| `create_group`, `create_invite`, `redeem_invite` | Invite-only membership |
| `resonance_summary` | Counts always, averages only once closed |
| `cast_resonance` | A review exists, and this member has read it |
| `resolve_flag` | Answered in writing, attributed, permanent |
| `law_standing` | Violations, unanswered tensions, and whether the audit ran at all |
| `resolve_law_tension` | Answers a tension; refuses on a violation |
| `close_proposal` | The decision rule, law first. Stops at `passed` |
| `activation_standing`, `need_standing` | What a proposal still needs |
| `activate_proposal` | Creates the project, only when nothing is short |
| `honour_commitment` | Self-attested delivery of a pledge |
| `complete_project` | No completion without a reflection |
| `related_decisions` | Retrieval by value overlap, with outcomes |
| `contribution_record` | A derived record — no score, no token |
| `record_ledger_event`, `verify_ledger` | The chain, and its replay. `verify_ledger(null)` is the public one |
| `readiness_threshold`, `proposal_body_hash` | The bar, and the hash that binds a reading to a text |
| `bind_proposal_readiness` | No submission without a sharpening of this exact draft |
| `place_key` | One normalised form, so a place matches however it is typed |
| `in_scope` | Whether a person is in a place at a scale |
| `can_reach_proposal`, `can_reach_project` | The single eligibility question |
| `can_steward_proposal` | Author, or a steward of the group it belongs to |
| `related_decisions_for` | Retrieval from the same address, not the same author |
| `scope_counts` | What is open at each scale this person is in |
| `answer_contribution`, `adopt_amendment` | Answered in writing; adopted without touching the text |
| `debate_standing` | Questions, concerns, amendments, and how many are open |
| `alignment_shape` | Whether a mean describes one group or two |
| `attention_queue` | What is blocked here, and on whom — ordered by what blocks it |
| `dormant_proposals` | Failed for want of people, never for want of merit |
| `signal_feed` | Governance acts, straight off the ledger |
| `record_projection`, `resolve_projection` | Frozen before the vote; early only as `held` |
| `projection_standing`, `forecast_record`, `due_projections` | What was claimed, how it went, and what has come due |
| `is_verified_person`, `record_personhood`, `revoke_personhood` | One human, one nullifier, revocable only by them |
| `verified_voice_count`, `personhood_standing` | How many voices were proved, whether or not the scale asked |
| `follow_person`, `request_friendship`, `accept_friendship`, `end_friendship` | The graph, which decides reach and nothing else |
| `find_person` | Exact handle only. There is no directory |
| `person_standing`, `people_feed`, `my_people` | Counts of finished acts, and acts off the ledger — never a ratio |
| `send_message`, `mark_conversation_read`, `my_conversations` | Friends only; read state belongs to the reader |
| `open_contention`, `add_to_contention`, `set_preference` | A clash somebody noticed, and one first choice each |
| `resolve_contention_if_ready`, `contention_standing` | Counts withheld until every member has closed |
| `stand_down_proposal` | Twenty attributed characters, and the only release |
| `law_current_revision`, `law_text`, `amendment_history` | Which wording is in force, and how it got there |
| `amendment_threshold`, `amendment_would_reopen`, `enact_amendment` | Every voice, not the mean |
| `guardian_context`, `my_guardian_notes`, `forget_guardian_notes` | Your own values and nothing else — and it can be forgotten |
| `mirror_floor`, `my_law_mirror`, `my_mirror_standing` | Derived, private, no argument, nothing below four |
| `accept_universal_law`, `my_law_accession`, `accession_standing` | Ten laws, the revision stamped here, and no way to edit it after |
| `record_inquiry`, `inquiries_for`, `positions_for` | Two lenses minimum, no ranking anywhere, and it counts towards nothing |

## Indexes

Every foreign key used in a list query is indexed. The two worth naming:

- `proposal_flags (proposal_id) WHERE resolved_at IS NULL` — a partial index,
  because unanswered flags are checked on every close and every list render,
  and answered ones never need finding this way.
- `entries (profile_id, state, created_at DESC)` — the banner queries on
  Reflection, Pipeline and Profile all have this shape.
- `proposals (scope, status, submitted_at DESC) WHERE group_id IS NULL` — the
  scale feed, which never wants the group-addressed rows.
