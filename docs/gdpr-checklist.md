# UK GDPR checklist

What Sovereign needs before the founding 50 use it for real, in order. Written
9 October 2026. Not legal advice: have a data protection solicitor read the
privacy notice and the DPIA once before launch.

## Built into the app (0045, rule 42)

- [x] Explicit consent to special category data, in words that name it, before
      anything is collected — `/consent`, recorded in `data_consents` with the
      wording version. Existing members are asked on their next visit.
- [x] 18 or over, confirmed at the same step (16+ planned for 2027).
- [x] Secret ballots between members: only the tally is shown, never who
      responded how (0046).
- [x] A copy of everything, instantly — Settings → Your data → Download.
- [x] Delete my account, instantly — same screen. Private data deleted; the
      collective record kept and no longer linked to the person.
- [x] Privacy notice rewritten to UK GDPR: controller, lawful bases per
      purpose, special category, processors, transfers, retention, rights,
      automated decisions, complaints, ICO.
- [x] Only strictly necessary cookies. No analytics, no trackers, fonts
      self-hosted — so no cookie banner is needed.
- [x] Data protection by design: owner-only private data in RLS, no follower
      counts, hidden tallies, signed AI readings, no profiling stored.

## Things only you can do

1. **Pay the ICO data protection fee.** Almost certainly required: Sovereign
   processes personal data electronically and is not exempt. Tier 1 (micro)
   is £52 a year, £47 by direct debit, as of July 2026. Register at
   ico.org.uk/for-organisations/data-protection-fee. Then put the
   registration number in `CONTROLLER.icoRegistration` in
   `src/app/(public)/explore/_site/site.ts`.
2. **Decide the legal entity** — you as a sole trader, or a limited company —
   and put the legal name in `CONTROLLER.name`. A company keeps personal
   liability away from you; worth it before strangers' political opinions sit
   in your database.
3. **Set up connect@mackiavelli.co.uk.** The privacy notice, the complaints
   process and every rights request point there. A forward to your own inbox
   is enough.
4. **Accept each processor's data processing agreement (DPA).**
   - Supabase: request or sign it from supabase.com/legal/dpa. Note which
     region the project is in; an EU or UK region is better than US.
   - Vercel: DPA is part of their terms; download a copy for your records.
   - Anthropic: the commercial terms include a DPA; accept it when the API key
     goes live.
   - The personhood verifier (World ID), before it is switched on.
5. **Read and adjust the DPIA** (`docs/dpia.md`). It's required because
   Sovereign processes political opinions and beliefs at scale with AI. Sign
   and date it. Re-read it when anything in it changes.
6. **Keep a complaints log.** Since 19 June 2026 people have a statutory right
   to complain to you first: acknowledge within 30 days, respond without
   undue delay, tell them the outcome. A spreadsheet of date / who / what /
   acknowledged / outcome is enough.
7. **Keep a rights-request log.** Same spreadsheet, another tab: requests you
   handle by email (most are self-service in the app). One month to respond.
8. **Breach plan.** If personal data leaks, you have 72 hours to tell the ICO
   unless it's unlikely to harm anyone, and must tell affected people if it's
   high risk. Write down now: who to call at Supabase/Vercel, how to rotate
   keys, where the ICO breach form is.
9. **Before the AI goes live:** check the Anthropic account is on terms that
   don't train on your data, and that the privacy notice still matches.
10. **Before billing advertisers:** add Stripe as a processor in the privacy
    notice, and keep invoices for six years (HMRC).

11. **Online Safety Act.** Sovereign has posts, comments and chats, so it is a
    user-to-user service. Do the illegal-content risk assessment now (Ofcom has
    a tool for small services). A tickbox saying "18 or over" is not highly
    effective age assurance, so before opening publicly Sovereign must either
    use real age assurance or do the children's access and risk assessments.
    Plan: 16+ in 2027 with high-privacy defaults for 16–17s.

## Re-check when

- a new table points at `profiles` — `39_data_rights.sql` fails until it is
  classified in `private.data_map` (export? delete or keep on erasure?);
- a new kind of special category data appears (e.g. photos of people,
  location, health features) — update the consent wording, bump
  `consent_version()` so everyone is asked again, and update the notice;
- a new processor is added;
- Sovereign opens beyond the founding 50 — re-run the DPIA.
