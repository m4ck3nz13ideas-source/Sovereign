# Database tests

The rules that define Sovereign live in Postgres, not in the interface, so
this is where they are actually tested. A TypeScript test cannot tell you
whether a member can read someone else's private journal — a policy can.

## What is tested

Eighteen suites, four hundred and forty-one checks. Every one of them runs as a
non-superuser, so row-level security actually applies — a test that passes as the owner proves
nothing about what a member can see.

### `01_rules.sql` — twenty-five checks

- The auth trigger creates a profile, and RLS then hides everyone else's.
- Invite-only membership works, and nobody joins without a code.
- **A group member cannot read another member's entries.** The core promise.
- Values are invisible until their owner opts in, and visible immediately after.
- Resonance is refused before a review exists.
- Resonance is refused before the member has recorded reading it.
- The first resonance moves a proposal to `voting` with no admin step.
- Before close, a member sees only their own vote, and the summary hides the
  averages while still reporting the count.
- A four-character answer cannot resolve a critical flag.
- Answering a flag attributes and timestamps it.
- **Two unanswered critical flags fail a proposal on their own**, whatever the
  numbers say.
- The same proposal passes once the flags are answered and the rule is met.
- Passing does **not** create a project; activation does.
- After close, every vote and every average becomes visible.
- A project cannot be completed without a reflection.
- A thirteen-character reflection is rejected by the check constraint.
- Completion works once a real reflection exists.
- Retrieval finds past decisions by value overlap and carries the lesson into
  what the reviewer is given.
- The ledger chain verifies, and **an edited decision is detected** — run as
  superuser, because that is exactly the threat model.

### `02_universal_law.sql` — twelve checks

- An unaudited proposal cannot be closed at all.
- A violation stops resonance, and stops the proposal, with no override.
- A violation cannot be answered away — only challenged.
- A tension blocks until it is answered in writing, attributed.
- A challenge supersedes a reading rather than deleting it.

### `03_activation.sql` — seventeen checks

- A passed proposal is not a project.
- A need that nobody has covered blocks activation.
- Nobody can pledge on another person's behalf.
- A pledge can be withdrawn while the proposal is still waiting.
- A proposal with no needs activates immediately.

### `04_scope.sql` — nineteen checks

- Someone in no group at all can write a proposal for their own street.
- A neighbour who spells the place differently still sees it.
- Someone in another town cannot read it, and cannot respond to it.
- **Nobody can propose for a place they are not in.**
- A global proposal reaches everyone; a group proposal still reaches only the
  group, even from the same street.
- The author cannot re-aim a submitted proposal.
- A place decision records no participation share, because there is no
  register to be a share of.
- One voice passes at local scale, where the rule says one voice is enough.
- A regional proposal cannot be closed inside its deliberation window.
- Retrieval follows the address: Totnes does not learn from Hackney.
- The public ledger chain verifies.

### `05_readiness.sql` — sixteen checks

- An unsharpened draft is refused outright.
- A draft scoring 0.55 is refused, and the error says both numbers.
- A sharpening of a different text does not count.
- **Somebody else's sharpening does not count**, and nobody can record one in
  another member's name.
- A missing section is refused by the check constraint.
- **Asking again about the same words cannot talk past an earlier low score.**
- A sharpening is spent: one reading submits one proposal.
- The text and the score are fixed after submission — but withdrawal still
  works, which is why the text is frozen and the status is not.
- An unattached reading is private to its author; an attached one is part of
  the record.

### `06_discovery.sql` — sixteen checks

- The attention queue leads with what is most blocked, not what is newest.
- Every open proposal is in it exactly once, with a reason naming what blocks it.
- One you have already answered sinks, and says it is waiting on other people.
- Another street sees none of it.
- A proposal that ran out of voices comes back as dormant.
- **A proposal people read and declined never does.**
- Taking one up writes a new proposal, and the original drops out of dormant.
- A revival cannot be re-aimed at a different audience.
- The signal feed carries the decisions, and only to the place they were made in.

It raises `scope_rules.min_voices` for local at the top, as the owner, because
the shipped rule is one voice and this suite is about what happens below the
floor. It puts it back at the end.

### `07_debate.sql` — twenty-three checks

