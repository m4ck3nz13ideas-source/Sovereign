# Sovereign

A quiet place to think, and a way for a group to decide together.

Two halves, one app. The **individual space** is yours alone: what you write,
what you are working out, what you believe, and how that has changed. The
**collective space** is shared with a group of people who know each other, and
is where proposals are examined, responded to, decided, carried out, and
honestly reflected on.

The first half never becomes the second unless you send it there.

---

## What it actually does

**Launch** is the intake point for everything — one screen, four modes. What
you write files itself: a journal entry to Reflection, a prayer or question to
Profile, an idea to Pipeline, something worth sharing to Connection. Nothing is
sorted, tagged or triaged at the moment of writing.

**Reflection** is where entries are sat with rather than processed. Unexamined
entries appear as banners that read *"From three days ago: '…'. Ready to sit
with this?"* — a pull, not a task. A thirty-day rhythm display shows the shape
of your attention. One question at a time can be drawn from recent entries, if
you ask for it.

**Pipeline** triages ideas into concepts. Markdown in, markdown out, with paths
preserved so a re-import updates rather than duplicates.

**Profile** is the living record: values with your own definitions, a statement
of faith, a purpose, and what you keep returning to. Faith and purpose are
revisable and never overwritten — the history stays, and stays private even
when the current statement is shared.

**Connection** is the collective, and the chain runs left to right:

```
Feed → Proposals → Decisions → Projects → Impact
```

The governance cycle from the whitepaper, in full:

```
Propose → Align → Vote → Activate → Reflect
```

**Propose** — anyone in the group writes one.
**Align** — the Truth Engine reads it against the ten Universal Laws, and the
review layer scores it against the group's own values.
**Vote** — resonance, three sliders, ratified at ≥ 0.618.
**Activate** — it waits until named people have committed the money and the
hands it needs. Agreement is not the same as resources.
**Reflect** — what actually happened, which the review layer reads when the
next proposal arrives.

---

## The decisions that make it this and not something else

**Resonance is three sliders, not a vote.** Alignment, confidence and urgency,
each 0–1. A yes/no collapses "I think this is wrong", "I have no idea" and "not
now" into the same mark.

**The averages stay hidden until a proposal closes.** Members see how many have
responded and their own numbers, never a running average. A visible average
changes what people report, which is the entire thing resonance exists to
avoid. This is enforced in the database, not in the interface.

**Understanding before action.** The sliders do not work until a review exists
*and* you have said you read it. That is recorded — not to police anyone, but
so the group can tell a proposal three people considered from one three people
scrolled past.

**A critical flag is answered, never dismissed.** Anything the review scores
below the group's values floor, or flags as a high-severity risk, needs a
written answer naming what changed or why the risk is acceptable — attributed
and timestamped. This is the mechanism that lets a weak proposal be retired
early without anyone having to be the person who objected.

**A project cannot be completed without a reflection.** The database refuses.
A group that closes projects without recording what happened has a memory that
cannot teach it anything, and the retrieval step on the next proposal has
nothing to retrieve.

**Universal Law sits above everything.** Ten laws, from the whitepaper, shipped
as code and readable at `/settings/law`. Every proposal is read against all
ten. A *tension* is answered in writing and the proposal proceeds. A
*violation* ends it — it cannot be voted through, no steward can set it aside,
and there is no policy in the schema that would let one be edited or deleted.
Because an unoverridable verdict from a fallible model would otherwise be
final, members can challenge a reading; the challenge goes back to the audit,
which must address it and may well hold its position.

**Ratification is not activation.** A proposal that passes is a proposal the
group agreed to, and nothing more. It becomes a project when the money and the
people it needs have actual names against them. A proposal that needs nothing
activates immediately — "it can be done as it stands" is a real answer.

**Prompts are versioned configuration, readable by every member.** Every score
records the prompt id and version that produced it. Changing a rubric means
bumping the version, never editing in place. A group being scored by a rubric
can read the rubric, at `/settings/prompts`.

**The threshold is the golden ratio.** 0.618, as the whitepaper specifies, "so
that consensus comes through harmony rather than dominance" — not a number
chosen here.

**No chain, no token, no ZK.** What the whitepaper puts on-chain, this puts
behind interfaces in `src/lib/ledger` — with an append-only, hash-chained
Postgres table underneath. Tamper-evident, not trustless, and the app says so
in those words rather than implying more. See `docs/architecture.md`.

---

## Running it

You need Node 20+ and a Supabase project. The free tier is enough for a group
of fifty. Runs on macOS, Linux and Windows — nothing here is platform-specific.

