# Working on Sovereign

Conventions that are easy to break by accident, and what depends on them.

## The rules that are not preferences

These are load-bearing. Changing one changes what the product is, so change it
on purpose, in a commit that says so.

1. **Individual data is private, in the database.** `entries`, `concepts` and
   `statement_revisions` have owner-only policies with no group-visibility path.
   If you find yourself adding one, you are building a different product.
2. **Drafts never reach the shared store.** A proposal exists in Postgres only
   once submitted. The compose screen keeps drafts in `localStorage`.
3. **Resonance averages stay hidden until a proposal closes.** Enforced by the
   RLS policy on `resonance_votes` and by `resonance_summary()`. A live average
   recreates the bandwagon dynamic resonance exists to remove. Counts are fine.
4. **Understanding before action.** `cast_resonance()` refuses without a review
   on file and a row in `proposal_reads`. The disabled sliders are a courtesy;
   the function is the rule.
5. **A flag is answered, never dismissed.** `resolve_flag()` requires twenty
   characters and attributes them. There is no delete path.
6. **A project cannot complete without a reflection.** `complete_project()`
   refuses, and `reflections.actual_outcome` has an eighty-character check.
7. **Prompt versions are immutable.** Editing a rubric in place silently
   changes what an old score meant. Bump the version in
   `src/lib/ai/prompts.ts` instead.
8. **Universal Law is not overridable.** A violation ends a proposal. There is
   no policy permitting a verdict to change and none permitting a delete; the
   only recourse is a challenge, which re-runs the audit. The WORDING may be
   amended — see rule 24 — but no amendment can set a verdict aside.
    A challenge clears a reading only through `record_challenge_audit()`
    (0034), which supersedes the readings in force and records the new ten in
    one transaction — never one without the other, because a proposal with no
    readings in force would look as if it had no violations.
9. **Ratification is not activation.** `close_proposal()` stops at `passed`.
   Only `activate_proposal()` creates a project, and only once every need has
   a name against it.
10. **Eligibility is one question.** `can_reach_proposal()` — membership for a
    group proposal, `in_scope()` for a place one. If you find yourself writing
    a policy that asks about groups directly, you are forking the loop.
11. **A proposal is six sections and a sharpening.** The sections have length
    constraints; `bind_proposal_readiness()` refuses a submission without a
    reading of that exact body above 0.70. `body` is composed in exactly one
    place — `draftBody()` — because the hash is taken over it.
12. **A declined proposal is never offered back.** `dormant_proposals()`
    returns only what failed for want of people. If you find yourself widening
    that filter, you are building a system that asks until it gets the answer
    it wanted.
13. **A concern is not a veto.** Questions and concerns are answered in
    writing and counted onto the decision; they never fail a proposal. Only a
    review flag does, because that is the rubric against the group's own floor
    rather than one person disagreeing.
    **0039: each proposal is decided by its own conditions**, set by the AI
    (prompt `proposal.conditions`) for that proposal alone — how many voices,
    how long it stays open, and up to eight requirements that must be
    answered on the record before it can pass. Set once, before anybody
    responds; public with the AI's reasons; never changed. Floors the AI
    cannot go under: two voices and 24 hours. Nobody — not a steward —
    closes a proposal with conditions before its window ends. The Universal
    Law audit, the alignment threshold, the review-before-resonance rule and
    personhood at wide scales are NOT conditions: they are the constitution
    and stay fixed. Proposals from before 0039 keep the old per-scale and
    participation rules. (Named "conditions", not "terms", because `terms` is
    the lexicon.) `33_proposal_conditions.sql`.
    **0042: participation, not the clock.** A time window is now one
    condition the AI may choose, not a requirement: `window_hours` and
    `closes_at` are null when there is none, and then `close_proposal()`
    REFUSES to close (the proposal stays open) until the voices, the
    requirements and the newly added `affected` groups (each marked reached on
    the record, how and when) are all met. Challenges are for debate and
    never stall: anybody reached may challenge the conditions, any number of
    times, anybody may reply, and no challenge ever blocks a decision. Before
    anybody responds, the challenger can have the AI re-read with their
    argument via signed `ai_write('proposal.conditions.challenge')`;
    `apply_condition_challenge()` and the `proposal_conditions_guard` trigger
    allow only strengthening and the old conditions are kept in
    `condition_revisions`. After anybody responds the conditions are fixed;
    a challenge is then an argument on the record, and an improved proposal
    that supersedes this one is how it changes anything.
    Nobody can respond before conditions exist (trigger on resonance_votes,
    for proposals submitted after `conditions_epoch.since`). The test harness
    moves that epoch to the future for the pre-0039 suites; 33 and 36 move it
    back. `36_conditions_participation.sql`, `conditions.test.ts`.
