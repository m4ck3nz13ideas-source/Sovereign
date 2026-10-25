# Database tests

The rules that define Sovereign live in Postgres, not in the interface, so
this is where they are actually tested. A TypeScript test cannot tell you
whether a member can read someone else's private journal — a policy can.

Every suite runs as a non-superuser, so row-level security actually applies —
a test that passes as the owner proves nothing about what a member can see.

## What is tested

One file per migration area, numbered `01_rules.sql` onwards. Each file opens
with a comment saying what it covers, and the rule it guards is in
`CLAUDE.md` under the same number or migration. Most of the useful assertions
are absences — that something is *not* allowed, or that a column, policy or
function does *not* exist — so read a suite before "simplifying" it.

## Running them

Against any Postgres 14+ with `pgcrypto` available:

```bash
createdb sovereign_test

# Every migration, then every suite — by glob, never a list.
ARGS=(-f supabase/tests/00_supabase_shim.sql)
for m in supabase/migrations/*.sql; do ARGS+=(-f "$m"); done
ARGS+=(-f supabase/tests/00b_support.sql)
for t in supabase/tests/[0-9][0-9]_*.sql; do
  case "$t" in *00_supabase_shim*|*00b_support*) continue;; esac
  ARGS+=(-f "$t")
done

psql -d sovereign_test -v ON_ERROR_STOP=1 "${ARGS[@]}"
```

Then the concurrency suite, which needs its own fixture and real connections:

```bash
pip install "psycopg[binary]"
psql -d sovereign_test -v ON_ERROR_STOP=1 -f supabase/tests/concurrency/fixture.sql
PGDATABASE=sovereign_test python3 supabase/tests/concurrency/run.py
```

It prints `N passed, 0 failed` and exits non-zero on failure, like the suites.

`00b_support.sql` is test scaffolding: `test_propose()` does what the server
action does — records a sharpening, then submits — so the other suites stay
about the rules they are testing. It is deliberately not `security definer`,
because a helper that bypassed row-level security would quietly disarm every
test that uses it. Since 0050 new functions no longer reach PUBLIC by default,
so it also grants the suites' own helpers to `app` — test scaffolding that must
never appear in a migration.

`00_supabase_shim.sql` is a minimal stand-in for the parts of Supabase the
migrations touch: an `auth.users` table, an `auth.uid()` that reads a session
setting, and the `authenticated` and `anon` roles. It exists so the rules can
be tested locally without a Supabase project, and it is **not** applied to a
real one — Supabase provides all of this already.

## The concurrency suite

Everything else here runs in one psql session, which cannot overlap anything
with anything. These are the rules that only break when two people act at the
same moment, so they need real connections acting at once —
`concurrency/run.py`, driving psycopg.

Two shapes, both on purpose. **Interleaved**: two connections hold open
transactions and the harness orders the statements between them; under READ
COMMITTED a transaction cannot see another's uncommitted rows, so "A reads, B
reads, A writes, B writes" is reproducible rather than lucky, and every race
below failed on every run before 0027. **Thrashed**: N connections wait on a
barrier and go at once — evidence rather than proof, and the shape that catches
the interleaving nobody wrote down.

A test that serialises the operations and then asserts the answer is right is
not a concurrency test. None of these do that.

- **An invite with one seat, taken twice.** Before 0027 `uses` reached 2
  against `max_uses` 1 deterministically, and under eight-way load the last
  seat went to all eight with `uses` at 5 — the increments raced each other as
  well as the check.
- **Two ledger writes on the same parent.** Both read the same tip, both
  appended, and `verify_ledger()` then reported the chain broken at its first
  event: a tamper-evident record reporting tampering on an untampered database.
  Also asserted directly, that no two events share a `prev_hash`.
- **Two people closing one proposal.** `on conflict do nothing` already kept a
  second decision row out; it never kept out the second caller's status write
  or its ledger event, so one decision had two `proposal.decided` events.
- **A vote arriving mid-close.** The decision recorded one voter while two
  votes sat on the record. Rule 34 decides this: the vote is refused, and the
  suite asserts both that the counts agree and that the voter was told.

The assertions are outcomes, never lock mechanics: "uses never exceeds
max_uses" survives somebody finding a better fix, "takes FOR UPDATE" would have
to be rewritten by them.

The checks read through the owner connection rather than through `app`, because
a check that reads through the policies it is testing can pass because a row is
invisible rather than because it is absent. The one exception is
`verify_ledger()`, which is security definer and asks whether the caller is in
the group.

## Running them against a real Supabase project

Don't, on a project with data in it: the suite writes rows and leaves them.
Use a branch or a throwaway project, skip the shim, and run the suites in the
SQL editor.

## Adding a test

Every rule in the table in `docs/architecture.md` should have one. If you add a
rule to a `SECURITY DEFINER` function, add the case that proves it refuses —
the useful assertion is almost always that something is *not* allowed.

Three things that will bite, all learned the hard way:

- **End the file with `reset role;`.** They run in one psql session, so a suite
  that leaves `app` set makes the next one fail on its own `insert into
  auth.users`. 18 and 19 both omitted it and the documented run order was
  broken.
- **Pick test identities nobody else uses.** One database, one run: a uuid
  prefix another suite already inserts fails on the primary key.
- **`set_config(..., true)` is transaction-local, and each `DO` block is its own
  transaction.** A suite split across more than one block has to say who it is
  again at the top of each, or `auth.uid()` is null and RLS hides everything —
  which looks exactly like a failing rule.
