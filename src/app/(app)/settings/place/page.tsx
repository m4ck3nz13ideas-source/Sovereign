import Link from "next/link";

import { Page, PageTitle, Prose } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { ScopeRule } from "@/lib/types";

import { PlaceForm } from "./PlaceForm";

export const metadata = { title: "Where you are · Sovereign" };

/**
 * Where you are.
 *
 * This is the whole of the eligibility model. There is no register, no
 * geocoder and no coordinate: four lines you write, which decide which
 * proposals are addressed to you and which ones you can write. A claim, not a
 * measurement — checkable by the people standing next to you, which is the
 * only verification that means anything at this scale.
 */
export default async function PlacePage() {
  const { profile } = await requireSession();
  const supabase = await createClient();

  const { data: rules } = await supabase
    .from("scope_rules")
    .select("*")
    .order("min_voices", { ascending: true });

  return (
    <Page>
      <Link
        href="/settings"
        className="smallcaps mb-6 inline-block text-[11px] text-paper-faint hover:text-gold"
      >
        ← Settings
      </Link>

      <PageTitle sub="What decides which proposals reach you.">
        Where you are
      </PageTitle>

      <Prose>
        {`Nobody has to invite you into anything. A proposal is addressed to a place at one of five scales, and you can read it, respond to it and write one of your own if you are in that place.

Write these the way you would say them. Matching ignores capitals and spacing, so "Stoke Newington" and "stoke newington" are the same street — but "N16" and "Stoke Newington" are not, so it is worth agreeing with your neighbours on one.

Leave a line blank and that scale simply is not yours. Global is everyone, always.`}
      </Prose>

      <div className="mt-8">
        <PlaceForm profile={profile} />
      </div>

      <section className="mt-12">
        <h2 className="smallcaps mb-3 text-[11px] text-paper-faint">
          What it takes to decide, at each scale
        </h2>
        <p className="mb-5 text-sm leading-relaxed text-paper-dim">
          A group knows how many members it has, so it can ask what share of
          them responded. A place cannot: there is no list of everyone in a
          city, and building one would be a surveillance project rather than a
          governance one. So the share is replaced by a floor on how many people
          actually responded. The alignment threshold does not move — 0.618 at
          every scale.
        </p>

        <ul className="space-y-2">
          {((rules ?? []) as ScopeRule[]).map((r) => (
            <li
              key={r.scope}
              className="rounded-card border border-line bg-surface-soft p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="smallcaps text-[11px] text-paper">{r.scope}</span>
                <span className="text-sm tabular-nums text-paper-dim">
                  {r.min_voices} {r.min_voices === 1 ? "voice" : "voices"} ·{" "}
                  alignment {Number(r.threshold_alignment).toFixed(3)} ·{" "}
                  {r.deliberation_days === 0
                    ? "no waiting period"
                    : `${r.deliberation_days} days of deliberation`}
                </span>
              </div>
              {r.note ? (
                <p className="mt-2 text-sm leading-relaxed text-paper-faint">
                  {r.note}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </Page>
  );
}

export const dynamic = "force-dynamic";
