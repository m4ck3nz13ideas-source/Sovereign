import Link from "next/link";

import { Card, Gutter, Screen, SectionLabel, Tag } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { UNIVERSAL_LAWS } from "@/lib/universal-law";
import type { ProfileValue } from "@/lib/types";

export const metadata = { title: "Values · Sovereign" };

/**
 * Values — the ethical compass, and the most carefully drawn screen here.
 *
 * The overview says two things about alignment. Screen 4 shows a personal
 * scorecard against the Universal Laws. The later "Alignment System (Final
 * Design)" section says Sovereign does NOT score individuals against them, and
 * offers only optional profile-to-profile comparison — "alignment exists only
 * to reveal similarity, not to measure virtue."
 *
 * Both, resolved: a reading only YOU can ever see, and a comparison that is
 * opt-in and symmetrical. Nobody is ranked against anybody, nothing here
 * influences a decision, and no number leaves this screen. A private mirror is
 * a tool for thinking; a public score is a tool for sorting people, and this
 * product should never contain the second.
 */
export default async function ValuesPage() {
  const { userId } = await requireSession();
  const supabase = await createClient();

  const [{ data: values }, { count: responses }] = await Promise.all([
    supabase
      .from("profile_values")
      .select("*")
      .eq("profile_id", userId)
      .order("position"),
    supabase
      .from("resonance_votes")
      .select("proposal_id", { count: "exact", head: true })
      .eq("profile_id", userId),
  ]);

  const mine = (values ?? []) as ProfileValue[];
  const answered = responses ?? 0;

  return (
    <Screen>
      <Gutter className="space-y-8 pt-6">
        <div>
          <h2 className="display text-[1.75rem] text-paper">Values</h2>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-paper-dim">
            What you hold, in your own words, and the ten laws that hold
            everyone. Nothing on this screen is a score anybody else can see,
            and nothing on it affects a decision.
          </p>
        </div>

        {/* ------------------------------------------------------ YOUR OWN */}
        <section>
          <SectionLabel
            right={
              <Link href="/individual/profile" className="text-gold">
                edit
              </Link>
            }
          >
            Yours
          </SectionLabel>

          {mine.length ? (
            <ul className="space-y-2">
              {mine.map((v) => (
                <li key={v.id}>
                  <Card>
                    <h3 className="display text-[1.125rem] text-paper">{v.name}</h3>
                    {v.definition ? (
                      <p className="mt-1 text-[0.9375rem] leading-relaxed text-paper-dim">
                        {v.definition}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-paper-faint">
                        No definition. A value without one is a word.
                      </p>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <Card>
              <p className="text-[0.9375rem] leading-relaxed text-paper-dim">
                You have not named any. Three you actually hold, defined in your
                own words, is the whole exercise — and when you write a proposal
                for a place, they are the rubric it gets read against.
              </p>
              <Link
                href="/individual/profile"
                className="mt-3 inline-block text-[0.9375rem] font-medium text-gold"
              >
                Name them →
              </Link>
            </Card>
          )}
        </section>

        {/* --------------------------------------------------- THE TEN LAWS */}
        <section>
          <SectionLabel right={<Tag tone="gold">constitutional</Tag>}>
            The ten
          </SectionLabel>

          <p className="mb-3 text-sm leading-relaxed text-paper-faint">
            These are not yours and not the group&rsquo;s. They sit above every
            decision made here, they are shipped as code rather than as rows
            somebody could edit, and changing one takes the agreement of every
            user — not a threshold, all of them.
          </p>

          <ul className="space-y-2">
            {UNIVERSAL_LAWS.map((law) => (
              <li key={law.id}>
                <Card>
                  <div className="flex items-baseline gap-2.5">
                    <span className="tabular-nums text-sm text-paper-faint">
                      {law.ordinal}
                    </span>
                    <h3 className="display text-[1.125rem] text-paper">
                      {law.name}
                    </h3>
                  </div>
                  <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-paper-dim">
                    {law.text}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        </section>

        {/* -------------------------------------------------- YOUR OWN READING */}
        <section>
          <SectionLabel right={<Tag>private</Tag>}>
            Where you and the audit differ
          </SectionLabel>

          <Card>
            <p className="text-[0.9375rem] leading-relaxed text-paper">
              {answered < 5
                ? `A reading of your own responses against the ten laws — where you have backed something the audit found in tension, and where you have held back from something it found clean. It needs more to read: you have responded to ${answered} ${answered === 1 ? "proposal" : "proposals"}, and five is the floor before a pattern means anything.`
                : `A reading of your ${answered} responses against the ten laws is possible now. It is not built yet — it is the next thing on this screen.`}
            </p>
            <p className="mt-3 border-t border-line pt-3 text-sm leading-relaxed text-paper-faint">
              When it exists it will be visible to you and to nobody else, it
              will not be stored as a score, and it will never weight your
              resonance. Sovereign does not measure virtue. It can help you
              notice when what you say you hold and what you have been doing
              have come apart, which is a different thing and is yours to do
              something about.
            </p>
          </Card>
        </section>

        {/* ----------------------------------------------------- COMPARISON */}
        <section>
          <SectionLabel right={<Tag>not built</Tag>}>
            Comparing with someone
          </SectionLabel>
          <div className="rounded-card border border-dashed border-line px-4 py-3.5">
            <p className="text-[0.9375rem] leading-relaxed text-paper-dim">
              An optional, symmetrical comparison — you ↔ them, across values,
              decisions and projects — for finding people worth working with.
              Off unless both of you turn it on, and the system works entirely
              without it.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-paper-faint">
              It reveals similarity. It does not measure virtue, and there is no
              ranking anywhere behind it.
            </p>
          </div>
        </section>
      </Gutter>
    </Screen>
  );
}

export const dynamic = "force-dynamic";
