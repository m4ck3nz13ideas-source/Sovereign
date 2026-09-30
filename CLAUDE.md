# Working on Sovereign

Conventions that are easy to break by accident, and what depends on them.

## The rules that are not preferences

These are load-bearing. Changing one changes what the product is, so change it
on purpose, in a commit that says so.

1. **Individual data is private, in the database.** `entries`, `concepts` and
   `statement_revisions` have owner-only policies with no group-visibility path.
   If you find yourself adding one, you are building a different product.
2. **Drafts never reach the shared store.** A proposal exists in Postgres only
   once submitted. The compose screen keeps drafts in `localStorage`.
3. **Resonance averages stay hidden until a proposal closes.** Enforced by the
   RLS policy on `resonance_votes` and by `resonance_summary()`. A live average
   recreates the bandwagon dynamic resonance exists to remove. Counts are fine.
4. **Understanding before action.** `cast_resonance()` refuses without a review
   on file and a row in `proposal_reads`. The disabled sliders are a courtesy;
   the function is the rule.
5. **A flag is answered, never dismissed.** `resolve_flag()` requires twenty
   characters and attributes them. There is no delete path.
6. **A project cannot complete without a reflection.** `complete_project()`
   refuses, and `reflections.actual_outcome` has an eighty-character check.
7. **Prompt versions are immutable.** Editing a rubric in place silently
   changes what an old score meant. Bump the version in
   `src/lib/ai/prompts.ts` instead.
8. **Universal Law is not overridable.** A violation ends a proposal. There is
   no policy permitting a verdict to change and none permitting a delete; the
   only recourse is a challenge, which re-runs the audit. The WORDING may be
   amended — see rule 24 — but no amendment can set a verdict aside.
9. **Ratification is not activation.** `close_proposal()` stops at `passed`.
   Only `activate_proposal()` creates a project, and only once every need has
   a name against it.
10. **Eligibility is one question.** `can_reach_proposal()` — membership for a
    group proposal, `in_scope()` for a place one. If you find yourself writing
    a policy that asks about groups directly, you are forking the loop.
11. **A proposal is six sections and a sharpening.** The sections have length
    constraints; `bind_proposal_readiness()` refuses a submission without a
    reading of that exact body above 0.70. `body` is composed in exactly one
    place — `draftBody()` — because the hash is taken over it.
12. **A declined proposal is never offered back.** `dormant_proposals()`
    returns only what failed for want of people. If you find yourself widening
    that filter, you are building a system that asks until it gets the answer
    it wanted.
13. **A concern is not a veto.** Questions and concerns are answered in
    writing and counted onto the decision; they never fail a proposal. Only a
    review flag does, because that is the rubric against the group's own floor
    rather than one person disagreeing.
14. **A split is never reported as a consensus.** Every decision carries
    `dispersion` and `polarized` from `alignment_shape()`. Do not add a screen
    that shows a mean without them.
15. **A place has no register and no steward.** So there is no participation
    share (a `min_voices` floor instead, and `participation` stays null) and
    nobody picks the closing moment (`closes_at` does). Do not fill either gap
    with a plausible-looking number.
16. **A prediction is dated, frozen and marked.** `projections` take a
    statement and a horizon, `record_projection()` refuses once the proposal
    has closed, a trigger rejects any edit to the words, and there is no
    delete path. `complete_project()` refuses while a projection that has come
    due is unmarked. Adding a screen that shows predictions without their
    verdicts puts the decoration back.
17. **Personhood proves one thing and stores one thing.** A distinct living
    person, and an opaque nullifier. No name, document, image or biometric —
    and `personhood_proofs` has nowhere to put them. It is required only where
    `scope_rules.require_personhood` says so, never for reading, writing or
    objecting, and never inside a group. Only the person can revoke their own.
    Every decision records `verified_voices` whether the scale asked or not.
18. **The graph never touches eligibility.** Following and friendship decide
    whose work reaches your feed and who you can talk to. Nothing else. If you
    find yourself reading `follows` or `friendships` to answer a question about
    who may resonate, read, or reach a proposal, stop — `can_reach_proposal()`
    is the only answer to that, and the moment the graph gets a vote this is a
    different product.
19. **There is no directory and no counts on people.** `find_person()` matches
    an exact handle and nothing else: no prefix search, no listing, no people
    you may know. Nobody can read anybody else's follow graph. No screen shows
    a follower count, and `person_standing()` returns counts of finished acts
    with no ratio anywhere — "written 12, passed 3" is a record, "25%" is a
    score.
