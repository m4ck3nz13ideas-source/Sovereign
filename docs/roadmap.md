# Roadmap

Last rewritten 25 October 2026. The public roadmap at `/explore/roadmap`
(`src/app/(public)/explore/roadmap/items.ts`) is the short version of this
file for visitors; the two are kept in step, and both use the three states in
`src/lib/capabilities.ts` — **current**, **in testing**, **planned**.

## What this version is for

**Fifty people really using it, and feeling the difference, before Sovereign
is promoted in 2027.** The founding 50 are 18 and over; 16- and 17-year-olds
come later in 2027, after a children's risk assessment.

Not "feedback on the UI". Real groups making decisions they would have had to
make anyway, that somebody has to carry out, where being wrong costs something
— and individuals coming back to their own space because it helps them.

The app is live at `www.mackiavelli.co.uk` against a database with every
migration in it. The obstacle is no longer that there is nowhere to send
anybody. It is that the loop has barely been run with real people: at the
last count, four people onboarded and no groups. The founder dashboard
(`/settings/founder`, 0058) is where to watch that change.

## How to tell whether it is working

Watch the founder dashboard's way in — signed up, consented, agreed the ten,
onboarded, in a group, responded, proposed — and look first wherever the
biggest drop is. Then, for the groups:

1. **A decision felt calmer than their normal process.** Not faster. Calmer —
   fewer people leaving the conversation annoyed.
2. **A weak proposal was held or retired early, without conflict.** Held below
   0.618 with the laws, or failed on a flag, rather than on somebody being
   willing to be the person who objected.
3. **A strong proposal passed without politics.** Its conditions were met
   because the people affected took part, not because anybody lobbied.
4. **A group changed direction because of something the review surfaced.**
   The AI earned its place rather than decorating the page.
5. **Somebody came back and marked a prediction.** The impact simulation is
   the one feature whose value is entirely in the second visit.
6. **A group changed its own charter by proposal.** The charter is the
   group's rules; the first time one is changed by the people under it, not
   by whoever set it up, the loop has closed on itself.

If none of these holds after several real proposals, the answer is not more
features. It is one of three things:

- **The conditions are wrong.** Since 0056 meeting its conditions is what
  passes a proposal, so conditions that are too loose pass things a group
  later regrets, and conditions that are too strict stop anything small being
  decided. Fix the prompt (`proposal.conditions` in `src/lib/ai/prompts.ts`,
  bump the version), or put what the group cares about in its charter's
  "what the AI should weigh".
- **The law reading is wrong.** Too many good proposals held below 0.618, or
  bad ones released, means the `law.audit` prompt's scoring needs work — and
  it cannot be judged at all until a real model is connected.
- **The values rubric is wrong.** The reviewer scores against definitions
  that do not describe what people care about. Rewrite them in Self; if that
  does not fix it, rewrite the reviewer prompt and bump its version.

## How a proposal moves now

Agreed 25 October 2026 (0056, CLAUDE.md rule 50):

1. **Propose** — six sections and a sharpening; fixed once submitted.
2. **Released by the laws** — the AI reads it against all ten Universal Laws,
   each reading with an alignment from 0 to 1. A violation ends it. At a mean
   of **0.618 or above** it is released to the people it is addressed to;
   below, it is held with its author, and the page says why.
3. **Passed by its own conditions** — the voices, the requirements answered
   and the affected groups reached that the AI set for it alone. Once they are
   met, with no tension or critical flag left unanswered, it passes — unless
   more than half of those who responded were strongly against it (below
   0.382), which fails it whatever else is met (0059). The responses stay
   secret ballots and are published with their spread.
4. **Activated** — a project, once every need has somebody against it. A
   charter change is the exception: it takes effect the moment it passes.
5. **Reflected on** — it cannot complete without a written account.

Proposals from before 0039 keep the rule they were put to people on.

## Live now

Everything in "Current" on the public roadmap, and in particular what has
landed since this file was last honest:

- **Five tabs**, icon-only: Individual, Connection, Search (where you land),
  Market, Collective — with the AI button on every page and each tab's intro
  behind an "i".
- **Onboarding** in four steps: you, the ten laws read and agreed to, your
  values and what matters to you (the Sphere ratings), and a swipe tour of
  the tabs built from the capability list, so it follows the app.
- **Release at 0.618, pass on conditions** (0056).
- **Group charters** (0057): templates, the founders' first draft, change by
  proposal from three members, every version kept. Groups are managed from
  their own page in Connection, not Settings.
- **Dashboards** (0058): the founder's, each group's "How it is going", and
  "Your record" in Self.
