# Data protection impact assessment — Sovereign

Draft, 9 October 2026. Owner: Mackenzie (controller). Status: **draft for the
controller to review, adjust, sign and date.** Follows the structure of the
ICO's DPIA template. Not legal advice.

## 1. Why a DPIA is needed

Sovereign processes, on purpose and at its core:

- **political opinions** — every proposal, response and debate contribution;
- **religious and philosophical beliefs** — faith statements, values, beliefs
  in Know yourself;
- potentially **health** and other special category data people write in a
  private journal;
- with **AI** reading proposals, posts and businesses and making decisions
  that end a proposal or stop a post;
- with an optional **biometric** proof of personhood (done by a third-party
  verifier; Sovereign receives only an opaque code).

Large-scale special category data, innovative technology and automated
decisions are each on the ICO's list of processing likely to be high risk, so
a DPIA is required before launch.

## 2. The processing

**Nature.** A web app (Next.js on Vercel, Postgres on Supabase). People sign
in with an email link. They write privately (journal, ideas, to-dos, values,
Know yourself, learning notes), post socially (posts, likes, comments, chats
with friends), decide collectively (proposals, responses on three sliders,
debate, flags, predictions, projects), trade (verified businesses, link-out
buying, pay-per-click ads), and hold a simulated contribution token (SOV).

**Scope.** Founding 50 before 2027; then open. UK-based people. Over 18 only.
Data: email; profile; places named by the person (no coordinates); everything
written; the record of decisions; consent and law-acceptance records; one
personhood nullifier; business details; ad clicks.

**Context.** People join specifically to express political opinions and
beliefs, so they expect it — but they will also expect those opinions to stay
within the group they addressed, and their private writing to stay private.
Some members may be vulnerable (writing about health or hardship in a
journal). Political data is a target for misuse.

**Purposes.** Running the app for the person; making collective decisions
that stay true; keeping a private space; showing one relevant ad without
profiling; vetting businesses.

## 3. Consultation

- Members: the founding 50 are the consultation. Ask them directly, after a
  month, whether anything surprised them about who could see what.
- Processors: Supabase, Vercel, Anthropic DPAs (see the checklist).
- Legal: a data protection solicitor to review this DPIA and the privacy
  notice before opening beyond the founding 50.

## 4. Necessity and proportionality

- **Lawful basis.** Contract (Art 6(1)(b)) for running the service; explicit
  consent (Art 9(2)(a)) for special category data, asked in plain words that
  name the data, before anything is collected, recorded with the wording
  version (`data_consents`, 0045). Legitimate interests for keeping the
  unattributed collective record after someone leaves (see risk R5).
- **Minimisation.** No location coordinates. No phone number, no password, no
  real-name requirement. Personhood stores one opaque nullifier and has no
  column for anything else (rule 17). No follower graph is readable (rule 19).
  No behavioural profile is stored; the ad slot is chosen per view and not
  saved (rule 37). No analytics.
- **Accuracy.** People edit their own profile and private data. The
  collective record is deliberately not editable (rule 36), because its value
  is that it says what was said.
- **Retention.** For the life of the account; deleted on request at once
  (0045). Collective record kept, unattributed.
- **Rights.** Copy and deletion are self-service and instant. Everything else
  by email, within a month. Complaints acknowledged within 30 days.
- **Transfers.** Vercel and Anthropic are US-based: UK–US data bridge where
  certified, IDTA otherwise. Supabase region to be confirmed (prefer UK/EU).
- **Processors.** Under DPAs, acting only on instructions.

## 5. Risks

Likelihood and severity: remote / possible / probable; minimal / significant / severe.

