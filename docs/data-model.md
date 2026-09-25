# Data model

Every table, what it is for, and why the constraints are where they are.
Source of truth is `supabase/migrations/`.

## Individual — private, always

Four tables with owner-only policies and no group-visibility path anywhere.

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

There is no repost, no follower graph, and no engagement count on the card.

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

## Indexes

Every foreign key used in a list query is indexed. The two worth naming:

- `proposal_flags (proposal_id) WHERE resolved_at IS NULL` — a partial index,
  because unanswered flags are checked on every close and every list render,
  and answered ones never need finding this way.
- `entries (profile_id, state, created_at DESC)` — the banner queries on
  Reflection, Pipeline and Profile all have this shape.
- `proposals (scope, status, submitted_at DESC) WHERE group_id IS NULL` — the
  scale feed, which never wants the group-addressed rows.
