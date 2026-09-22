# Database tests

The rules that define Sovereign live in Postgres, not in the interface, so
this is where they are actually tested. A TypeScript test cannot tell you
whether a member can read someone else's private journal — a policy can.

## What is tested

Five suites, eighty-nine checks. Every one of them runs as a non-superuser,
so row-level security actually applies — a test that passes as the owner proves
nothing about what a member can see.

### `01_rules.sql` — twenty-five checks

- The auth trigger creates a profile, and RLS then hides everyone else's.
- Invite-only membership works, and nobody joins without a code.
- **A group member cannot read another member's entries.** The core promise.
- Values are invisible until their owner opts in, and visible immediately after.
- Resonance is refused before a review exists.
- Resonance is refused before the member has recorded reading it.
- The first resonance moves a proposal to `voting` with no admin step.
- Before close, a member sees only their own vote, and the summary hides the
  averages while still reporting the count.
- A four-character answer cannot resolve a critical flag.
- Answering a flag attributes and timestamps it.
- **Two unanswered critical flags fail a proposal on their own**, whatever the
  numbers say.
- The same proposal passes once the flags are answered and the rule is met.
- Passing does **not** create a project; activation does.
- After close, every vote and every average becomes visible.
- A project cannot be completed without a reflection.
- A thirteen-character reflection is rejected by the check constraint.
- Completion works once a real reflection exists.
- Retrieval finds past decisions by value overlap and carries the lesson into
  what the reviewer is given.
- The ledger chain verifies, and **an edited decision is detected** — run as
  superuser, because that is exactly the threat model.

### `02_universal_law.sql` — twelve checks

- An unaudited proposal cannot be closed at all.
- A violation stops resonance, and stops the proposal, with no override.
- A violation cannot be answered away — only challenged.
- A tension blocks until it is answered in writing, attributed.
- A challenge supersedes a reading rather than deleting it.

### `03_activation.sql` — seventeen checks

- A passed proposal is not a project.
- A need that nobody has covered blocks activation.
- Nobody can pledge on another person's behalf.
- A pledge can be withdrawn while the proposal is still waiting.
- A proposal with no needs activates immediately.

### `04_scope.sql` — nineteen checks

- Someone in no group at all can write a proposal for their own street.
- A neighbour who spells the place differently still sees it.
- Someone in another town cannot read it, and cannot respond to it.
- **Nobody can propose for a place they are not in.**
- A global proposal reaches everyone; a group proposal still reaches only the
  group, even from the same street.
- The author cannot re-aim a submitted proposal.
- A place decision records no participation share, because there is no
  register to be a share of.
- One voice passes at local scale, where the rule says one voice is enough.
- A regional proposal cannot be closed inside its deliberation window.
- Retrieval follows the address: Totnes does not learn from Hackney.
- The public ledger chain verifies.

### `05_readiness.sql` — sixteen checks

- An unsharpened draft is refused outright.
- A draft scoring 0.55 is refused, and the error says both numbers.
- A sharpening of a different text does not count.
- **Somebody else's sharpening does not count**, and nobody can record one in
  another member's name.
- A missing section is refused by the check constraint.
- **Asking again about the same words cannot talk past an earlier low score.**
- A sharpening is spent: one reading submits one proposal.
- The text and the score are fixed after submission — but withdrawal still
  works, which is why the text is frozen and the status is not.
- An unattached reading is private to its author; an attached one is part of
  the record.

## Running them

Against any Postgres 14+ with `pgcrypto` available:

```bash
createdb sovereign_test
psql -d sovereign_test -v ON_ERROR_STOP=1 \
  -f supabase/tests/00_supabase_shim.sql \
  -f supabase/migrations/0001_schema.sql \
  -f supabase/migrations/0002_rls.sql \
  -f supabase/migrations/0003_functions.sql \
  -f supabase/migrations/0004_universal_law.sql \
  -f supabase/migrations/0005_activation.sql \
  -f supabase/migrations/0006_scope.sql \
  -f supabase/migrations/0007_readiness.sql \
  -f supabase/tests/00b_support.sql \
  -f supabase/tests/01_rules.sql \
  -f supabase/tests/02_universal_law.sql \
  -f supabase/tests/03_activation.sql \
  -f supabase/tests/04_scope.sql \
  -f supabase/tests/05_readiness.sql
```

`00b_support.sql` is test scaffolding: `test_propose()` does what the server
action does — records a sharpening, then submits — so the other suites stay
about the rules they are testing. It is deliberately not `security definer`,
because a helper that bypassed row-level security would quietly disarm every
test that uses it.

It prints `N passed, 0 failed` and raises if anything failed, so it is usable
as a CI step without parsing output.

`00_supabase_shim.sql` is a minimal stand-in for the parts of Supabase the
migrations touch: an `auth.users` table, an `auth.uid()` that reads a session
setting, and the `authenticated` and `anon` roles. It exists so the rules can
be tested locally without a Supabase project, and it is **not** applied to a
real one — Supabase provides all of this already.

## Running them against a real Supabase project

Don't, on a project with data in it: the suite writes rows and leaves them.
Use a branch or a throwaway project, skip the shim, and run the suites in the
SQL editor.

## Adding a test

Every rule in the table in `docs/architecture.md` should have one. If you add a
rule to a `SECURITY DEFINER` function, add the case that proves it refuses —
the useful assertion is almost always that something is *not* allowed.