- **Connection as one inbox**, group and business pages, circles, proposal
  chats.
- **Search** across both halves, the feed (For you, Following, Discover) with
  public likes and comments that never rank anything, and Words inline.
- **Market**: verified listings, AI reading plus human sign-off, one
  sponsored slot by fit rather than bid, link-out buying.
- **Individual**: journal, ideas, to-do, Know yourself, Learn, Vault and the
  SOV simulation.
- **Data rights**: explicit consent, 18+, a full export, a full erasure.
- **Signed AI writes** (0040, 0051): the database holds the signing key and
  Vercel has `AI_SIGNING_SECRET` in production. An unsigned or stale law
  reading is refused.

## Before the founding 50 arrive

In rough order. None of these is a feature.

- **Apply 0056–0058 and deploy the patches** (`docs/deploying.md`). Then add
  the founder: `insert into founders (profile_id) select id from auth.users
  where email = '<founder email>' on conflict do nothing;`
- **A real model.** Deliberately waiting on funding. Until then every
  reading comes from the offline stand-in, which records verdicts without
  numbers — so every audited proposal counts as 1.000 with the laws and is
  released. The release gate is real and enforced; it is only as good as the
  reading behind it.
- **The World ID browser step.** The server half is built and tested. Until
  the client widget is connected, national scale and above cannot gather the
  verified voices they need, for everyone equally.
- **The contact address** `connect@mackiavelli.co.uk`, which the site and the
  privacy policy name, has to exist and be read.
- **Explore-page demos redone** — last, once the tabs have settled, as agreed.
- **Run the loop once end to end with real people**: a group from a
  template, a proposal released and passed, a project, a reflection, a
  marked prediction.

## Next, and what must be true first

### Budget envelopes
Shared money split between Spheres, tax-allocation style. Spheres are tags
today and decide nothing (rule 40); envelopes will have to break
`37_spheres.sql` on purpose.

*Earns its place when:* a group has shared money and has argued about where
it goes.

### Payments held until work is approved
Stripe Connect first, an internal escrow later. Today the Market links out.

*Earns its place when:* founding members are buying from listed businesses
often enough that link-out is the thing in the way.

### Privacy, the next three steps
An encrypted private space (keys only the person holds), ballots secret from
Sovereign itself, and a personal data vault. All three are on the public
roadmap as planned, and the site says so.

*Earns its place when:* there is more than a handful of people whose private
writing is on the server — which is to say, soon after the founding 50.

### A proposal that can move up a scale
`check_supersedes()` sends a second attempt back to the same group, scope and
place, which stops venue-shopping and also stops honest escalation.

*Earns its place when:* a group has hit it, and there is a way to tell
escalation from venue-shopping that does not trust the author.

### Detecting a contention rather than being told
Two proposals wanting the same money look identical to Postgres. Overlap in
`proposal_needs` would be a real signal.

*Earns its place when:* a group has missed a clash that cost them.

### An unforgeable readiness score
The sharpening row is written by the author. Writing it from the server with
the service role, and dropping the insert policy, closes that.

*Earns its place when:* somebody has a reason to get a weak proposal in front
of people.

### A gazetteer
Places are names without containment; people state each scale themselves.

*Earns its place when:* people are demonstrably missing regional proposals
because they never filled in the second line — and with care, because the
failure mode is an app that knows where everybody lives.

### Delegation
*Earns its place when:* groups pass roughly thirty members and participation
fails from breadth rather than apathy.

### A chain
The seams are there (`src/lib/ledger`, the hash-chained ledger). *Earns its
place when:* a group has a reason not to trust whoever runs their database.

## Deliberately not on this list

**Streaks, notifications built to pull people back, counters framed as
debts.** Standard engagement is fine where it serves the person; a debt is
not.

**Resonance in the social feed.** "Four people you follow responded" is the
bandwagon that secret ballots exist to prevent (rules 3, 20).

**Read receipts, typing indicators, online status** (rule 23).

**A directory, a people search, or people-you-may-know.** A handle, a link
or a QR code is how you are found (rule 19).

**Any score on a person.** No follower count, success rate or leaderboard.
"Written 12, passed 3" is a record; "25%" is a score. The dashboards count
acts and states of the record, never a person against another.

**A ranked feed.** Likes are shown and never ranked by (rule 32).

**Letting a concern block a proposal.** A concern is answered in writing;
only a review flag or a law tension holds a proposal, and both are answered,
never dismissed (rules 5, 13).

**A guardian or AI that recommends how to decide.** It helps people find
their way, think and write; it does not tell anybody how to vote.

## If you only do one thing

Get one group from a template to one real decision, and read the reflection
they write three months later.
