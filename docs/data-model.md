# Data model

Every table, what it is for, and why the constraints are where they are.
Source of truth is `supabase/migrations/`.

## Individual — private, always

Four tables with owner-only policies and no group-visibility path anywhere.

### `profiles`
One row per auth user, created automatically by a trigger on `auth.users`.

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

## Collective — visible to one group

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

### `proposals`
Only submitted proposals exist here. Drafts live in the author's browser — the
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

Stores the numbers as they were at the moment of closing, so changing a
threshold later never reinterprets a past decision. `values_invoked` is the
union of value names the review scored — this is the key retrieval runs on.

## Projects and Impact

### `projects`
Created automatically when a proposal passes, keyed by `proposal_id`, which is
also how the URL addresses it: the project is downstream of the decision, not a
separate thing.

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
membership.

`verify_ledger()` replays and returns the first `seq` at which the chain
breaks. See `docs/architecture.md` for exactly what that does and does not
prove.

## Connection

`posts`, `post_reactions`, `post_comments`. A post with a `group_id` is visible
to that group; without one, to anyone sharing a group with the author.

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
| `record_ledger_event`, `verify_ledger` | The chain, and its replay |

## Indexes

Every foreign key used in a list query is indexed. The two worth naming:

- `proposal_flags (proposal_id) WHERE resolved_at IS NULL` — a partial index,
  because unanswered flags are checked on every close and every list render,
  and answered ones never need finding this way.
- `entries (profile_id, state, created_at DESC)` — the banner queries on
  Reflection, Pipeline and Profile all have this shape.
