# Architecture

## The stack

Next.js 16 (App Router, React 19, TypeScript strict), Tailwind v4, Supabase for
Postgres, auth and row-level security. Deployable to Vercel's free tier against
Supabase's free tier.

Server Components for reading, Server Actions for writing. There is no API
layer between the pages and the database, because there is no second consumer
to justify one — a mobile client or a public API would be the reason to add it.

```
Browser
  │
  ├── Server Components ──────► Supabase (as the signed-in user, RLS applies)
  ├── Server Actions ─────────► Supabase RPC (the rules that must always hold)
  │                        └──► src/lib/ai      (server-only, key never ships)
  │                        └──► src/lib/ledger  (the seam)
  └── Client Components: only where interaction genuinely needs them
```

## Where the rules live

The rules that define the product are in the **database**, not the interface.
This is the single most important structural decision here.

A disabled slider is a courtesy to the person using it. `cast_resonance()`
refusing without a recorded read is the rule. The difference matters because
the interface is one client of many possible ones, and because a rule that
lives in a React component is a rule that a future refactor can quietly delete.

| Rule | Where it is enforced |
|---|---|
| Individual data is private | RLS on `entries`, `concepts`, `statement_revisions` |
| Drafts never reach the store | No draft state exists in Postgres at all |
| Averages hidden until close | RLS on `resonance_votes` + `resonance_summary()` |
| Understanding before action | `cast_resonance()` |
| A flag is answered, not dismissed | `resolve_flag()` + the `flags_resolve` policy |
| **A Universal Law violation is final** | `cast_resonance()`, `close_proposal()`, and no policy permitting a verdict to change |
| **A tension is answered, not waived** | `resolve_law_tension()`, which refuses on a violation |
| The decision rule | `close_proposal()` |
| **Ratification is not activation** | `close_proposal()` stops at `passed`; only `activate_proposal()` creates a project |
| **A proposal activates only when resourced** | `activate_proposal()` + `activation_standing()` |
| **Nobody commits anyone else** | `commitments_own` policy: `profile_id = auth.uid()` |
| No completion without reflection | `complete_project()` + a length check |
| The ledger cannot be forged | No insert policy; `record_ledger_event()` only |

Several of these are `SECURITY DEFINER` functions that check membership
themselves. That is deliberate: they need to do something the caller cannot do
directly — read everyone's votes to compute a mean, write to a table with no
insert policy — while still refusing a caller who has no business asking.

## Row-level security

Every table has RLS on. The shape is:

- **Individual tables** — owner only. `profile_id = auth.uid()`, no exceptions,
  no group path.
- **Disclosure** — opt-in per field (`share_values`, `share_purpose`,
  `share_faith`), read through the `public_profiles` view, which returns null
  for anything not shared.
- **Collective tables** — `is_group_member(group_id)`, via a `SECURITY DEFINER`
  helper so the membership check does not itself trip RLS and recurse.
- **Resonance** — your own row always; everyone's rows only once the proposal
  has closed.

Queries in page code run as the signed-in user. `.eq("profile_id", me)` is
written for clarity; the policy is what protects the row.

## The ledger seam

The whitepaper puts vote recording, identity and treasury on-chain. This build
does none of that, and the reason is worth stating plainly: a group of eight
people deciding where to hold a Thursday session does not have a trust problem
that a blockchain solves. They have a *clarity* problem, and an *honesty about
outcomes* problem. Those are what this addresses.

What it does instead is route every governance act through three interfaces in
`src/lib/ledger/`, so a chain adapter is an adapter rather than a rewrite:

| Interface | Today | What a chain adapter would be |
|---|---|---|
| `LedgerRecorder` | Hash-chained Postgres table | `BallotBox` + on-chain events |
| `IdentityProver` | Invited member in a group | `IdentityAnchor`, DIDs, ZK eligibility |
| `Treasury` | A book-keeping record | `Treasury.approveDisbursement` / milestones |

The rule for anything added here: **the application layer must never learn
which implementation is live.** No `if (chainEnabled)` in a page.

### What the hash chain does and does not prove

Each `ledger_events` row commits to the hash of the previous row for that
group. `verify_ledger()` replays the chain and reports the first entry at which
it breaks.

This proves the record has not been edited since it was written. It does not
prove more than that: whoever runs the database could recompute the entire
chain, and there is no second copy to contradict them. That is precisely what a
chain would buy, and it is not what this is.

The Impact page says this, in those words. A verification badge that overstates
what it proves is worse than no badge, because it converts a reasonable amount
of trust into misplaced certainty.

## Universal Law

The ten laws are **constants in `src/lib/universal-law.ts`**, not rows.

That is a deliberate representation choice. The paper says amending a law
requires the agreement of every user — not a threshold, all of them. A table a
steward could `UPDATE` would misrepresent what these are, so they ship with
the build, are readable by every member at `/settings/law`, and change only by
changing the build.

Three verdicts, and only one is fatal:

| | effect |
|---|---|
| `aligned` | none |
| `tension` | blocks until answered in writing, attributed; then proceeds |
| `violation` | the proposal is invalid — resonance closes, it cannot pass, and nothing overrides it |