14. **A split is never reported as a consensus.** Every decision carries
    `dispersion` and `polarized` from `alignment_shape()`. Do not add a screen
    that shows a mean without them.
15. **A place has no register and no steward.** So there is no participation
    share (a `min_voices` floor instead, and `participation` stays null) and
    nobody picks the closing moment (`closes_at` does). Do not fill either gap
    with a plausible-looking number.
16. **A prediction is dated, frozen and marked.** `projections` take a
    statement and a horizon, `record_projection()` refuses once the proposal
    has closed, a trigger rejects any edit to the words, and there is no
    delete path. `complete_project()` refuses while a projection that has come
    due is unmarked. Adding a screen that shows predictions without their
    verdicts puts the decoration back.
17. **Personhood proves one thing and stores one thing.** A distinct living
    person, and an opaque nullifier. No name, document, image or biometric —
    and `personhood_proofs` has nowhere to put them. It is required only where
    `scope_rules.require_personhood` says so, never for reading, writing or
    objecting, and never inside a group. Only the person can revoke their own.
    Every decision records `verified_voices` whether the scale asked or not.
18. **The graph never touches eligibility.** Following and friendship decide
    whose work reaches your feed and who you can talk to. Nothing else. If you
    find yourself reading `follows` or `friendships` to answer a question about
    who may resonate, read, or reach a proposal, stop — `can_reach_proposal()`
    is the only answer to that, and the moment the graph gets a vote this is a
    different product.
19. **There is no directory and no counts on people.** `find_person()` matches
    an exact handle and nothing else: no prefix search, no listing, no people
    you may know. Nobody can read anybody else's follow graph. No screen shows
    a follower count, and `person_standing()` returns counts of finished acts
    with no ratio anywhere — "written 12, passed 3" is a record, "25%" is a
    score.
20. **The social feed carries acts, not participation.** `people_feed()` lists
    submissions, decisions, projects and marked predictions, in time order,
    off the ledger. Resonance is excluded on purpose: "four people you follow
    have responded" is the bandwagon rule 3 exists to prevent, with a friendly
    face on it.
21. **A preference orders, it never passes.** A contention decides which of
    the proposals that ALREADY PASSED goes looking for resources first.
    Nothing consults `preferences` to decide an outcome — `close_proposal()`
    settled that on each proposal's own terms and a contention cannot reach
    back into it. Counts stay hidden until every member has closed, like
    resonance averages and for the same reason.
22. **A passed proposal that is not going ahead says so in writing.**
    `stand_down_proposal()` needs twenty characters and attributes them, and
    it is the only thing that releases the next answer in a contended set.
    The record keeps saying it passed; what changes is that it stops waiting.
23. **A chat reaches nothing.** `messages` touch no proposal, no decision and
    no ledger, and nothing said in one is evidence of anything. There are no
    read receipts, typing indicators, last-seen or online status, and there
    will not be: read state lives in `chat_marks`, belongs to the reader, and
    the other person has no policy by which to see it. Ending a friendship
    stops new messages and leaves the old ones readable by both.