- A top-level contribution cannot be a reply, and a reply cannot be a question.
- A reply is not an answer, however good it is.
- An eight-character answer is refused; a real one is attributed, and cannot be
  given twice.
- An amendment is adopted, not answered — and only by the author or a steward.
- Adopting one alters nothing about the proposal's text.
- **An unanswered concern does not block a proposal**, and the decision records
  that it was open.
- Four people who agreed are not recorded as split.
- **Four people split two against two are** — and the proposal still passes on
  its mean, which is the whole reason the flag exists.
- A summary is readable by the group and cannot be rewritten afterwards.

### `08_projection.sql` — twenty-nine checks

- A three-word prediction and a zero-day horizon are both refused.
- The model's words carry the rubric that produced them; a person's words
  cannot pretend to.
- Another street sees none of it and cannot add to it.
- **Nothing can be added once the proposal closes** — a prediction written
  after the vote is a memory.
- The clock starts at the decision, not at the sentence.
- A miss cannot be called early; something that already happened can.
- A verdict needs twenty characters, is given exactly once, and the words
  cannot be rewritten or the row deleted afterwards.
- **A project does not complete while a prediction that has come due is
  unmarked** — and a year-out horizon does not hold it open.
- The forecasting record splits by whose words they were, and your own record
  does not leak into anybody else's.

### `09_personhood.sql` — twenty-four checks

- Unverified resonance is fine at local scale, where people can see each other.
- Reading a national proposal and raising a concern on it need nothing.
- **Unverified resonance at national scale is refused**, and passes once proved.
- `personhood_proofs` has no column for a name, document, image or biometric,
  and the nullifier never reaches the public ledger.
- **The same human cannot verify a second account.**
- Nobody can read, write or revoke somebody else's proof — including by
  writing the table directly.
- Revoking your own releases the hash for the same human to use elsewhere.
- An expired proof stops counting on its own.
- A group asks for nothing: it already has a register.
- The decision records how many of its voices were verified.

### `10_people.sql` — thirty checks

- A handle has a shape, and an exact one finds a person.
- **A partial handle finds nobody** — there is no directory.
- A stranger on another street is invisible until there is a reason.
- Following makes them readable, is not mutual, and is not friendship.
- **Nobody can read anybody else's follow graph.**
- You cannot accept your own friend request; asking back counts as accepting.
- One row per pair, whichever way round it was asked.
- **Friendship gives no access to a private journal and no say in a decision**
  — a friend on another street still cannot read or resonate on the proposal.
- The feed carries a friend's submitted proposal, carries nothing from a place
  you are not in, and **never reports who resonated on what**.

### `11_contention.sql` — twenty-two checks

- Proposals addressed to different people cannot be made alternatives, and
  nothing contends with itself.
- A proposal belongs to one set at a time.
- **You cannot rank what you have not read**, the same floor as resonance.
- Changing your mind replaces your choice rather than adding one.
- **Nobody can read anybody else's preference, and no running total is
  visible** until every member has closed — but you can see whether people
  have turned up.
- The set resolves by itself when its last member closes; one closing is not
  enough.
- **Both proposals pass.** A preference is not a verdict and never was.
- The less-preferred one cannot activate ahead of the preferred one — and
  once the preferred one has activated, it cannot activate at all, because the
  money is spent and the question is answered.

### `12_chat.sql` — twenty checks

- Strangers cannot start talking, and **following alone is not enough** —
  a conversation needs both people to have agreed.
- Your own message does not sit in your own unread count; theirs does, for
  them, until they mark it read.
- **The sender cannot tell whether it was read.** The read marker is the
  reader's own and there is no policy exposing it, and `messages` has no
  `read_at`, `delivered_at`, `seen_at` or `typing` column.
- A third person can read none of it, cannot write into somebody's thread,
  and cannot put words in another person's mouth.
- You can unsay your own message; you cannot delete theirs.
- **Ending the friendship stops new messages and keeps the old ones**, for
  both of them — and the thread drops off the conversation list.
- Nothing said reaches the ledger.

### `13_amendment.sql` — twenty-nine checks

- Revision 1 is never a row; the shipped text is the shipped text.
- **A street cannot amend the constitution** — an amendment must be global —
  and it is refused without both new texts.
