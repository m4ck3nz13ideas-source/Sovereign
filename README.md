# Sovereign

Better decisions. Together.

A private space to think, and a way for people to decide together. The
**individual** side is yours alone — what you write, believe and are working
out. The **collective** side is where proposals are examined, responded to,
decided, carried out and reflected on, by the group or place they are
addressed to. The first never becomes the second unless you send it there.

Live at [www.mackiavelli.co.uk](https://www.mackiavelli.co.uk). Next.js on
Vercel, Postgres on Supabase.

## The app

Sign-in is an emailed link, then onboarding: who you are and where, the ten
Universal Laws read and agreed to, your values, passions and beliefs, then a
short walk through the app.

Five icon-only tabs:

| Tab | What it holds |
|---|---|
| Individual | Profile header over Self · Ideas · To do · Learn · Vault (SOV inside Vault). Private, enforced in the database. |
| Connection | Your groups, proposal groups, businesses, and chats with friends. |
| Search (centre, landing) | Search everything, add a note or media, and the feed. |
| Market | Trade bound by the Universal Laws, and aligned advertising. |
| Collective | Proposals · Debate · Projects · Impact · Decisions · Words · People. |

The governance cycle: **Propose → Align → Vote → Activate → Reflect.** Every
proposal is read against the ten Universal Laws; a violation ends it.

**The rules live in the database, not the interface.** Each one is numbered
in [`CLAUDE.md`](CLAUDE.md) with the function or policy that enforces it, and
tested in `supabase/tests/`. Read that file before changing anything.

## Running it

You need Node 20+ and a Supabase project (the free tier is enough).

```bash
git clone <this repo>
cd sovereign-app
./scripts/setup.sh
```

That installs dependencies, writes `.env.local`, applies the migrations if you
give it a database URL, and tells you what it cannot do for you. It is safe to
run twice.

By hand instead:

1. **Make a Supabase project.**
2. **Apply every file in `supabase/migrations/` in order** (SQL editor, or
   `supabase db push`). Never edit an applied migration; add another.
   `supabase/reset.sql` clears a half-applied install.
3. **Raise the floor** once real people arrive: `supabase/raise-the-floor.sql`
   sets the minimum voices per scale. Not a migration, on purpose.
4. **Configure:** `cp .env.example .env.local`. Only the two Supabase values
   are required; the file explains the rest. Without `ANTHROPIC_API_KEY` the
   app runs on the offline reviewer and says so on every output.
5. **Redirect URL:** in Supabase → Authentication → URL Configuration, add
   `http://localhost:3000/**`. Magic links fail silently without it.
6. `npm run dev`

`supabase/seed.sql` adds one worked example of the full loop. Optional, and
removable.

Deploying: [docs/deploying.md](docs/deploying.md) — the database goes first.

## Checks

```bash
npm run check     # typecheck, lint, vitest, build
```

The build passes with no environment variables set. The database rules are
tested separately against a local Postgres — see
[supabase/tests/README.md](supabase/tests/README.md).

## Documentation

| | |
|---|---|
| `CLAUDE.md` | The numbered rules, and conventions for anyone — or anything — editing this repo |
| `docs/architecture.md` | How it fits together, and the ledger seam |
| `docs/data-model.md` | The tables, and why the constraints are where they are |
| `docs/design-system.md` | Tokens, type, navigation, and the rules for new screens |
| `docs/deploying.md` | Supabase, Vercel, email and the domain, in order |
| `docs/roadmap.md` | What this version is for, and what would earn a place next |
| `docs/dpia.md`, `docs/gdpr-checklist.md` | UK GDPR: the impact assessment and what is still to do |
| `supabase/tests/README.md` | Running the database and concurrency suites |

The public roadmap shown on the site comes from `src/lib/capabilities.ts`.