20. **The social feed carries acts, not participation.** `people_feed()` lists
    submissions, decisions, projects and marked predictions, in time order,
    off the ledger. Resonance is excluded on purpose: "four people you follow
    have responded" is the bandwagon rule 3 exists to prevent, with a friendly
    face on it.
21. **A preference orders, it never passes.** A contention decides which of
    the proposals that ALREADY PASSED goes looking for resources first.
    Nothing consults `preferences` to decide an outcome — `close_proposal()`
    settled that on each proposal's own terms and a contention cannot reach
    back into it. Counts stay hidden until every member has closed, like
    resonance averages and for the same reason.
22. **A passed proposal that is not going ahead says so in writing.**
    `stand_down_proposal()` needs twenty characters and attributes them, and
    it is the only thing that releases the next answer in a contended set.
    The record keeps saying it passed; what changes is that it stops waiting.
23. **A chat reaches nothing.** `messages` touch no proposal, no decision and
    no ledger, and nothing said in one is evidence of anything. There are no
    read receipts, typing indicators, last-seen or online status, and there
    will not be: read state lives in `chat_marks`, belongs to the reader, and
    the other person has no policy by which to see it. Ending a friendship
    stops new messages and leaves the old ones readable by both.
24. **An amendment rewrites one law and needs every voice.** The ten are the
    ten: `enact_amendment()` can only add a revision to an existing `law_id`,
    and there is no repeal, no eleventh and no merge anywhere in the schema.
    An amendment is global by construction, audited against the other nine
    like anything else, and enacted only when the LOWEST single voice is at
    `amendment_threshold()` or above — not the mean. A mean lets a majority
    carry a constitution over a minority's objection, which is the thing a
    constitution exists to stop. Revision 1 is the shipped text in
    `src/lib/universal-law.ts` and is never a row; every amendment is one, and
    `law_assessments.law_revision` records which wording produced a verdict.
    The audit must run against `currentLaws()`, or the whole protocol is
    decorative.
25. **The guardian never speaks first, has no opinion, and learns nothing.**
    Every `guardian_notes` row exists because somebody pressed something. It
    is given a proposal and `guardian_context()` — the values they wrote
    down — and nothing else: not their journal, drafts, votes, reads or
    graph. Widen that in the function, visibly, or not at all. It holds no
    verdict, score or recommendation, it reaches no proposal, decision or
    ledger, and it is owner-only with no share path. It is also the one thing
    in this schema that can be forgotten, because nobody else is entitled to
    it. If a behavioural profile ever appears here, this has become the
    surveillance product it was built not to be.
26. **The mirror is derived, private, and has no good direction.**
    `my_law_mirror()` computes a reading from a person's own resonance votes
    and is never stored — there is no table. It takes no argument, and must
    not grow one: a function with a profile id is one mistake away from being
    a tool for sorting people. It reports nothing below `mirror_floor()`
    responses on a law, because four is not a pattern. `divergence` has no
    good sign and no screen may imply one — backing something the audit
    flagged is not a failing, and holding back from something clean is not
    virtue.

27. **Onboarding is a gate, not an invitation.** `requireSession()` redirects
    to `/onboarding` until `profiles.onboarded_at` is set, and every screen in
    the shell calls it. The gate is not cosmetic: values are the rubric each
    proposal is scored against, so somebody who has named none is scored on
    none, and no screen would say why. Only `/onboarding` itself passes
    `allowUnonboarded`. Checking that a profile *row* exists is not the same
    check and never fires — `handle_new_user` writes one on sign-up, so the
    row is always there and `onboarded_at` is the only thing that tells you
    whether a person has arrived. That same function is why `requireSession()`
    writes a profile when it finds none rather than redirecting: an auth user
    can outlive the row, which is what happens when the public schema is
    reset, and redirecting somebody to the screen that needs the row it is
    missing is a loop with no exit.