24. **An amendment rewrites one law and needs every voice.** The ten are the
    ten: `enact_amendment()` can only add a revision to an existing `law_id`,
    and there is no repeal, no eleventh and no merge anywhere in the schema.
    An amendment is global by construction, audited against the other nine
    like anything else, and enacted only when the LOWEST single voice is at
    `amendment_threshold()` or above — not the mean. A mean lets a majority
    carry a constitution over a minority's objection, which is the thing a
    constitution exists to stop. Revision 1 is the shipped text in
    `src/lib/universal-law.ts` and is never a row; every amendment is one, and
    `law_assessments.law_revision` records which wording produced a verdict.
    The audit must run against `currentLaws()`, or the whole protocol is
    decorative.
25. **The guardian never speaks first, has no opinion, and learns nothing.**
    Every `guardian_notes` row exists because somebody pressed something. It
    is given a proposal and `guardian_context()` — the values they wrote
    down — and nothing else: not their journal, drafts, votes, reads or
    graph. Widen that in the function, visibly, or not at all. It holds no
    verdict, score or recommendation, it reaches no proposal, decision or
    ledger, and it is owner-only with no share path. It is also the one thing
    in this schema that can be forgotten, because nobody else is entitled to
    it. If a behavioural profile ever appears here, this has become the
    surveillance product it was built not to be.
26. **The mirror is derived, private, and has no good direction.**
    `my_law_mirror()` computes a reading from a person's own resonance votes
    and is never stored — there is no table. It takes no argument, and must
    not grow one: a function with a profile id is one mistake away from being
    a tool for sorting people. It reports nothing below `mirror_floor()`
    responses on a law, because four is not a pattern. `divergence` has no
    good sign and no screen may imply one — backing something the audit
    flagged is not a failing, and holding back from something clean is not
    virtue.

27. **Onboarding is a gate, not an invitation.** `requireSession()` redirects
    to `/onboarding` until `profiles.onboarded_at` is set, and every screen in
    the shell calls it. The gate is not cosmetic: values are the rubric each
    proposal is scored against, so somebody who has named none is scored on
    none, and no screen would say why. Only `/onboarding` itself passes
    `allowUnonboarded`. Checking that a profile *row* exists is not the same
    check and never fires — `handle_new_user` writes one on sign-up, so the
    row is always there and `onboarded_at` is the only thing that tells you
    whether a person has arrived. That same function is why `requireSession()`
    writes a profile when it finds none rather than redirecting: an auth user
    can outlive the row, which is what happens when the public schema is
    reset, and redirecting somebody to the screen that needs the row it is
    missing is a loop with no exit.

28. **An agreement names the wording it agreed to.** Onboarding shows the ten
    laws and records acceptance in `law_acceptances`, one row per person per
    law per revision — never a boolean. Rule 24 made the wording amendable, so
    "agreed to the laws" would otherwise claim consent to whatever the text
    has since become, which is the exact move a constitution exists to stop.
    `accept_universal_law()` takes the ids the screen displayed and stamps the
    revision itself, because a client that could name the revision could name
    an older one. There is no update policy and no delete policy: an
    acceptance is a record of what somebody read on a date, and a record you
    can revise is not one. An amendment leaves every prior acceptance standing
    and shows up as `amended_since` — it is not a gate, and nothing in
    `can_reach_proposal()` or `cast_resonance()` may ever read this table.
    Accession is a record, not a permission system — with exactly one
    exception, which is arriving. A trigger on `profiles` refuses to set
    `onboarded_at` for anybody without all ten on the record at their current
    wording, because "this person has finished arriving" ought to be false if
    they never read the constitution they are arriving into. It fires only on
    the null-to-not-null transition, so an amendment never puts somebody
    already in back through the door. Nothing else is gated.
    `accession_ready()` exists so the app can tell "you have not agreed yet"
    apart from "this database has never had 0018 applied" — the same screen
    otherwise, with completely different fixes.

