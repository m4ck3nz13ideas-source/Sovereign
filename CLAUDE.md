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

## Where things go

- `src/lib/ai/` — the AI layer. `prompts.ts` holds versioned rubrics;
  `provider.ts` is the one-method interface; adapters sit beside it.
- `src/lib/ledger/` — the seam a chain adapter would replace. Vote recording,
  identity and treasury. Nothing above it knows which implementation is live.
- `src/lib/collective.ts` — pure helpers for the collective screens. A
  `"use server"` file may only export async functions, so anything synchronous
  belongs here rather than in `actions.ts`.
- `supabase/migrations/` — schema, then policies, then functions. Applied in
  order. Never edit an applied migration; add another.

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
