# Repository-to-production alignment audit — 25 October 2026

Carried out against Mackenzie's brief *Sovereign Repository-to-Production
Alignment Plan*. Every line says how it was checked. **Confirmed** means
observed directly; **unverified** means it could not be reached from the
session that ran the audit.

## Current state

| Layer | State | How checked |
|---|---|---|
| GitHub | Default branch `main`; head `3c12e62` (0059 safeguard) at the start of the audit | `git ls-remote`, fetch of `main` |
| CI | Workflow runs typecheck, lint, unit tests, build, every database suite and the concurrency suite. Result of recent runs **unverified** (no GitHub API access) | `.github/workflows/ci.yml` |
| Tests | All pass locally on Postgres 16: unit, every database suite, concurrency (26), build | Run in the audit session |
| Production database | All public functions, columns and triggers equal to a database built from 0001–0059; policies and grants differed (below) and were reconciled by 0060 | Fingerprint comparison (query below) |
| Migration ledger | One row (`0052_threads`); not a record of what is applied | `supabase_migrations.schema_migrations` |
| Secrets | `private.ai_signing_key` has a row; `AI_SIGNING_SECRET`, `ANTHROPIC_API_KEY` present in Vercel production. Values not read | Row count; Vercel env names |
| Vercel | Production at `3c12e62`, READY | Deployments list |
| Live site | `/explore/faq` and `/explore/roadmap` serve the current rules including the 0.382 safeguard | Fetched live |
| Usage | 4 onboarded, 0 groups, 1 proposal (global, pre-conditions), 0 decisions, 0 law readings ever, 0 personhood proofs | Read-only counts |

## Discrepancies

| # | Severity | Status | Finding | Resolution |
|---|---|---|---|---|
| 1 | High | Confirmed | `place_at(profile, scale)` callable by any signed-in user: any member's place, by id. Also `vendor_document`, `vendor_law_fit`, `my_values_query` | 0060, applied to production 25 Oct; `52_internal_helpers.sql` |
| 2 | High | Confirmed | Stand-in readings (no number) scored 1.000 and released | 0061: unscored, labelled "released without an AI reading" (Mackenzie's choice) |
| 3 | Medium | Confirmed | "Signed law audits" shown as Current; no signed audit ever recorded in production | Back to In testing until the first one lands |
| 4 | Medium | Confirmed | No group has run the cycle; national+ needs personhood with 0 proofs and no World ID client, so the one global proposal cannot pass | Pilot plan (roadmap) |
| 5 | Low | Confirmed | `alignment_shape`, `verified_voice_count` not granted on production as the repo intends | 0060 |
| 6 | Low | Confirmed | Untracked deny-all policy `retired_reactions_all` on production | Recorded in 0060 |
| 7 | Low | Confirmed | Roadmap item "Passed on its own conditions" omitted the safeguard | Fixed |
| 8 | — | Unverified | CI results; email/SMTP and magic-link delivery; `connect@mackiavelli.co.uk`; whether the Anthropic key is real | Needs owner access |

Supabase's security advisor (read in full): 201 security definer functions
callable by signed-in users (the RPC API, by design; the four that should not
be are fixed), the two intended signed-out functions, three tables with RLS
and no policy (by design: `conditions_epoch`, `release_epoch`, `founders`),
and leaked-password protection off (sign-in is by magic link only).

## Boundary tests (brief §5) — `49_release_and_pass.sql`

More than half strongly against → fails · exactly half → passes · fewer than
half → passes on its conditions · lukewarm, all above 0.382 → passes · too few
responses → close refused, stays open · non-steward close → refused ·
outsider cannot read, move or set conditions · second close → refused, one
decision · unscored audit → never a number, released and ledgered as
unscored · pre-numbers readings → count by verdict. Concurrency (duplicate
closes, votes racing a close) is `supabase/tests/concurrency`.

## The fingerprint query

```sql
with f as (
  select p.oid::regprocedure::text n,
         md5(regexp_replace(pg_get_functiondef(p.oid), E'\\n[ \\t]*(?=\\n)', '', 'g')) h
    from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.prokind = 'f'
     and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e'))
select 'fn', count(*), md5(string_agg(n || h, ',' order by n collate "C")) from f
union all
select 'pol', count(*), md5(string_agg(tablename||'.'||policyname||':'||cmd||':'||coalesce(qual,'')||':'||coalesce(with_check,''), E'\n'
       order by tablename collate "C", policyname collate "C")) from pg_policies where schemaname = 'public'
union all
select 'col', count(*), md5(string_agg(table_name||'.'||column_name||':'||data_type, E'\n'
       order by table_name collate "C", column_name collate "C")) from information_schema.columns where table_schema = 'public'
union all
select 'trg', count(*), md5(string_agg(event_object_table||'.'||trigger_name||':'||event_manipulation, E'\n'
       order by event_object_table collate "C", trigger_name collate "C", event_manipulation collate "C"))
  from information_schema.triggers where trigger_schema = 'public';
```

## Still to do (P1)

- The Universal Laws traceability matrix (brief §6).
- Smoke test of sign-in email, magic links and the contact address.
- The first signed audit in production, then signed audits back to Current.
- One real group through propose → release → decide → activate → reflect,
  with an evidence pack (brief §8).