29. **An inquiry returns positions, never an answer.** The search surface
    surveys what several ways of knowing hold about a question a proposal
    turns on — the literature, the traditions, the practitioners — attributed,
    in their own terms, and unreconciled. `record_inquiry()` refuses fewer
    than two distinct lenses, because a survey of one is an oracle with extra
    steps. `positions` has no score, rank, weight, confidence or verdict
    column and must never grow one: a ranked survey is an answer, and
    answering a contested question is the thing a governance system must not
    automate. `ordinal` is the order it came back in, nothing more. Nothing in
    `close_proposal()`, `cast_resonance()` or `can_reach_proposal()` may read
    these tables — looking something up counts towards nothing. And the mock
    adapter **refuses** rather than inventing one, like the personhood
    adapter: a fabricated account of what the sciences and scriptures hold is
    precisely the thing being surveyed, and Universal Law 2 is not a
    suggestion. Every position on screen says whose account it is and that a
    named work is somewhere to start reading rather than a citation.
    A question asked **on a proposal** is readable by everyone it is addressed
    to; one asked **on its own** has a null `proposal_id` and is owner-only,
    permanently — there is no function that attaches one to a proposal
    afterwards and there must not be, because "yours alone" cannot be true
    only until somebody changes their mind. `can_reach_proposal(null)` is null
    rather than false, so every gate on these tables spells both cases out,
    and a `security definer` function carries its own check because the policy
    does not apply to it.

30. **A word has readings, never a definition.** `terms` is a word a group has
    noticed it uses; `term_readings` is what one person takes it to mean, one
    row per person per revision. `terms` has no definition, canonical, agreed
    or official column and must not grow one — a glossary is a decision about
    a word, and it overwrites the only information here, which is that half
    the group thought otherwise. `term_readings` has no vote, score,
    endorsement or agreement column: a reading is not a candidate. **Nothing
    anywhere computes whether two readings match**, and this is the absence
    easiest to undo by accident — a similarity figure over two people's
    sentences puts a number on meaning, is wrong in ways nobody can audit, and
    on screen looks exactly like a fact. `voices` counts who has written one
    and says nothing about whether they agree; the readings sit next to each
    other and the members read them. Readings are append-only for the same
    reason acceptances are (rule 28): a silent edit would let the discovery
    that two people meant different things be tidied away, and that discovery
    is the feature. No term is attached to a proposal, because matching a word
    against proposal text is a guess and a wrong guess tells people a decision
    turned on a definition it never mentioned — what a proposal can be is the
    scene of a *sighting*, which is a person's act and not a match (rule 35). Nothing in `close_proposal()`,
    `cast_resonance()` or `can_reach_proposal()` may read these tables. It is
    groups only: a place has no register (rule 15), so there is nobody for a
    word at a place to belong to.

31. **A second attempt says what it changed, and cannot be re-pointed.**
    `proposals.supersedes` threads an attempt back to the one before it, and
    `supersedes_reason` says what is different — mandatory when the link is
    set, twenty characters minimum, because a second attempt that cannot name
    the difference is a duplicate with provenance and leaves a reader to diff
    two near-identical proposals by hand. Both are frozen after insert by
    `freeze_lineage()`: 0008 validated the link on the way in and then left it
    editable by the author's own update policy, and re-pointing a history after
    people have read it is the same class of edit as rewriting the body (rule
    11). `proposal_lineage()` walks the whole chain rather than one generation,
    and stops where the reader's reach stops **without saying that it stopped**
    — "there is one more you cannot see" is itself a disclosure.
    `check_supersedes()` still requires the same group, scope and place, so a
    second attempt goes back to the same people; that reads like a missing
    feature and is a deliberate one, because the alternative is venue-shopping.
    A second attempt is **not** a contention (rule 21): two of them can both
    pass, and nothing infers a clash from shared ancestry. It is not the system
    asking again either — `dormant_proposals()` reads `supersedes` so that
    something already taken up stops being offered back, and must never read
    `supersedes_reason`, because whether a proposal is re-offered turns on
    whether anybody acted, not on how well they explained it. Nothing in
    `close_proposal()`, `cast_resonance()` or `can_reach_proposal()` reads
    either column: an attempt that inherited its parent's standing would be a
    system that rewards persistence over quality. And no count of successors
    goes near a person — "two later attempts exist" is a fact about a proposal,
    "this author gets rewritten a lot" is a score.

