# Roadmap

## What this version is for

Running the loop with three to five real groups, one real decision each.

Not "getting feedback on the UI". A real decision — something the group would
have had to make anyway, that someone will have to carry out, where being wrong
costs something.

Nothing below this line matters until that has happened. As of now it has not.
It is at least now possible: the app is deployed at `www.mackiavelli.co.uk`
against a database that finally has every migration in it, so the obstacle is
no longer that there is nowhere to send anybody. It is that nobody has been
sent, and a great deal of what has been built assumes other people exist.

## How to tell whether it worked

V1 works if any of these happens:

1. **The decision felt calmer than their normal process.** Not faster. Calmer —
   fewer people leaving the conversation annoyed.
2. **A weak proposal was retired early, without conflict.** The flag mechanism
   did what it exists to do: let a proposal fail on its merits rather than on
   someone being willing to be the person who objected.
3. **A strong proposal gained support without politics.** Nobody had to lobby.
4. **A group changed direction because of something the review surfaced.** The
   AI layer earned its place rather than decorating the page.
5. **Somebody came back and marked a prediction.** The impact simulation is the
   one feature whose value is entirely in the second visit. If nobody ever
   returns to say how it went, it is decoration however good the sentences
   were.

If none of these holds after several real proposals, the answer is not more
features. It is one of two things:

- **The values rubric is wrong.** The reviewer is scoring against definitions
  that do not describe what the group actually cares about. Rewrite the
  definitions in Profile; if that does not fix it, rewrite the reviewer prompt
  in `src/lib/ai/prompts.ts` and bump its version.
- **The thresholds are wrong.** Proposals passing that the group later regrets
  means alignment is too low. Good proposals failing on turnout means
  participation is too high. Both are editable in Settings.

Tune those against real decisions before building anything below.

## Built since this document was last honest

These were on the list or absent from it, and now exist. Migrations `0010`
through `0022`.

- **Impact simulation.** Dated, falsifiable predictions, frozen before the
  vote, marked against reality afterwards, with a forecasting record split by
  whose words they were. A project cannot complete while one that has come due
  is unmarked.
- **Proof of personhood.** A per-application nullifier and nothing else.
  Required to resonate only where `scope_rules.require_personhood` says so —
  off locally, on from national up. The browser half is not wired; see
  *Outstanding* below.
- **People.** Follow (one-way, public) and friendship (mutual, asked for),
  public profiles, and a social feed read off the ledger. No directory, no
  follower counts, and the graph touches eligibility nowhere.
- **Contention.** Two proposals that cannot both happen, and a first choice
  that orders the survivors without ever passing anything.
- **Chats.** Private conversation between friends. No read receipts.
- **Amendment.** The tenth law made operable: the wording of one existing law,
  global, audited against the other nine, enacted only when every single voice
  is at 0.900 or above.
- **The guardian.** A private reader that never speaks first, has no opinion
  about a decision, and stores no model of anybody.
- **The mirror.** A private reading of your own responses against the ten laws,
  derived rather than stored, with no good direction.
- **Ask, the fourth tab.** Searches both halves and keeps them apart — the
  collective side through the same eligibility question as every other screen,
  your own side through owner-only policies — as two lists rather than one with
  a label per row, because the difference between them is who else can read the
  thing. One field with two jobs: finding what the group has
  already proposed, decided and built, and asking a question of the lenses.
  A question asked on a proposal belongs to everyone it is addressed to; one
  asked on its own is owner-only and stays that way, because there is no
  function that attaches it afterwards.
- **Inquiry.** A question a proposal turns on, answered by several ways of
  knowing at once — the literature, the traditions, the practitioners — each in
  its own terms and none reconciled. Rule 2 is understanding before opinion,
  and until now there was nowhere to go and check anything. It returns
  positions and cannot return an answer: two lenses minimum, no ranking column
  anywhere, and the offline adapter refuses rather than inventing a survey of
  human thought.
- **Onboarding, and accession.** Four steps — who you are and where, the ten
  laws read and agreed to, your own values, passions and beliefs, then a walk
  through what the thing does. The agreement records which *revision* of each
  law was on the screen, so an amendment cannot retroactively rewrite what
  anybody consented to. It gates nothing.

## Outstanding, and small

- **The World ID browser step.** The server half is finished and tested. The
  client widget needs an app registered at the World Developer Portal, and
  IDKit v4 has a different request shape from the v2 endpoint the adapter
  targets. Until it is connected, national scale and above are closed to
  everyone equally, which is the correct behaviour rather than a workaround.
- **Doc drift.** None known. `README.md`, `CLAUDE.md`, this file,
  `docs/architecture.md`, `docs/data-model.md`, `docs/design-system.md`,
  `docs/deploying.md` and `supabase/tests/README.md` all describe what is
  actually built. The next feature is the one that makes that false again.

## What would earn a place next, and what must be true first