- Which law it touches, and the wording, are frozen at submission.
- The reading list names what this law has already killed, by title.
- Nothing is enacted before it passes.
- **Passing as a proposal is not clearing the bar.** Two people at 0.80 and
  0.78 pass a global proposal and rewrite nothing.
- **One person at 0.40 among voices at 0.96 and 0.95 stops it.** The bar is on
  the lowest voice, which is as close as a 0–1 scale gets to "all users must
  agree" — and the law does not move.
- Enacting writes revision 2, `law_text()` returns it, only that law moves,
  and the same amendment cannot be enacted twice.
- A revision cannot be rewritten in place or deleted.
- It lands on the public ledger, and the history keeps the attempts that
  failed as well as the one that worked.

It lowers `scope_rules` for global at the top — a thousand voices and thirty
days is correct and untestable — and puts it back at the end. It also has to
verify all three people, because 0011 requires proof of personhood to resonate
at global scale, which is the right answer: a constitution is not rewritten by
accounts.

### `14_guardian.sql` — twelve checks

- The guardian is given the values *you* wrote down, and only yours.
- **Nobody else can read a note, write one in your name, or delete yours.**
- Nothing it produces reaches the ledger, and `proposals` grew no column for
  it.
- **`guardian_notes` has no `verdict`, `score`, `recommendation`,
  `alignment`, `profile_model`, `inferred_values` or `sentiment` column** —
  the absences that keep it a guardian rather than a handler.
- Forgetting is real, and it is the only thing in this schema that is.

### `15_mirror.sql` — fourteen checks

- Nothing is read from no responses.
- Four cold answers on proposals flagged for one law, against four warm ones
  on clean proposals, reads as a clear negative divergence.
- A law never found in tension does not appear at all.
- **One response is not a pattern** — below the floor the count is reported
  and the numbers are null.
- **Nobody else can read any of it**, and neither function takes an argument,
  which the suite asserts against `pg_proc` so that one cannot quietly grow
  a profile id later.
- Nothing about it is stored: no table anywhere has `mirror` in its name.

### `16_accession.sql` — twenty-seven checks

- **A partial constitution is refused.** Nine laws, none, or one law repeated
  ten times are all rejected — the count is what the database can check, since
  the ten themselves live in `src/lib/universal-law.ts` rather than a table.
- The revision is **stamped by the database**, not passed in, so a client
  cannot record agreement to an older and weaker wording.
- Agreeing twice writes nothing the second time.
- **It cannot be edited afterwards**: the suite attempts an update and a
  delete, asserts neither took, and asserts against `pg_policies` that no
  update or delete policy exists to permit one later.
- Nobody else can read it, and nobody can record an agreement in another
  person's name.
- **Accession gates nothing.** The suite reads the source of
  `can_reach_proposal` and `cast_resonance` and fails if either mentions
  `law_acceptances` — agreeing to the constitution is a record, not a
  permission system.
- After an amendment to one law: that law reads as amended since, the others
  do not, re-agreeing writes exactly one new row, and **the agreement to the
  original wording survives** — because it is a true record of what that
  person actually read.

### `17_inquiry.sql` — thirty-nine checks

- **A survey of one is refused**, and so is an empty one, and so are two
  positions that come from the same lens — the floor is two *distinct* ways of
  knowing.
- A failed call leaves nothing behind: the inquiry and its positions land
  together or not at all.
- Order is the order returned, not a ranking.
- **There is nowhere to say which one is right.** The suite asserts against
  `information_schema.columns` that `positions` has no `score`, `rank`,
  `weight`, `confidence`, `verdict`, `correct`, `best`, `strength` or `answer`
  column, and that `inquiries` has no `answer`, `conclusion`, `verdict`,
  `synthesis` or `resolved`.
- A position cannot be rewritten afterwards, and no update policy exists on
  either table to permit one later.
- A position cannot be inserted outside `record_inquiry()`, which is what makes
  the two-lens floor a rule rather than a request.
- Read follows the proposal: somebody it is addressed to sees it, somebody
  outside the address sees nothing and cannot ask.
- The asker may withdraw their own and nobody else may, and the positions go
  with it.