32. **A post is read once at the door and never scored afterwards.** A feed
    selects — even time order is a selection — so the only question is where the
    selecting happens, and this puts it at the door: `bind_post_witness()`
    refuses a post without a `post_witness` reading of that exact body at or
    above `post_floor()`, the reading is spent on one post, and `freeze_post()`
    fixes the words afterwards. The reading asks whether a post is FIRST-HAND,
    not whether it is positive: the first thing a positivity gate keeps out is
    somebody honestly reporting that a project failed, and those reports are
    what the reviewer reads back on the next proposal. The number never appears
    on a published post and nothing totals it per author — that would be a
    rating of a writer, and `20_witness.sql` fails if a function name suggests
    one. `posts` has no likes, reactions, score, rank, views, shares, boost,
    pinned, trending, reach, impressions or engagement column, `witness_feed()`
    orders by `happened_at desc` with no second key, and resonance stays out of
    it for the reason rule 20 keeps it out of `people_feed()`. A KEEP (now
    shown as Save) is private to the person who made it. **Revised in 0036 on
    Mackenzie's direction:** a LIKE is public — `post_likes`, readable by
    anybody who can see the post, counted by `post_counts()` and shown on the
    card — and comments are threads anybody who can see the post can join. The
    line that holds: likes are shown, never ranked by. `witness_feed()` does
    not read them and `30_social.sql` fails if it does, and they reach no
    decision, SOV or standing. The gate (prompt `post.witness` 1.1.0) now
    passes a post that is truthful to its author OR positive or productive
    for others, told straight. Posting reaches no decision and
    appears nowhere in `person_standing()` — the moment it does, this rewards
    posting. What the reader controls is their own: `feed_settings` and
    `feed_mutes` narrow one person's feed and are invisible to everybody else,
    including the muted person, permanently.

33. **SOV is minted by finished acts, buys nothing, and is two figures rather
    than one.** `mint_for_act()` fires off `ledger_events` against the
    `sov_issuance` schedule — a project completed, a flag answered, a prediction
    marked — so issuance is a consequence of an act rather than a claim about
    one, and `sov_mint_once` means a replayed event pays once. Nothing mints for
    posting, following, being kept or turning up. `sov_entries` has no insert,
    update or delete policy at all, like `ledger_events`: every write goes
    through a security definer function that checks the balance first, and a
    balance is a sum of entries rather than a column anybody can set. MINTED and
    BALANCE are separate functions and no screen adds them up — minted is the
    Proof of Alignment record and only goes up; balance moves, and the moment
    SOV became transferable a balance stopped proving anything about the person
    holding it. It touches no decision: `close_proposal()`, `cast_resonance()`,
    `can_reach_proposal()`, `activate_proposal()`, `alignment_shape()`,
    `resonance_summary()` and `amendment_threshold()` are read by `21_sov.sql`
    and must not mention it, everyone's resonance counts the same, and backing a
    project is deliberately not counted by `activate_proposal()` — a project
    cannot be started by somebody buying it. Nobody can read anybody else's
    holding, which is what makes a league table impossible rather than merely
    absent. There is no price, conversion, market or fee column and no function
    named for one. It is a SIMULATION and every surface that shows it says so.

    **Widened in 0032** on Mackenzie's direction that activity is
    contribution. The schedule now has tiers: 1 participation (resonating,
    recording a prediction) at 1 SOV, once per subject and capped per person
    per day — full rate for five, half to fifteen, then nothing; 2 work
    (answering a question or concern, a law tension, a flag, an adopted
    amendment, a marked prediction); 3 outcomes others confirmed (your
    proposal passing pays its author, never its closer; a project
    completed). Following, being kept and joining still mint nothing, and
    posting and deliberation comments cannot until they are ledgered on
    purpose. `26_mint_schedule.sql` holds the cap, the once-per-subject rule
    and the recipients.

