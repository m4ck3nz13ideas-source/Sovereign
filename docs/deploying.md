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

### Apply every migration, in order

Supabase dashboard → **SQL Editor** → paste each file in
`supabase/migrations/` in order, one at a time, waiting for each to succeed.
Or `supabase db push` with the CLI pointed at the project.

The live project's migration history is empty (everything was applied by
SQL), so Supabase cannot tell you what is applied. Ask the database instead:
check that the newest migration's functions and policies exist
(`to_regprocedure('…')`, `pg_policies`) before assuming it is current. Ours was
once five migrations behind with nothing visibly broken.

Two things that bite when applying by hand:

- **Supabase grants new functions to `anon` by default.** Every migration that
  adds a function should revoke it from `anon` explicitly; check it did.
- **A new function is invisible to the API until PostgREST reloads.** The
  error is `Could not find the function public.x in the schema cache`.
  Migrations end with `notify pgrst, 'reload schema'`; if you see that error,
  run that line on its own.

If you want a separate production project, make one, apply every migration to
it, and point Vercel at it while `.env.local` keeps the old one. Do not load
`supabase/seed.sql` into a real instance.

### Raise the local floor before anyone arrives

`scope_rules` ships with local set to one voice and no waiting period, so a new
install can get through a decision on its first day. On an instance with people
on it that means one person can decide alone:

```sql
update scope_rules set min_voices = 3, deliberation_days = 2 where scope = 'local';
```

`supabase/raise-the-floor.sql` does every scale with its reasoning. Home now
states the rule in force under the scale selector, including the sentence that
matters on a fresh install: one voice means one person can decide alone.

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
   | `AI_SIGNING_SECRET` | `openssl rand -hex 32` — the same value goes in `private.ai_signing_key` | yes, for AI results and law audits |
   | `COMPANIES_HOUSE_API_KEY` | free, from Companies House | no |

   The anon key is meant to be public — it is in the browser bundle by
   design, and RLS is what protects the data. The Anthropic key is server-side
   only and must never be given a `NEXT_PUBLIC_` prefix.

   Without `ANTHROPIC_API_KEY` the whole loop still runs on the offline
   reviewer, and every review it writes says plainly that no model read it.
   That is a defensible thing to deploy; a fabricated reading is not.

   `NEXT_PUBLIC_SITE_URL` is required on a deployed install — see section 5.
   Set it on Production only, or preview deployments will send their magic
   links to the production site.

   `AI_SIGNING_SECRET` signs every AI result the server writes (rule 38). Set
   it in Vercel and redeploy **before** inserting the same value into
   `private.ai_signing_key`; with no key, law audits cannot be recorded at all
   (rule 47).

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

## 4. Email, and why the third sign-in fails

Supabase's built-in email service sends **two messages per hour**. Not two
per user — two, for the whole project. Supabase are explicit that it exists
for development and is not meant for production, and it is best-effort even
within that.

Since the only way into this application is a magic link, that number is the
number of people who can reach it per hour, and you will hit it while testing
your own sign-in. The error is `email rate limit exceeded`, it is returned at
the send step rather than the link step, and it resets on a rolling hour.

So a custom SMTP provider is not a later refinement here. It is the thing
standing between the deploy and anybody using it.

**Project Settings → Authentication → SMTP Settings.** Resend, Postmark,
SendGrid, AWS SES, Brevo and ZeptoMail all work; Resend is the least
ceremony and its free tier is far beyond anything this needs. You will need
a sender address on a domain you control, which means DKIM and SPF records
at the registrar — the same GoDaddy DNS panel as the `www` record, and the
provider gives you the exact values to paste.

Sending as something like `sovereign@mackiavelli.co.uk` also means the link
arrives from the same name as the site it points at, which matters more than
it sounds when you are asking three people to trust a governance application
they have never heard of.

Once SMTP is configured, Supabase applies a fresh limit of 30 messages per
hour, adjustable under **Authentication → Rate Limits**. Raise it to
something sane before an invite goes out, not after.

## 5. The domain

This install runs at `www.mackiavelli.co.uk`. Two records' worth of work and
three ways to be misled about the result.

- Vercel → project → **Settings → Domains** → add `www.mackiavelli.co.uk`
- GoDaddy → DNS → **CNAME**, host `www`, value `cname.vercel-dns.com`
- Set `NEXT_PUBLIC_SITE_URL=https://www.mackiavelli.co.uk` on Production
- Change **Site URL** in Supabase to the same, and add
  `https://www.mackiavelli.co.uk/**` to the redirect list
- Redeploy

**Adding the domain does not attach it to a build.** A domain added *after*
the most recent production deployment sits on the project verified and
unaliased, and serves a 404 to everybody. Vercel's own domains page shows it
as fine, because from Vercel's point of view it is. Either redeploy after
adding the domain, or assign it to the current deployment explicitly. This
cost an hour, misdiagnosed as DNS the whole time.

**`NEXT_PUBLIC_SITE_URL` is not optional on a deployed install**, whatever it
looks like. Sign-in redirects are built from it, and the fallback — the origin
the request arrived on — can resolve to the per-deployment `*.vercel.app` host
behind a proxy. On a project with deployment protection enabled that host is
behind Vercel's own login, so somebody who clicked a perfectly valid magic link
lands on a sign-in page belonging to another company while holding a working
session they cannot see. `VERCEL_URL` names exactly that host, which is why
nothing here falls back to it.

**Environment variables that begin `NEXT_PUBLIC_` are compiled into the
bundle.** Changing one in the dashboard does nothing to the build already
serving. Redeploy, every time. Related: check the *spelling* of what is
already there. Ours had `NEXT_PUB_SUPABASE_URL` sitting alongside the real
one, which is not a variable, does nothing, and looks entirely correct in a
list.

**A stale DNS answer looks exactly like a broken deploy.** Check what the
record resolves to from outside your own machine
(`dns.google/resolve?name=…&type=CNAME`) before touching anything, and turn
GitHub Pages off under the repository's **Settings → Pages** so it stops
answering for the domain.

The apex `mackiavelli.co.uk` is still unclaimed here. Pointing it at Vercel
too, with an A record to `76.76.21.21` and a redirect to `www`, is a separate
five minutes whenever it matters.

---

## 6. What is still not wired, and will not be by deploying

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
[ ] asked the database what it actually has, rather than assuming
[ ] every migration applied, in order, no errors
[ ] AI_SIGNING_SECRET in Vercel, redeployed, then the same value in private.ai_signing_key
[ ] founders: insert into founders (profile_id) select id from auth.users
    where email = '<founder email>' on conflict do nothing;   (0058)
[ ] scope_rules local floor raised
[ ] NEXT_PUBLIC_SUPABASE_URL and _ANON_KEY set in Vercel, spelled right
[ ] redeployed AFTER the last environment variable change
[ ] domain added, and aliased to a deployment rather than merely verified
[ ] the sign-in screen loads rather than /setup, from a machine that has
    never visited the domain before
[ ] Supabase Site URL set to the deployed origin
[ ] Redirect URLs include the deployed origin and localhost
[ ] custom SMTP configured — the built-in sender does two an hour, which is
    two people an hour, for an application you can only enter by email
[ ] NEXT_PUBLIC_SITE_URL set on Production, and redeployed since
[ ] signed in with a magic link on the deployed site, end to end
[ ] signed out, closed the browser, and signed back in — a second sign-in is
    the one that proves the account persisted rather than the session
[ ] written one proposal on it that you would have written anyway
```

The last line is the only one that tells you anything.