**The Citizen Challenge.** An unoverridable verdict from a fallible model would
otherwise end a proposal with no recourse, so §6.4's challenge mechanism is
implemented: a member's argument goes back to the Truth Engine, which must
address it. It does not oblige a different answer. Superseded readings are kept
rather than deleted, so an audit that changed its mind shows that it did.

**The mock provider returns `aligned` for every law**, and says so in the text
a member reads. Under-blocking is recoverable — set a key, run it again.
Over-blocking is not, because the point of the layer is that its verdicts
cannot be overridden. A violation guessed from a regular expression would be
permanent.

## Activate

`Propose → Align → Vote → Activate → Reflect`. The fourth stage is the one
most systems skip: agreeing to something and having the means to do it are
different events, and collapsing them quietly assumes the money and the hands
will appear.

`proposal_needs` states what it would take, as quantities so it is checkable.
`commitments` records who has actually said yes, and to how much. A pledge can
be withdrawn while the proposal is still waiting — a commitment somebody
cannot honour is worse than one they never made.

A proposal with **no** needs is ready immediately. "It can be done as it
stands" is a real answer, not a loophole.

Note that `0005` adds no enum value. `ALTER TYPE ... ADD VALUE` cannot be used
in the transaction that adds it, and the Supabase SQL editor wraps a pasted
script in one — so a migration that needed a new status would work in psql and
fail in the dashboard, for exactly the people following the README. `passed`
already means "ratified, not yet under way".

## The AI layer

`src/lib/ai/` is `server-only`. The key never reaches the browser, and the
prompts are not substitutable by a client — a member cannot talk the reviewer
into a better score by editing a request.

**One interface, one method.** A provider is given a versioned prompt, a user
message, and a JSON schema; it returns parsed JSON and the model name.
Structured output comes from a required tool call rather than asking for JSON
in prose, and the result is parsed against a Zod schema before it reaches the
database. A malformed review fails loudly instead of being written and then
read as authoritative.

**Two adapters.** Anthropic, and a mock. The mock is not a stub returning lorem
ipsum — it produces a deterministic reading of the actual input from structural
signals (are costs given, are claims supported, is the commitment reversible),
so the whole loop can be walked without a key. It records its model as `mock`,
and the review UI renders a warning on any review that carries it.

**Four prompts, versioned.** Proposal review, decision rationale, reflection
prompt, synthesis prompt. Every artefact stores the id and version that made
it. Changing a rubric means bumping the version — editing in place silently
changes what an old score meant.

### Retrieval

When a proposal is submitted, `related_decisions()` returns up to six past
decisions from the same group, ranked by overlap of the values they invoked,
each with its expected outcome, its actual outcome, and the lesson recorded.
The reviewer is given these and records which ones it used in `memory_used`,
which the proposal page displays.

This is the loop that makes the product get better rather than just run: a
group that writes honest reflections gets reviews that know what it has been
wrong about before.

## Data flow: one proposal, start to finish

```
compose (localStorage)         nothing in the database yet
   │ submit
   ▼
proposals (in_review) ─────────► ledger: proposal.submitted
   │ runLawAudit()              the ten laws, before anything else
   │   └─ law_assessments       aligned / tension / violation
   │      violation ────────────► resonance closed, cannot pass, no override
   │ runReview()
   │   ├─ related_decisions()   past decisions, by value overlap
   │   ├─ group values          the rubric, in members' own words
   │   └─ provider.complete()
   ▼
proposal_reviews + proposal_flags
proposals (in_deliberation) ───► ledger: proposal.reviewed
   │
   ├─ deliberation_comments     open to all members
   ├─ proposal_flags.resolution answered, attributed, permanent
   │
   │ markRead() → proposal_reads
   │ castResonance()
   ▼
resonance_votes                 own row visible; averages hidden
proposals (voting)
   │ close_proposal()           the rule, applied in the database
   ▼
decisions ─────────────────────► ledger: proposal.decided
   │ if passed — ratified, NOT yet real
   ▼
proposals (passed)
   │ proposal_needs             what it would take
   │ commitments                who has actually said yes
   │ activate_proposal()        refuses while any need is short
   ▼
projects (executing) ──────────► ledger: project.started
   │ tasks, updates, spend ────► ledger: project.spend
   │ writeReflection()
   ▼
reflections
complete_project() ────────────► ledger: project.completed
   │
   └──► read by related_decisions() on the next proposal
```

## Performance

Page queries run in parallel via `Promise.all`. The proposal page is the
heaviest — eight queries — and is a single round trip's worth of latency
because none of them depend on each other.

Nothing is cached across requests. At a group of fifty this is not a problem,
and caching a governance record correctly is harder than it looks: a member who
sees a stale vote count draws a wrong conclusion about whether the group has
responded. `export const dynamic = "force-dynamic"` on the feed says so
explicitly.

## What would need rethinking at scale

This design assumes a group of 5–50 who know each other, and several things
would break before a group of thousands:

- `related_decisions()` scans every decision in the group. Fine at hundreds,
  not at tens of thousands — that wants an embedding index.
- Every member's values union into one rubric. At fifty people that is a long
  and incoherent list; groups would need a shared, agreed set.
- Invite-trust identity has no uniqueness guarantee. At any scale where the
  outcome is worth gaming, this is the first thing that must change.
- The feed loads forty posts with no pagination.

None of these are worth fixing before the loop has been proven to help a real
group decide something real.
