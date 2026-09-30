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

### First, find out what is actually in there

Do not assume the live database is where the repository thinks it is. Ours
was five migrations further behind than anyone believed — it had the tables
from `0001` and the decision rule from `0003`, and nothing from `0005` onward,
so it had never had the subsidiarity engine, the activation step, the
readiness gate or the debate layer. Nothing looked broken, because all the
development had been happening against a local database.

The error that revealed it named one missing function and surfaced two
thousand lines further into the file than the first statement that should
have failed, which is a good reason not to read a migration error as a map.
Ask the database directly instead:

```sql
with want(name) as (values
  ('can_reach_proposal'), ('can_steward_proposal'), ('in_scope'),
  ('is_group_member'), ('place_key'), ('bind_proposal_readiness'),
  ('dormant_proposals'), ('activate_proposal'), ('alignment_shape'))
select w.name,
       coalesce(
         (select string_agg(p.oid::regprocedure::text, '  |  ')
            from pg_proc p
            join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = w.name),
         '>>> MISSING <<<') as signature
  from want w
 order by 1;
```

Those nine come from `0002` through `0009`, one or two each. What is missing
tells you where the database really stops.

If it stops anywhere before the end, and the database holds nothing you would
miss, the honest move is `supabase/reset.sql` followed by every migration in
order rather than an incremental patch: `0004` and `0005` predate the
convention of writing migrations to be safely re-runnable, so a partial state
that includes some of either is not something you can paper over. Row counts
per table, before deciding:

```sql
select 'public.' || table_name as tbl,
       (xpath('/row/cnt/text()',
              query_to_xml(format('select count(*) as cnt from public.%I', table_name),
                           false, true, '')))[1]::text::int as row_count
  from information_schema.tables
 where table_schema = 'public' and table_type = 'BASE TABLE'
 order by row_count desc, tbl;
```

Auth users live in the `auth` schema, which `reset.sql` does not touch, so
resetting costs you your profile rows and not your ability to sign in.

### If the database really is current up to 0009

Migrations `0010` through `0017` are the ones that carry everything built
since — predictions, personhood, people, contention, chats, amendment, the
guardian, the mirror. The deployed app calls functions that do not exist
until they are run.

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
supabase/migrations/0018_accession.sql     agreeing to the ten, and to which wording
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

**Environment variables that begin `NEXT_PUBLIC_` are compiled into the
bundle.** Changing one in the dashboard does nothing to the build already
serving. Redeploy, every time. Related: check the *spelling* of what is
already there. Ours had `NEXT_PUB_SUPABASE_URL` sitting alongside the real
one, which is not a variable, does nothing, and looks entirely correct in a
list.

**A stale DNS answer looks exactly like a broken deploy.** GitHub Pages
returns a 404 for every path it does not serve, so a half-propagated cutover
gives you the sign-in screen on one request and a GitHub 404 on the next,
from the same URL. Before touching anything, check what the record actually
resolves to from outside your own machine — `dns.google/resolve?name=…&type=CNAME`
in a browser will tell you — and remember that your own laptop is the most
stubbornly cached resolver in the chain. `sudo dscacheutil -flushcache;
sudo killall -HUP mDNSResponder`, then a private window, then your phone on
mobile data.

There is no longer a `CNAME` file in this repository. There was, naming the
apex, which is what tells GitHub Pages to claim the domain; it is gone so
that GitHub stops answering for a name Vercel is serving. Turn Pages off
under the repository's **Settings → Pages** as well — the file is only half
of it.

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
[ ] signed in with a magic link on the deployed site, end to end
[ ] written one proposal on it that you would have written anyway
```

The last line is the only one that tells you anything.