- **It counts towards nothing.** No ledger event, no column on `proposals` or
  `decisions`, and the suite reads the source of `close_proposal`,
  `cast_resonance` and `can_reach_proposal` and fails if any of them mentions
  inquiries.
- **A question asked on its own is owner-only, permanently.** Its asker sees
  it and reads its positions; somebody in the same place sees neither, and
  `my_inquiries()` returns nobody else's. The suite also asserts that no
  function exists whose name suggests attaching, publishing or promoting one
  onto a proposal, and that a direct `update` setting `proposal_id` does not
  take — "yours alone" cannot be true only until somebody changes their mind.
- Finding what is already here goes through the same eligibility question as
  everything else: a word in a reachable proposal is found, the same word is
  invisible to somebody outside the address, and a one-character or blank
  query returns nothing rather than the world.

### `18_lexicon.sql` — fifty checks

Most of this suite is absences, because a glossary is one line of DDL away at
any time and the failure would be silent: everything would still work, and the
one thing the feature carries — that two people mean different things — would
have been overwritten by whoever edited last.

- Only a member raises a word in a group, and only a member writes a reading.
- **The same word twice is the same word.** `Shared`, `  shared ` and `shared`
  are one row, because two people reaching for it independently is the signal
  rather than a collision — and the second one lands on the page where the
  first one's reading already is.
- Two people write two different things and **both survive**: nothing merged
  them, nothing picked one, and `voices` is 2.
- Writing again is a **revision, not an edit**: the current reading is the new
  one, there is still one row per person on screen, and the first wording comes
  back from `reading_history()` verbatim. A reading that has not been revised
  is not marked as having been.
- Append-only in the policies as well as in practice: no update or delete
  policy on either table, asserted against `pg_policies`, and a direct
  `update`, `delete` or rename does not take.
- Nobody writes in anybody else's name, and `write_reading()` takes no revision
  argument — a caller that could name one could overwrite one.
- **Outside the group, nothing**: not the readings, not the revisions, not the
  lexicon, and not the two tables read directly. The three read functions are
  `security definer`, which is exactly how two functions in this schema have
  already leaked, so the suite also asserts each one still mentions
  `is_group_member`.
- Ask finds a word by the word and by **what somebody said about it**, and the
  search line counts the readings rather than quoting one — quoting one is
  picking a winner in the one place this schema refuses to.

And the absences, each of which would be a small reasonable-looking addition:

- `terms` has no `definition`, `meaning`, `canonical`, `agreed`, `official`,
  `preferred`, `consensus` or `summary` column.
- `term_readings` has no `votes`, `score`, `rank`, `weight`, `helpful`,
  `endorsed`, `accepted`, `agrees`, `agreement`, `confidence`, `status` or
  `verdict` column.
- **Nothing measures whether two readings agree.** No function named for it
  exists, and the source of `group_lexicon()` and `readings_for()` is read and
  must not mention similarity, divergence, consensus or agreement. This is the
  sharpest one: a figure here would be wrong in a way nobody could audit while
  looking, on screen, exactly like a fact.
- The lexicon reaches no decision: the source of `close_proposal`,
  `cast_resonance`, `can_reach_proposal`, `activate_proposal`,
  `alignment_shape` and `bind_proposal_readiness` is read and must not mention
  either table.
- No term is attached to a proposal, decision or project.

## Running them

Against any Postgres 14+ with `pgcrypto` available:

