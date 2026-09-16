# Roadmap

## What this version is for

Running the loop with three to five real groups, one real decision each.

Not "getting feedback on the UI". A real decision — something the group would
have had to make anyway, that someone will have to carry out, where being wrong
costs something.

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

## What would earn a place next, and what must be true first

### Amendments as first-class objects
Today an amendment is a comment, and a failed proposal is rewritten from
scratch. That is deliberate — it keeps the record honest about what was
actually decided. But if groups keep resubmitting near-identical proposals, a
proper amendment with its own resonance would be worth having.

*Earns its place when:* more than a third of proposals in a group are
rewrites of a previous one.

### A shared group rubric
Every member's values currently union into one list. At eight people that is
already long; at fifty it is incoherent. Groups would name a shared set, with
individual values kept private and used only for the member's own reflection.

*Earns its place when:* a group's rubric exceeds roughly a dozen entries, or
members report that the scores are meaningless because the list is not theirs.

### Vault sync
Pipeline is already file-shaped: `source_path` is preserved, markdown imports
update rather than duplicate, and concepts export as `.md` with frontmatter.
The remaining work is a sync adapter — most likely a git-backed vault, since
that avoids asking a hosted web app to hold a filesystem handle.

*Earns its place when:* someone is actually using Pipeline enough that manual
import is the thing slowing them down.

### Real identity
Invite-trust has no uniqueness guarantee: one person can hold two invited
accounts. For a group who know each other that is the honest level of
assurance. It stops being adequate the moment the outcome is worth gaming.

*Earns its place when:* a group's decisions allocate money that someone outside
the group would want to influence. The `IdentityProver` interface is where this
goes; nothing above it changes.

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

**Notifications, streaks, screen-time features, engagement metrics.** The
`personalised_social_app.pdf` describes a wellness layer, and the parts of it
that matter are already load-bearing here in the negative: no counters framed
as debts, no algorithmic feed, no reason to open the app that isn't a reason
you already had. Adding a streak would undo that.

**Public profiles, cross-group discovery, a public feed.** Sovereign works
because a group is small and its members know each other. A discovery surface
turns it into a network, and a network has a moderation problem from the first
day.

**Tiered transparency.** Three tiers of pseudonymity is a serious piece of
cryptographic design in service of a problem this does not have. Everyone in
the group already knows who everyone is.

**National and global scope.** The enum allows it. Nothing else does, and
nothing should until a single local group has been shown to work.

## If you only do one thing

Get one group to make one real decision, and read the reflection they write
three months later.
