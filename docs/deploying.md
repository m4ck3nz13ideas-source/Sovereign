# Deploying

Vercel and Supabase, in that order of convenience and the reverse order of
work. The application deploys in about four minutes; the database is the part
that needs care, because a migration applied out of order to a project that
already has people in it is not something you undo.

Read the whole of **1** before pressing anything in **2**.

---

## 1. The database comes first

The deployed build talks to the same Supabase project the local one does.
There is no separate production database until you make one, and nothing
below creates it for you.

### If you are deploying the database you already have

Migrations `0010` through `0017` exist in the repository and have **not** been
applied. Everything built since the last deploy — predictions, personhood,
people, contention, chats, amendment, the guardian, the mirror — is in them.
The deployed app will call functions that do not exist until they are run.

Supabase dashboard → **SQL Editor** → paste each file, in order, one at a
time, waiting for each to say success:

```
supabase/migrations/0010_projection.sql    dated predictions, frozen and marked
supabase/migrations/0011_personhood.sql    one person, one nullifier, no name
supabase/migrations/0012_people.sql        follow, friendship, the social feed
supabase/migrations/0013_contention.sql    two answers that cannot both happen
supabase/migrations/0014_chat.sql          private conversation between friends
supabase/migrations/0015_amendment.sql     the tenth law made operable
supabase/migrations/0016_guardian.sql      a private reader that never speaks first
supabase/migrations/0017_mirror.sql        where you and the audit differ
```

In order, and one at a time. `0011` alters `scope_rules`, `0012` alters
`profiles` and adds a trigger `0010` does not know about, and `0015` alters
`proposals` and `law_assessments`. Running `0013` before `0012` fails in a way
whose error message is about a missing function rather than about the order.

Or, with the CLI pointed at the project:

```bash
supabase db push
```

### If you want a separate production project

Better, and it costs one more free-tier project. Make a new Supabase project,
run **all seventeen** migrations into it, and use its URL and anon key in
Vercel while `.env.local` keeps pointing at the old one. Nothing you do while
building then touches the instance other people are using.

Do not copy `supabase/seed.sql` into it. The worked example exists to make the
shape legible on first open; a real instance's first proposal should be a real
proposal.

### Raise the local floor before anyone arrives

`scope_rules` ships with local set to one voice and no waiting period, so a new
install can get through a decision on its first day. On an instance with people
on it that means one person can decide alone:

```sql
update scope_rules set min_voices = 3, deliberation_days = 2 where scope = 'local';
```

---

## 2. Vercel

1. **vercel.com → Add New → Project → Import Git Repository.** Authorise the
   GitHub app against `m4ck3nz13ideas-source/Sovereign` if it asks. Vercel
   detects Next.js; the framework preset, build command and output directory
   are all correct as detected. Change nothing there.

2. **Environment variables**, before the first deploy. Add these to
   **Production**, **Preview** and **Development** unless a line says
   otherwise:

   | Variable | Value | Required |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | yes |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page | yes |
   | `NEXT_PUBLIC_SITE_URL` | the deployed origin, no trailing slash — Production only | see below |
   | `ANTHROPIC_API_KEY` | `sk-ant-…` | no |
   | `ANTHROPIC_MODEL` | `claude-sonnet-5` | no |
   | `NEXT_PUBLIC_WORLD_ID_APP_ID` | `app_…` | no |
   | `NEXT_PUBLIC_WORLD_ID_ACTION` | `sovereign-personhood` | no |

   The anon key is meant to be public — it is in the browser bundle by
   design, and RLS is what protects the data. The Anthropic key is server-side
   only and must never be given a `NEXT_PUBLIC_` prefix.

   Without `ANTHROPIC_API_KEY` the whole loop still runs on the offline
   reviewer, and every review it writes says plainly that no model read it.
   That is a defensible thing to deploy; a fabricated reading is not.

   `NEXT_PUBLIC_SITE_URL` is only needed once you have a custom domain.
   Without it, `src/lib/env.ts` falls back to Vercel's `VERCEL_URL`, which is
   the correct per-deployment origin — set it on Production only, or preview
   deployments will send their magic links to the production site.