```bash
git clone <this repo>
cd sovereign
./scripts/setup.sh
```

That installs dependencies, writes `.env.local`, applies the migrations if you
give it a database URL, and tells you the one thing it cannot do for you. It is
safe to run twice — it will not overwrite an existing `.env.local`.

The rest of this section is what that script does, if you would rather do it by
hand or it does not fit your setup.

**1. Make a Supabase project** at [supabase.com](https://supabase.com).

**2. Run the migrations** in order — paste each into the SQL editor:

```
supabase/migrations/0001_schema.sql         tables, enums, triggers
supabase/migrations/0002_rls.sql            row-level security
supabase/migrations/0003_functions.sql      the decision rule, the ledger, retrieval
supabase/migrations/0004_universal_law.sql  the ten laws as a gate, and 0.618
supabase/migrations/0005_activation.sql     needs, commitments, Activate
```

`supabase/reset.sql` clears a half-applied install — a migration that fails
partway leaves a database with no way forward, and the error it then gives
says nothing about why.

Or with the CLI: `supabase db push`.

**3. Configure it.**

```bash
cp .env.example .env.local
```

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` come from
Project Settings → API.

`ANTHROPIC_API_KEY` is optional. Without it, the whole loop still works on an
offline reviewer — scores come from structural signals in the text, and every
review it writes says plainly that no model read it. Add a key when you want a
real reading.

**4. Set the redirect URL** in Supabase under Authentication → URL
Configuration: add `http://localhost:3000/auth/callback`, and your production
URL when you have one. Magic links fail silently without this.

**5. Run it.**

```bash
npm run dev
```

Sign in with your email, name three values you actually hold, and start a
group.

### Optional: the worked example

`supabase/seed.sql` contains one complete loop — a proposal with a real review,
a values flag answered by halving the term, a three-comment deliberation, three
resonance votes, a decision, a project with a budget, and a reflection in which
the group's core assumption turned out to be wrong. It exists to make the shape
legible on first open and to give the retrieval step something to retrieve.
Instructions are in the file's header. It is safe to skip, and everything in it
is removable.

### Deploying

Vercel, with the same environment variables. Add the deployed URL to Supabase's
redirect list. There is nothing else.

---

## Checks

```bash
npm run check     # typecheck, lint, test, build
```

The build passes with no environment variables set — configuration is read
through getters so a missing key produces a readable message at request time
rather than a failed build.

The rules that define this product live in Postgres, so that is where they are
tested. `supabase/tests/` runs against any local Postgres as a non-superuser,
so row-level security actually applies, and checks twenty-four things — that a
member cannot read another member's journal, that resonance is refused before
the review is read, that two unanswered flags fail a proposal whatever the
numbers say, that a project cannot complete without a reflection, that an
edited ledger row is detected. See `supabase/tests/README.md` for how to run
it.

```bash
createdb sovereign_test
psql -d sovereign_test -v ON_ERROR_STOP=1 \
  -f supabase/tests/00_supabase_shim.sql \
  -f supabase/migrations/0001_schema.sql \
  -f supabase/migrations/0002_rls.sql \
  -f supabase/migrations/0003_functions.sql \
  -f supabase/tests/01_rules.sql
```

---

## What is deliberately not here

No blockchain, tokens, SOV, wallets, zero-knowledge proofs, DIDs or verifiable
credentials. No Proof-of-Alignment consensus, no Spheres of Civilization DAO
network, no liquid democracy or delegation, no tiered transparency. No public
feeds, public profiles or cross-group discovery. No screen-time features, no
streaks, no notifications.

The scope model is the notable gap: the whitepaper routes proposals
geospatially — Local → Regional → National → Continental → Global, with
subsidiarity in the protocol — and this still requires group membership
instead. The enum carries the scopes; nothing yet acts on them.

Most of these are in the whitepaper, and several are good ideas. None of them
help a group of eight decide something on a Thursday, which is the thing that
has to work before any of the rest is worth building. `docs/roadmap.md` says
what would earn a place next, and what would have to be true first.

---

## Documentation

| | |
|---|---|
| `docs/architecture.md` | How it fits together, and the ledger seam |
| `docs/data-model.md` | Every table, and why the constraints are where they are |
| `docs/design-system.md` | Tokens, type, and the rules for new screens |
| `docs/roadmap.md` | What V1 is for, how to tell if it worked, what comes next |
| `CLAUDE.md` | Conventions for anyone — or anything — editing this repo |
