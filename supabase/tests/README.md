# Database tests

The rules that define Sovereign live in Postgres, not in the interface, so
this is where they are actually tested. A TypeScript test cannot tell you
whether a member can read someone else's private journal — a policy can.

## What is tested

`01_rules.sql` runs as a non-superuser, so row-level security applies, and
checks twenty-four things:

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
- Passing creates a project automatically.
- After close, every vote and every average becomes visible.
- A project cannot be completed without a reflection.
- A thirteen-character reflection is rejected by the check constraint.
- Completion works once a real reflection exists.
- Retrieval finds past decisions by value overlap and carries the lesson into
  what the reviewer is given.
- The ledger chain verifies, and **an edited decision is detected** — run as
  superuser, because that is exactly the threat model.

## Running them

Against any Postgres 14+ with `pgcrypto` available:

```bash
createdb sovereign_test
psql -d sovereign_test -v ON_ERROR_STOP=1 \
  -f supabase/tests/00_supabase_shim.sql \
  -f supabase/migrations/0001_schema.sql \
  -f supabase/migrations/0002_rls.sql \
  -f supabase/migrations/0003_functions.sql \
  -f supabase/tests/01_rules.sql
```

It prints `N passed, 0 failed` and raises if anything failed, so it is usable
as a CI step without parsing output.

`00_supabase_shim.sql` is a minimal stand-in for the parts of Supabase the
migrations touch: an `auth.users` table, an `auth.uid()` that reads a session
setting, and the `authenticated` and `anon` roles. It exists so the rules can
be tested locally without a Supabase project, and it is **not** applied to a
real one — Supabase provides all of this already.

## Running them against a real Supabase project

Don't, on a project with data in it: the suite writes rows and leaves them.
Use a branch or a throwaway project, skip the shim, and run `01_rules.sql`
alone in the SQL editor.

## Adding a test

Every rule in the table in `docs/architecture.md` should have one. If you add a
rule to a `SECURITY DEFINER` function, add the case that proves it refuses —
the useful assertion is almost always that something is *not* allowed.