### A shared group rubric
Every member's values currently union into one list. At eight people that is
already long; at fifty it is incoherent. Groups would name a shared set, with
individual values kept private and used only for the member's own reflection.

*Earns its place when:* a group's rubric exceeds roughly a dozen entries, or
members report that the scores are meaningless because the list is not theirs.

### Detecting a contention rather than being told
Contention records a clash somebody noticed; it cannot find one. Two proposals
wanting the same £900 look identical to Postgres. Overlap through
`proposal_needs` would be a real signal.

*Earns its place when:* a group has missed a clash that cost them — and not
before, because a wrong guess here tells people two unrelated proposals are
alternatives, which is worse than saying nothing.

### Vault sync
Ideas is already file-shaped: `source_path` is preserved, markdown imports
update rather than duplicate, and concepts export as `.md` with frontmatter.
The remaining work is a sync adapter — most likely a git-backed vault, since
that avoids asking a hosted web app to hold a filesystem handle.

*Earns its place when:* someone is actually using Ideas enough that manual
import is the thing slowing them down.

### An unforgeable readiness score
The sharpening is recorded by the author, so the database can check that a
reading exists for this exact text and clears the bar, but not that the model
produced it. The fix is small: write the row from `src/lib/ai` with the service
role, drop the insert policy entirely, and the client can no longer write one
at all. It costs one environment variable at setup.

*Earns its place when:* somebody has an incentive to get a weak proposal in
front of people — money attached, or a group large enough that the author is
not someone everyone knows. Until then the deterrent is that a fabricated
score sits on the proposal's page with a name against it.

### A gazetteer
Places here are names with no containment relation, so someone in Hackney is
not automatically in London — they state each scale themselves. A gazetteer
would fix that and would also make this an application that holds real location
data, which is a decision to make deliberately rather than by accident.

*Earns its place when:* people in one region are demonstrably missing regional
proposals because they never filled in the second line — and not before, since
the failure mode of getting this wrong is an app that knows where everybody
lives.

### Delegation
Liquid democracy is in the whitepaper and it is a good idea at scale. At eight
people, delegation is a way of not reading the proposal, which is the exact
behaviour the understanding gate exists to prevent.

*Earns its place when:* groups exceed roughly thirty members, and participation
starts failing not from apathy but from genuine breadth.

### A chain
The seam is there. `docs/architecture.md` says what it would replace.

*Earns its place when:* there is a reason a group cannot trust whoever runs
their database. For a Thursday studio session, there is not. For a co-op
allocating a six-figure budget with a contested board, there might be — and at
that point the honest answer may still be an independent auditor rather than a
contract.

## What is deliberately not on this list

**Notifications, streaks, screen-time features, engagement metrics.** The parts
of a wellness layer that matter are already load-bearing here in the negative:
no counters framed as debts, no algorithmic feed, no reason to open the app
that isn't a reason you already had. Adding a streak would undo that.

**Resonance in the social feed.** "Four people you follow have responded to
this" is the single most effective engagement mechanic there is and it is the
bandwagon that hiding live averages exists to prevent, wearing a friendly face.
Whether somebody voted is not news; what they built is.

**Read receipts, typing indicators, online status.** Each one is a mechanism
for making somebody anxious about not replying. Read state exists and belongs
to the reader.

**A directory, a people search, or people-you-may-know.** A governance instance
with a browsable index of everyone on it has built a target rather than a
feature. A handle is an address; if somebody wants to be found they hand it
out.

**Any score on a person.** No follower count, no success rate, no forecast
leaderboard, no alignment number visible to anybody but its owner. "Written 12,
passed 3" is a record; "25%" is a score, and the distance between them is one
division.

**Letting a concern block a proposal.** It would look like rigour and it would
be a veto. The mechanism that fails a proposal is the review flag, which is the
rubric against the group's own stated floor, not one member's objection. If
concerns need more force than being read before everyone responds and recorded
afterwards, the honest change is to raise the alignment threshold, not to give
individuals a hold.

**Ranking a feed by anything but what is blocked.** The attention queue sorts
on what stands in the way, and that is the only ordering here that is not a
judgement about whose proposal matters more. An "interesting" or "popular" cut
would need engagement to exist, and the moment it exists people write for it.

**A guardian that recommends, or that learns.** Both are one sentence away at
any time, and both would turn a counsel into a handler. See rule 25.

**Tiered transparency.** Three tiers of pseudonymity is a serious piece of
cryptographic design in service of a problem this does not have. Everyone in
the group already knows who everyone is.

**Taking a national or global result seriously — yet.** The scales exist and
the loop runs at all five. Personhood now closes the sybil hole from national
scale up, which is the part that made those numbers meaningless; self-declared
place is still self-declared, so a gazetteer is the remaining gap. `min_voices`
rises steeply to make all of that harder to forget.

## If you only do one thing

Get one group to make one real decision, and read the reflection they write
three months later.