34. **A vote racing a close is refused, and three other things cannot happen
    twice.** The proposal row is the lock: `close_proposal()` takes it `for
    update` and `cast_resonance()` takes the same one, so a vote arriving while
    a close is being calculated waits and is then told the proposal is closed.
    The alternative — letting it in — would leave a decision whose
    `voter_count` the rows contradict, and a decision is a statement about what
    the group had said at the moment it closed. `redeem_invite()` locks the
    invite before reading `uses`, because the read and the `uses + 1` are
    separated by an insert and two people took the last seat. And
    `record_ledger_event()` takes a transaction-scoped advisory lock per chain
    before reading the tip: two writers appending to the same parent left a
    chain that no longer replays, which is a tamper-evident record reporting
    tampering on an untampered database. None of these change what any function
    decides — the other twenty-one suites are the check on that — and
    `supabase/tests/concurrency` fails on every run without them. Assert
    outcomes there, never lock mechanics: "uses never exceeds max_uses" survives
    a better fix, "takes FOR UPDATE" does not.

    **0034 adds a fifth lock:** a transaction-scoped advisory lock per SOV
    holder, taken by `send_sov()` and `back_project()` before the balance is
    read, so one holding cannot be spent twice at once. The concurrency suite
    proved the hole (eight sends of 30 from 100 all went through, leaving
    -140) before the fix closed it.
35. **A word raised from a proposal is a quotation, not an attachment.**
    `term_sightings` records that a person, reading a proposal, stopped at a
    word in it: the word, the proposal, their name, and the sentence they
    stopped at. `raise_term_from()` refuses the sentence unless the proposal's
    own text contains it (title, summary or body, case- and whitespace-
    insensitive) and refuses the word unless the sentence contains it — the
    client is not trusted with either, because a sighting that quotes words a
    proposal never said is exactly the fabricated attachment rule 30 refuses.
    It is attributed and append-only: no insert policy (the function does the
    checking a policy cannot), no update, no delete, and one row per person per
    word per proposal. Sightings show **on the word's page and nowhere on the
    proposal's** — a list of "words in this proposal" would read as the
    proposal's vocabulary, which is the claim this table exists not to make.
    `proposals` has no column that points at words, `term_sightings` has no
    weight, score or relevance column, and nothing in `close_proposal()`,
    `cast_resonance()`, `can_reach_proposal()`, `activate_proposal()` or
    `dormant_proposals()` reads it: how often a word was stopped at is not a
    measure of anything the ledger records. Groups only, same group, for the
    same reason as rule 30.

36. **A record is written once.** What a law reading said, what a flag
    raised and what somebody said in a debate never change after the fact,
    and an answer to any of them is written once and stays signed by whoever
    wrote it — `freeze_law_assessment()`, `freeze_proposal_flag()` and
    `freeze_contribution()`, on top of `frozen_once()` and `frozen_person()`.
    The three UPDATE policies that used to admit an answer (`law_resolve`,
    `flags_resolve`, `comments_answer`) are gone and must not come back: a
    policy's `with check` sees the row after the update, so it could insist an
    answer was present and could not see that the same statement had also set
    `verdict = 'aligned'`. Every answer goes through its security definer
    function. A contribution can be taken back only while nobody has answered,
    adopted or replied to it and the decision is still open
    (`guard_contribution_delete()`). A proposal's status moves by hand in two
    ways only — into deliberation, and withdrawn before a vote — and every other
    move belongs to the decision functions (`guard_proposal_status()`).
    `24_record.sql` opens with the exploit itself. Recovered from the live
    database in 0029; it had been applied there as "0027" and never committed.

