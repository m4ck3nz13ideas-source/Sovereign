import Link from "next/link";

import { Card, Page, PageTitle, SectionLabel, Tag } from "@/components/ui";
import { verifier } from "@/lib/personhood";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { PersonhoodStanding } from "@/lib/types";

import { ProvePanel } from "./ProvePanel";

export const metadata = { title: "One person · Sovereign" };

/**
 * Proof of personhood.
 *
 * A place has no register, which is what lets anyone take part in their own
 * street without being invited into anything — and it means one person with
 * five accounts can carry a vote. At the scale of a street that is visible and
 * self-correcting. At the scale of a country it is the whole system defeated
 * by a spreadsheet.
 *
 * So the count gets defended and nothing else does. This page is careful to
 * say which is which, because a verification screen that overstates what it
 * has verified is how identity systems become the thing they were built to
 * prevent.
 */
export default async function PersonhoodPage() {
  await requireSession();
  const supabase = await createClient();

  const [{ data: standing }, { data: verified }] = await Promise.all([
    supabase.rpc("personhood_standing", { p_scope: null }),
    supabase.rpc("is_verified_person", { p_profile_id: null }),
  ]);

  const scales = (standing ?? []) as PersonhoodStanding[];
  const v = verifier();

  return (
    <Page>
      <Link
        href="/settings"
        className="smallcaps mb-6 inline-block text-[11px] text-paper-faint hover:text-gold"
      >
        ← Settings
      </Link>

      <PageTitle>
        One person
      </PageTitle>

      <section className="mb-10">
        <SectionLabel
          right={
            <Tag tone={verified ? "calm" : "alarm"}>
              {verified ? "verified" : "not verified"}
            </Tag>
          }
        >
          {v.live ? v.name : "no verifier"}
        </SectionLabel>
        <Card>
          <ProvePanel configured={v.live} verified={Boolean(verified)} />
        </Card>
      </section>

      <section className="mb-10">
        <SectionLabel>What this proves</SectionLabel>
        <Card>
          <p className="text-[0.95rem] leading-relaxed text-paper-dim">
            That you are a distinct living person, and that this account is your
            only one here.
          </p>
          <p className="mt-3 text-[0.95rem] leading-relaxed text-paper-dim">
            It does not prove who you are, what you are called, where you live,
            or that you are entitled to anything. Where you are stays a claim
            you write in your own words, checkable by the people standing next
            to you. That has not changed and is not going to.
          </p>
        </Card>
      </section>

      <section className="mb-10">
        <SectionLabel>What is stored</SectionLabel>
        <Card>
          <p className="text-[0.95rem] leading-relaxed text-paper-dim">
            One opaque hash. It is the same for you every time you come back
            here, different at every other application that uses the same
            verifier, and it cannot be turned back into you by anybody holding
            it — including whoever runs this instance.
          </p>
          <p className="mt-3 text-[0.95rem] leading-relaxed text-paper-dim">
            No name. No document. No photograph. No biometric. No account at the
            verifier. The table it lives in has nowhere to put any of those, and
            only you can read your own row. The public ledger records that you
            verified, by which verifier and how strongly — never the hash.
          </p>
        </Card>
      </section>

      <section className="mb-10">
        <SectionLabel>Where it is asked for</SectionLabel>
        <Card>
          <ul className="space-y-2.5">
            {scales.map((s) => (
              <li key={s.scope} className="flex items-baseline justify-between gap-3">
                <span className="text-[0.95rem] text-paper capitalize">{s.scope}</span>
                <span className="smallcaps text-[10px] text-paper-faint">
                  {s.required ? "proof needed to resonate" : "no proof needed"}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[0.8125rem] leading-relaxed text-paper-faint">
            Reading, writing proposals, asking questions and raising concerns
            never need proof, at any scale. Only the count does, and only where
            people are too far apart to see each other — the bigger the circle,
            the more the claim has to be backed. Inside a group nothing is asked
            at all: a group already has a register.
          </p>
        </Card>
      </section>

      <section className="mb-10">
        <SectionLabel>How this verifier works</SectionLabel>
        <Card>
          <p className="text-[0.95rem] leading-relaxed text-paper-dim">{v.describe()}</p>
        </Card>
      </section>
    </Page>
  );
}

export const dynamic = "force-dynamic";