3. **Deploy.** First build takes two to four minutes.

4. If the deployed site shows the **setup page** rather than the sign-in
   screen, the two Supabase variables did not reach the build.
   `src/proxy.ts` redirects everything to `/setup` when either is missing.
   Add them and redeploy — changing an environment variable does not rebuild
   on its own.

---

## 3. Magic links, which will not work yet

This is the step that gets skipped, and the failure is silent: the email
arrives, the link opens, and it lands back on the sign-in screen with nothing
said.

`LoginForm.tsx` passes `emailRedirectTo`, and Supabase refuses any redirect
target that is not on its allow-list — quietly, by falling back.

Supabase dashboard → **Authentication → URL Configuration**:

- **Site URL**: `https://<your-domain>` — the production origin, nothing else.
  This is the default used when no `redirectTo` is given.
- **Redirect URLs**, added one per line:

```
http://localhost:3000/**
https://<your-domain>/**
https://*-<your-vercel-team-slug>.vercel.app/**
```

The third line is only needed if you want magic links to work on preview
deployments. It is a wildcard over every preview URL your account generates,
which is the pattern Supabase documents for Vercel — and it is also a wider
door than a production instance needs. If you are not testing auth on
previews, leave it out.

Keep `http://localhost:3000/**` — removing it breaks local development, and
it is only reachable from the machine it names.

---

## 4. The domain

The apex `mackiavelli.co.uk` currently points at GitHub Pages, and there is a
`CNAME` file in the repository root that says so. Pointing the apex at Vercel
means taking it off Pages first, and that is a separate decision from
deploying this.

The cheap answer is a subdomain, which needs one record and touches nothing
that already works:

- Vercel → project → **Settings → Domains** → add `sovereign.mackiavelli.co.uk`
- GoDaddy → DNS → add a **CNAME** record, host `sovereign`, value
  `cname.vercel-dns.com`

Vercel issues the certificate within a few minutes of the record resolving.
GoDaddy's propagation is usually minutes and occasionally an hour.

Then, and only then:

- Set `NEXT_PUBLIC_SITE_URL=https://sovereign.mackiavelli.co.uk` on Production
- Change **Site URL** in Supabase to the same
- Add `https://sovereign.mackiavelli.co.uk/**` to the redirect list
- Redeploy

The `CNAME` file in the repository is inert as far as Vercel is concerned —
it only means something to GitHub Pages. It can stay until the apex moves.

---

## 5. What is still not wired, and will not be by deploying

**The World ID browser step.** The server half is finished and tested; the
client widget needs an app registered at the World Developer Portal, and IDKit
v4 has a different request shape from the v2 endpoint the adapter targets.
Until it is connected, nobody on the instance can prove personhood, so
resonance at **national scale and above is closed to everyone equally**. Local
and regional are unaffected, as are reading, writing, questions and concerns at
every scale. That is the correct behaviour rather than a workaround, and the
personhood screen says so rather than showing a button that does nothing.

**The readiness score is still author-written.** The database checks that a
reading exists for this exact body and clears the bar; it cannot check that a
model produced it. That is fine while everybody using the instance knows each
other and is worth fixing before it is not. See `docs/roadmap.md`.

---

## Checklist

```
[ ] 0010–0017 applied, in order, no errors
[ ] scope_rules local floor raised
[ ] NEXT_PUBLIC_SUPABASE_URL and _ANON_KEY set in Vercel
[ ] deployed, and the sign-in screen loads rather than /setup
[ ] Supabase Site URL set to the deployed origin
[ ] Redirect URLs include the deployed origin and localhost
[ ] signed in with a magic link on the deployed site, end to end
[ ] written one proposal on it that you would have written anyway
```

The last line is the only one that tells you anything.