```bash
createdb sovereign_test
psql -d sovereign_test -v ON_ERROR_STOP=1 \
  -f supabase/tests/00_supabase_shim.sql \
  -f supabase/migrations/0001_schema.sql \
  -f supabase/migrations/0002_rls.sql \
  -f supabase/migrations/0003_functions.sql \
  -f supabase/migrations/0004_universal_law.sql \
  -f supabase/migrations/0005_activation.sql \
  -f supabase/migrations/0006_scope.sql \
  -f supabase/migrations/0007_readiness.sql \
  -f supabase/migrations/0008_discovery.sql \
  -f supabase/migrations/0009_debate.sql \
  -f supabase/migrations/0010_projection.sql \
  -f supabase/migrations/0011_personhood.sql \
  -f supabase/migrations/0012_people.sql \
  -f supabase/migrations/0013_contention.sql \
  -f supabase/migrations/0014_chat.sql \
  -f supabase/migrations/0015_amendment.sql \
  -f supabase/migrations/0016_guardian.sql \
  -f supabase/migrations/0017_mirror.sql \
  -f supabase/migrations/0018_accession.sql \
  -f supabase/migrations/0019_inquiry.sql \
  -f supabase/migrations/0020_ask.sql \
  -f supabase/migrations/0021_accession_required.sql \
  -f supabase/migrations/0022_search_mine.sql \
  -f supabase/migrations/0023_lexicon.sql \
  -f supabase/tests/00b_support.sql \
  -f supabase/tests/01_rules.sql \
  -f supabase/tests/02_universal_law.sql \
  -f supabase/tests/03_activation.sql \
  -f supabase/tests/04_scope.sql \
  -f supabase/tests/05_readiness.sql \
  -f supabase/tests/06_discovery.sql \
  -f supabase/tests/07_debate.sql \
  -f supabase/tests/08_projection.sql \
  -f supabase/tests/09_personhood.sql \
  -f supabase/tests/10_people.sql \
  -f supabase/tests/11_contention.sql \
  -f supabase/tests/12_chat.sql \
  -f supabase/tests/13_amendment.sql \
  -f supabase/tests/14_guardian.sql \
  -f supabase/tests/15_mirror.sql \
  -f supabase/tests/16_accession.sql \
  -f supabase/tests/17_inquiry.sql \
  -f supabase/tests/18_lexicon.sql
```

`00b_support.sql` is test scaffolding: `test_propose()` does what the server
action does — records a sharpening, then submits — so the other suites stay
about the rules they are testing. It is deliberately not `security definer`,
because a helper that bypassed row-level security would quietly disarm every
test that uses it.

It prints `N passed, 0 failed` and raises if anything failed, so it is usable
as a CI step without parsing output.

`00_supabase_shim.sql` is a minimal stand-in for the parts of Supabase the
migrations touch: an `auth.users` table, an `auth.uid()` that reads a session
setting, and the `authenticated` and `anon` roles. It exists so the rules can
be tested locally without a Supabase project, and it is **not** applied to a
real one — Supabase provides all of this already.

### `08_projection.sql` — twenty-nine checks

- A three-word prediction and a zero-day horizon are both refused.
- The model's words carry the rubric that produced them; a person's words
  cannot pretend to.
- Another street sees none of it and cannot add to it.
- **Nothing can be added once the proposal closes** — a prediction written
  after the vote is a memory.
- The clock starts at the decision, not at the sentence.
- A miss cannot be called early; something that already happened can.
- A verdict needs twenty characters, is given exactly once, and the words
  cannot be rewritten or the row deleted afterwards.
- **A project does not complete while a prediction that has come due is
  unmarked** — and a year-out horizon does not hold it open.
- The forecasting record splits by whose words they were, and your own record
  does not leak into anybody else's.

### `09_personhood.sql` — twenty-four checks

- Unverified resonance is fine at local scale, where people can see each other.
- Reading a national proposal and raising a concern on it need nothing.
- **Unverified resonance at national scale is refused**, and passes once proved.
- `personhood_proofs` has no column for a name, document, image or biometric,
  and the nullifier never reaches the public ledger.
- **The same human cannot verify a second account.**
- Nobody can read, write or revoke somebody else's proof — including by
  writing the table directly.
- Revoking your own releases the hash for the same human to use elsewhere.
- An expired proof stops counting on its own.
- A group asks for nothing: it already has a register.
- The decision records how many of its voices were verified.

### `10_people.sql` — thirty checks

- A handle has a shape, and an exact one finds a person.
- **A partial handle finds nobody** — there is no directory.
- A stranger on another street is invisible until there is a reason.
- Following makes them readable, is not mutual, and is not friendship.
- **Nobody can read anybody else's follow graph.**
- You cannot accept your own friend request; asking back counts as accepting.
- One row per pair, whichever way round it was asked.
- **Friendship gives no access to a private journal and no say in a decision**
  — a friend on another street still cannot read or resonate on the proposal.