| # | Risk to people | Likelihood | Severity | Overall |
|---|---|---|---|---|
| R1 | A breach exposes political opinions or beliefs, tied to real names or emails | Possible | Severe | **High** |
| R2 | Private journal or Know yourself read by someone else (bug, misconfigured policy, admin access) | Remote | Severe | Medium |
| R3 | An AI reading wrongly ends someone's proposal or blocks a post — unfair treatment, chilling effect | Possible | Significant | Medium |
| R4 | Members of a group learn how someone voted, or are pressured by a visible lean | Remote | Significant | Low |
| R11 | The operator (or a host) reads private writing or links responses to people, because the database can technically be read by whoever runs it | Possible | Severe | **High** |
| R5 | After deleting their account, a person's past responses and debate remain and could identify them by content | Possible | Significant | Medium |
| R6 | Ad matching is perceived as profiling on political beliefs | Possible | Significant | Medium |
| R7 | A child joins and has political or belief data processed | Possible | Significant | Medium |
| R8 | Personhood verifier processes biometrics; a person doesn't realise | Possible | Significant | Medium |
| R9 | Data transferred to the US is accessed by authorities | Remote | Significant | Low |
| R10 | Founder's own access to the production database (single admin, no separation) | Possible | Significant | Medium |

## 6. Measures

| # | Measure | Effect | Residual |
|---|---|---|---|
| R1 | Supabase encryption at rest and TLS; RLS on every table; no service key in the app; email is the only identifier held; breach plan (checklist item 8); MFA on Supabase, Vercel, GitHub, GoDaddy and email accounts | Reduced | Medium |
| R2 | Owner-only policies with no group path (rule 1), tested in SQL suites on every run; security definer functions carry their own checks; the export reads only the caller's rows | Reduced | Low |
| R3 | Every AI reading signed, published with reasons, challengeable (re-runs it); businesses need human sign-off; a person reviews any complaint about an AI decision; privacy notice explains (Arts 22A–22D safeguards) | Reduced | Low |
| R4 | Averages hidden until close (rule 3); responses readable by their author only, open or closed — the group sees an anonymous tally (0046); no "people you follow responded" (rule 20); splits reported as splits (rule 14) | Reduced | Low |
| R11 | Today: policy (the operator does not query private tables), MFA, separate admin account, the notice says so plainly. Planned: client-side encryption of the private space (key on the device) and anonymous ballots (eligibility proof with no link to the person). Until those exist this is the main residual risk and the one to explain to members. | Reduced | Medium |
| R5 | Profile scrubbed to "Former member", email and sign-in deleted, private data deleted, group memberships removed; notice and the delete screen say exactly what stays and why. **Open question for a solicitor:** whether keeping unattributed responses after a consent withdrawal is defensible, or whether responses to proposals that are still open should also be removed. | Reduced | Medium |
| R6 | Fit computed per view, never stored, never shown to the business; the slot says which of the viewer's own values it matched; values are the person's own words, not inferred; covered by explicit consent | Reduced | Low |
| R7 | 18+ confirmed at consent; terms say so; no features aimed at children. A tickbox is not age assurance, so this is honest only while the founding 50 are invited. Before opening in 2027: 16+ with high-privacy defaults for under-18s (Children's Code), an Online Safety Act children's access and risk assessment, and either highly effective age assurance or the children's safety measures. Never under 16. | Reduced | Medium |
| R8 | Optional, off unless the person chooses it; only needed at national scale and above; Sovereign receives a nullifier only; personhood screen to say plainly that the verifier processes a biometric and link to its notice before launch | Reduced | Low |
| R9 | Data bridge / IDTA; minimise what goes to the AI provider (only the text involved in a request) | Accepted | Low |
| R10 | Separate admin account; MFA; avoid reading private tables in the SQL editor; consider Supabase audit logs | Reduced | Low |

## 7. Sign-off

| Item | Name / date | Notes |
|---|---|---|
| Measures approved by | | |
| Residual risks approved by | | If any residual risk stays High, consult the ICO before processing |
| DPO / adviser advice | | Sovereign is small enough not to need a formal DPO; an adviser's read is recommended |
| Review date | | At 50 members, before opening widely, and whenever the processing changes |