37. **Paying buys visibility, never approval.** (Rewritten in 0031. The
    marketplace is trade, not a proposal space; the 0030 version that admitted
    listings by passing proposals was retired before it held a row.) A
    business is approved when `vendor_status()` says so, and it says so only
    when the AI's reading of all ten laws (prompt `marketplace.vetting`) found
    no violation **and** a marketplace reviewer signed that reading off **and**
    no suspension is open — for the exact words the business stands on now,
    because every vetting stores a hash of what it read and an edit lapses
    approval. There is no approved column. A reviewer can refuse what the AI
    passed, can never pass what it refused, and never signs off their own
    business. Reviewers are added from the SQL editor; no policy lets anybody
    add themselves. Advertising is pay per click: only an approved business
    can start a campaign, an ad stops the moment approval lapses, and a click
    is charged once per person per campaign per day, never for the
    advertiser's own clicks and never past budget. The one sponsored slot is
    labelled, and since 0033 it goes to the **best fit for the viewer, not the
    highest bid**: `ad_fit()` is 70% full-text match between the business's
    words and the viewer's own `profile_values`, 30% how cleanly it passed
    vetting; the bid only breaks ties. Fit is computed per viewer and never
    stored, and the slot names which of the viewer's values it matched;
    advertisers see clicks and spend, never fit. `27_ad_alignment.sql` fails
    if a fit function reads the money side. **No approval or ordering function may read anything on the
    money side** — `25_trade.sql` reads their source for campaign, click,
    bid, spend and budget and fails if any appears. Organic listings are
    newest first and not for sale. A concern is seen by whoever raised it and
    the reviewers, never by the business. Not here yet: in-app checkout
    (listings link out), card billing for ads, ratings, SOV.
    **0038 adds proof of identity.** Approval also needs a verified website:
    the business publishes its token as a DNS TXT record or at
    /.well-known/sovereign-verify.txt, and a reviewer runs the check, which
    records what it found. A UK business may give a Companies House number,
    which a reviewer looks up (registered name and status, shown publicly).
    Verifications are written only by reviewers, never for their own
    business, and are tied to the exact domain or number checked.
    `32_market_verify.sql`.

38. **What the AI says is signed by the server.** Every AI artefact that
    decides something — a proposal review and its flags, a Universal Law
    reading or re-reading, a post's witness reading, a proposal's conditions,
    a business's vetting — is written only through `ai_write()` (0040), with
    an HMAC-SHA256 signature over the kind and exact payload, keyed by a
    secret held in Vercel (AI_SIGNING_SECRET) and in `private.ai_signing_key`.
    A trigger on each of those tables refuses an insert that did not come
    through a valid, fresh (15 minute) signature. The function runs as the
    caller, so every policy still applies. A vetting payload carries the hash
    of the business it read and is refused if the business has changed.
    Enforcement starts when the database row exists; switch on Vercel first,
    then the database. `34_signed_ai.sql`, `src/lib/ai/sign.test.ts`.

39. **Know yourself is yours alone and reaches nothing collective.** The
    assessment in Individual → Self (0041) draws on Tony Robbins' frameworks —
    six human needs, a values hierarchy toward and away, limiting and
    empowering beliefs, goals as result/purpose/actions — in Sovereign's own
    words (`src/lib/know.ts`). Only its owner can read it; answers are frozen
    (retaking writes a new one); the AI's focus (prompt `self.focus`) is
    written once. It is the centre of what the person's own AI chat
    understands about them, and nothing else: no decision, review,
    condition, ad, feed or SOV function may read `self_assessments`, and
    `35_self_assessment.sql` fails if one does.

## On the surface, not in the schema

These are interface conventions rather than rules the database enforces, but
each one restates a rule that it does, so changing the rule means changing the
line.

- **Every surface says who can read it.** `<Readers>` in `components/ui.tsx`
  names the audience on the journal, ideas, drafts, values, the AI, a chat, a
  proposal, Words, a word, Ask and the composer. Each line must match the
  policy actually in force — a line that promises more privacy than the RLS
  gives is worse than no line. Greyscale, because amber means "yours to act
  on" and this is the room, not an action.
- **The sign-in page lists what this place will not do.** `REFUSALS` in
  `(auth)/login/page.tsx` carries the rule number beside each line, so a
  promise cannot drift from the code that keeps it. No line may promise
  something no policy or function enforces.
- **A proposal shows where it has got to.** `proposalProgress()` derives the
  strip from `status` alone and draws nothing the record does not support: a
  failed proposal ends where it ended, a withdrawn one shows only that it was
  withdrawn (status does not say from which stage), and "passed" leaves the
  project step visibly ahead (rule 9). It never estimates a date — nothing in
  the schema knows one, and a made-up date reads as a promise.