- The feed carries a friend's submitted proposal, carries nothing from a place
  you are not in, and **never reports who resonated on what**.

### `11_contention.sql` — twenty-two checks

- Proposals addressed to different people cannot be made alternatives, and
  nothing contends with itself.
- A proposal belongs to one set at a time.
- **You cannot rank what you have not read**, the same floor as resonance.
- Changing your mind replaces your choice rather than adding one.
- **Nobody can read anybody else's preference, and no running total is
  visible** until every member has closed — but you can see whether people
  have turned up.
- The set resolves by itself when its last member closes; one closing is not
  enough.
- **Both proposals pass.** A preference is not a verdict and never was.
- The less-preferred one cannot activate ahead of the preferred one — and
  once the preferred one has activated, it cannot activate at all, because the
  money is spent and the question is answered.

### `12_chat.sql` — twenty checks

- Strangers cannot start talking, and **following alone is not enough** —
  a conversation needs both people to have agreed.
- Your own message does not sit in your own unread count; theirs does, for
  them, until they mark it read.
- **The sender cannot tell whether it was read.** The read marker is the
  reader's own and there is no policy exposing it, and `messages` has no
  `read_at`, `delivered_at`, `seen_at` or `typing` column.
- A third person can read none of it, cannot write into somebody's thread,
  and cannot put words in another person's mouth.
- You can unsay your own message; you cannot delete theirs.
- **Ending the friendship stops new messages and keeps the old ones**, for
  both of them — and the thread drops off the conversation list.
- Nothing said reaches the ledger.

### `13_amendment.sql` — twenty-nine checks

- Revision 1 is never a row; the shipped text is the shipped text.
- **A street cannot amend the constitution** — an amendment must be global —
  and it is refused without both new texts.
- Which law it touches, and the wording, are frozen at submission.
- The reading list names what this law has already killed, by title.
- Nothing is enacted before it passes.
- **Passing as a proposal is not clearing the bar.** Two people at 0.80 and
  0.78 pass a global proposal and rewrite nothing.
- **One person at 0.40 among voices at 0.96 and 0.95 stops it.** The bar is on
  the lowest voice, which is as close as a 0–1 scale gets to "all users must
  agree" — and the law does not move.
- Enacting writes revision 2, `law_text()` returns it, only that law moves,
  and the same amendment cannot be enacted twice.
- A revision cannot be rewritten in place or deleted.
- It lands on the public ledger, and the history keeps the attempts that
  failed as well as the one that worked.

It lowers `scope_rules` for global at the top — a thousand voices and thirty
days is correct and untestable — and puts it back at the end. It also has to
verify all three people, because 0011 requires proof of personhood to resonate
at global scale, which is the right answer: a constitution is not rewritten by
accounts.

### `14_guardian.sql` — twelve checks

- The guardian is given the values *you* wrote down, and only yours.
- **Nobody else can read a note, write one in your name, or delete yours.**
- Nothing it produces reaches the ledger, and `proposals` grew no column for
  it.
- **`guardian_notes` has no `verdict`, `score`, `recommendation`,
  `alignment`, `profile_model`, `inferred_values` or `sentiment` column** —
  the absences that keep it a guardian rather than a handler.
- Forgetting is real, and it is the only thing in this schema that is.

### `15_mirror.sql` — fourteen checks

- Nothing is read from no responses.
- Four cold answers on proposals flagged for one law, against four warm ones
  on clean proposals, reads as a clear negative divergence.
- A law never found in tension does not appear at all.
- **One response is not a pattern** — below the floor the count is reported
  and the numbers are null.
- **Nobody else can read any of it**, and neither function takes an argument,
  which the suite asserts against `pg_proc` so that one cannot quietly grow
  a profile id later.
- Nothing about it is stored: no table anywhere has `mirror` in its name.

## Running them against a real Supabase project

Don't, on a project with data in it: the suite writes rows and leaves them.
Use a branch or a throwaway project, skip the shim, and run the suites in the
SQL editor.

## Adding a test

Every rule in the table in `docs/architecture.md` should have one. If you add a
rule to a `SECURITY DEFINER` function, add the case that proves it refuses —
the useful assertion is almost always that something is *not* allowed.