28. **An agreement names the wording it agreed to.** Onboarding shows the ten
    laws and records acceptance in `law_acceptances`, one row per person per
    law per revision — never a boolean. Rule 24 made the wording amendable, so
    "agreed to the laws" would otherwise claim consent to whatever the text
    has since become, which is the exact move a constitution exists to stop.
    `accept_universal_law()` takes the ids the screen displayed and stamps the
    revision itself, because a client that could name the revision could name
    an older one. There is no update policy and no delete policy: an
    acceptance is a record of what somebody read on a date, and a record you
    can revise is not one. An amendment leaves every prior acceptance standing
    and shows up as `amended_since` — it is not a gate, and nothing in
    `can_reach_proposal()` or `cast_resonance()` may ever read this table.
    Accession is a record, not a permission system — with exactly one
    exception, which is arriving. A trigger on `profiles` refuses to set
    `onboarded_at` for anybody without all ten on the record at their current
    wording, because "this person has finished arriving" ought to be false if
    they never read the constitution they are arriving into. It fires only on
    the null-to-not-null transition, so an amendment never puts somebody
    already in back through the door. Nothing else is gated.
    `accession_ready()` exists so the app can tell "you have not agreed yet"
    apart from "this database has never had 0018 applied" — the same screen
    otherwise, with completely different fixes.

29. **An inquiry returns positions, never an answer.** The search surface
    surveys what several ways of knowing hold about a question a proposal
    turns on — the literature, the traditions, the practitioners — attributed,
    in their own terms, and unreconciled. `record_inquiry()` refuses fewer
    than two distinct lenses, because a survey of one is an oracle with extra
    steps. `positions` has no score, rank, weight, confidence or verdict
    column and must never grow one: a ranked survey is an answer, and
    answering a contested question is the thing a governance system must not
    automate. `ordinal` is the order it came back in, nothing more. Nothing in
    `close_proposal()`, `cast_resonance()` or `can_reach_proposal()` may read
    these tables — looking something up counts towards nothing. And the mock
    adapter **refuses** rather than inventing one, like the personhood
    adapter: a fabricated account of what the sciences and scriptures hold is
    precisely the thing being surveyed, and Universal Law 2 is not a
    suggestion. Every position on screen says whose account it is and that a
    named work is somewhere to start reading rather than a citation.
    A question asked **on a proposal** is readable by everyone it is addressed
    to; one asked **on its own** has a null `proposal_id` and is owner-only,
    permanently — there is no function that attaches one to a proposal
    afterwards and there must not be, because "yours alone" cannot be true
    only until somebody changes their mind. `can_reach_proposal(null)` is null
    rather than false, so every gate on these tables spells both cases out,
    and a `security definer` function carries its own check because the policy
    does not apply to it.

## Where things go

- `src/lib/ai/` — the AI layer. `prompts.ts` holds versioned rubrics;
  `provider.ts` is the one-method interface; adapters sit beside it.
- `src/lib/ledger/` — the seam a chain adapter would replace. Vote recording,
  identity and treasury. Nothing above it knows which implementation is live.
- `src/lib/personhood/` — the verifier seam. One question asked outward (is
  this a distinct living human) and one answer kept (an opaque nullifier). An
  adapter that returns anything identifying is a bug, not a feature: there is
  nowhere in the schema to put it. With nothing configured the adapter refuses
  rather than pretending — unlike the AI layer's mock, a fake personhood proof
  IS the thing being proved.
- `src/app/(app)/collective/people/` — the graph: follow, friendship, the
  handle lookup and the public profile. Its `actions.ts` is imported from the
  profile screen too, because the handle belongs to the same feature.
- `src/lib/collective.ts` — pure helpers for the collective screens. A
  `"use server"` file may only export async functions, so anything synchronous
  belongs here rather than in `actions.ts`.
- `src/lib/readiness.ts` — the bar and the hash, mirroring Postgres. The
  database's copies are the ones that decide.
- `src/lib/address.ts` — the address the collective screens are looking at: a
  group, or a place at one of five scales. Server-only; the cookie lives here.
- `supabase/migrations/` — schema, then policies, then functions. Applied in
  order. Never edit an applied migration; add another. If you redefine a
  function whose OUT parameters change, `drop function` it first — Postgres
  refuses a `create or replace` that changes the row type.

## Server actions

Every mutation is a server action in an `actions.ts` next to the page. They
return `{ ok: true }` or `{ ok: false, error }` rather than throwing, because
the caller is usually a `useTransition` in a component that needs to render the
message.

Queries run as the signed-in user, so RLS is the protection — not the `.eq()`
in the query. Write the `.eq()` anyway for clarity, but do not rely on it.

## Before pushing

```bash
npm run check     # typecheck, lint, build
```

The build must pass with no environment variables set. `src/lib/env.ts` reads
configuration through getters for exactly this reason: a missing key should
produce a readable message at request time, not a failed build.

## Copy

The voice is the product. Plain words, no exclamation marks, no congratulation,
no "oops". Where a constraint exists, say what it is and why — the components
in `ResonancePanel.tsx` and `FlagList.tsx` are the reference for tone.