- **Ask starts with examples.** `STARTERS` in `AskPanel.tsx`. Every ASK example
  is a question people genuinely disagree on, because a starting point with one
  obvious answer would teach that Ask is where answers come from (rule 29).
  FIND examples run on tap; ASK examples only fill the field.

## Where things go

- `src/lib/ai/` — the AI layer. `prompts.ts` holds versioned rubrics;
  `provider.ts` is the one-method interface; adapters sit beside it.
- `src/lib/ledger/` — the seam a chain adapter would replace. Vote recording,
  identity and treasury. Nothing above it knows which implementation is live.
- `src/lib/personhood/` — the verifier seam. One question asked outward (is
  this a distinct living human) and one answer kept (an opaque nullifier). An
  adapter that returns anything identifying is a bug, not a feature: there is
  nowhere in the schema to put it. With nothing configured the adapter refuses
  rather than pretending — unlike the AI layer's mock, a fake personhood proof
  IS the thing being proved.
- `src/app/(app)/collective/people/` — the graph: follow, friendship, the
  handle lookup and the public profile. Its `actions.ts` is imported from the
  profile screen too, because the handle belongs to the same feature.
- `src/lib/marketplace.ts` — pure helpers for the marketplace screens, and
  the form limits mirroring 0030's checks.
- `src/lib/collective.ts` — pure helpers for the collective screens. A
  `"use server"` file may only export async functions, so anything synchronous
  belongs here rather than in `actions.ts`.
- `src/lib/readiness.ts` — the bar and the hash, mirroring Postgres. The
  database's copies are the ones that decide.
- `src/lib/address.ts` — the address the collective screens are looking at: a
  group, or a place at one of five scales. Server-only; the cookie lives here.
- `supabase/migrations/` — schema, then policies, then functions. Applied in
  order. Never edit an applied migration; add another. If you redefine a
  function whose OUT parameters change, `drop function` it first — Postgres
  refuses a `create or replace` that changes the row type.

## Server actions

Every mutation is a server action in an `actions.ts` next to the page. They
return `{ ok: true }` or `{ ok: false, error }` rather than throwing, because
the caller is usually a `useTransition` in a component that needs to render the
message.

Queries run as the signed-in user, so RLS is the protection — not the `.eq()`
in the query. Write the `.eq()` anyway for clarity, but do not rely on it.

## Before pushing

```bash
npm run check     # typecheck, lint, build
```

The build must pass with no environment variables set. `src/lib/env.ts` reads
configuration through getters for exactly this reason: a missing key should
produce a readable message at request time, not a failed build.

And the database rules, which `npm run check` does not cover — every migration,
then every suite, both by glob:

```bash
createdb sovereign_test
ARGS=(-f supabase/tests/00_supabase_shim.sql)
for m in supabase/migrations/*.sql; do ARGS+=(-f "$m"); done
ARGS+=(-f supabase/tests/00b_support.sql)
for t in supabase/tests/[0-9][0-9]_*.sql; do
  case "$t" in *00_supabase_shim*|*00b_support*) continue;; esac
  ARGS+=(-f "$t")
done
psql -d sovereign_test -v ON_ERROR_STOP=1 "${ARGS[@]}"
```

And the concurrency suite, which needs real connections rather than one psql
session:

```bash
psql -d sovereign_test -v ON_ERROR_STOP=1 -f supabase/tests/concurrency/fixture.sql
PGDATABASE=sovereign_test python3 supabase/tests/concurrency/run.py
```

**Globs, never a list.** CI named its files once, the list stopped at 0003
while the schema went to 0026, and it passed for months while checking almost
nothing — then failed on a commit that had nothing to do with the reason. Two
regressions had gone in behind it in the meantime.

Two things that will bite when you add a suite: it must end with `reset role;`,
or the next suite runs as `app` and cannot create its own users; and its test
identities must not collide with another suite's, because they all share one
database in one run.

## Copy

The voice is the product. Plain words, no exclamation marks, no congratulation,
no "oops". Where a constraint exists, say what it is and why — the components
in `ResonancePanel.tsx` and `FlagList.tsx` are the reference for tone.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
