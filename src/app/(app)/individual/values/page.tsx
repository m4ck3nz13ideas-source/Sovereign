import Link from "next/link";

import { Card, Gutter, Readers, Screen, SectionLabel, Tag } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { UNIVERSAL_LAWS } from "@/lib/universal-law";
import type { LawMirror, MirrorStanding, ProfileValue } from "@/lib/types";

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
  const { userId, profile } = await requireSession();
  const supabase = await createClient();

  const [{ data: values }, { data: mirrorRows }, { data: standingRows }] =
    await Promise.all([
    supabase
      .from("profile_values")
      .select("*")
      .eq("profile_id", userId)
      .order("position"),
    supabase.rpc("my_law_mirror"),
    supabase.rpc("my_mirror_standing"),
  ]);

  const mine = (values ?? []) as ProfileValue[];

  // Sorted by how far each law moves them, largest first — and by absolute
  // size, because a law that pulls them warmer is exactly as interesting as
  // one that pulls them cooler. Ranking by signed value would be the screen
  // quietly deciding which direction is the good one.
  const mirror = ((mirrorRows ?? []) as LawMirror[])
    .slice()
    .sort((a, b) => Math.abs(b.divergence ?? 0) - Math.abs(a.divergence ?? 0));
  const standing = (
    Array.isArray(standingRows) ? standingRows[0] : standingRows
  ) as MirrorStanding | undefined;
  const read = mirror.filter((m) => m.enough);
  const thin = mirror.filter((m) => !m.enough);

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
          <Readers className="mt-3">
            {profile.share_values
              ? "Your values: you, and the people in your groups, because you chose to share them. The mirror: only you — it is worked out when you open this screen and never stored."
              : "Only you. Your values stay yours unless you choose to share them with your groups, and the mirror is worked out when you open this screen and never stored."}
          </Readers>
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

          {read.length ? (
            <div className="space-y-2">
              {read.map((m) => {
                const law = UNIVERSAL_LAWS.find((l) => l.id === m.law_id);
                const d = m.divergence ?? 0;
                return (
                  <Card key={m.law_id}>
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="display text-[1.125rem] text-paper">
                        {law?.name ?? m.law_id}
                      </h3>
                      <span className="smallcaps text-[10px] text-paper-faint">
                        {m.responses} of yours
                      </span>
                    </div>
                    <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-paper-dim">
                      Where the audit found this in tension you answered{" "}
                      <span className="text-paper">{m.your_mean?.toFixed(2)}</span> on
                      average, against{" "}
                      <span className="text-paper">{m.your_baseline?.toFixed(2)}</span>{" "}
                      across everything you have answered —{" "}
                      {Math.abs(d) < 0.05 ? (
                        "which is no difference at all. This one does not seem to move you either way."
                      ) : (
                        <>
                          {Math.abs(d).toFixed(2)}{" "}
                          {d < 0 ? "cooler" : "warmer"}.
                        </>
                      )}
                    </p>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <p className="text-[0.9375rem] leading-relaxed text-paper">
                {standing && standing.responses > 0
                  ? `Nothing to read yet. You have responded to ${standing.responses} ${standing.responses === 1 ? "proposal" : "proposals"}, and a law needs ${standing.floor_at} of yours where the audit found it in tension before there is a pattern rather than a coincidence.`
                  : "Nothing to read yet. It is built from proposals you have responded to where the audit found a law in tension — so it fills in as you use the thing, and not before."}
              </p>
            </Card>
          )}

          {thin.length ? (
            <p className="mt-3 text-sm leading-relaxed text-paper-faint">
              {thin.length === 1
                ? "One other law has come up"
                : `${thin.length} other laws have come up`}{" "}
              but not often enough to read:{" "}
              {thin
                .map(
                  (m) =>
                    `${UNIVERSAL_LAWS.find((l) => l.id === m.law_id)?.name ?? m.law_id} (${m.responses})`,
                )
                .join(", ")}
              .
            </p>
          ) : null}

          <p className="mt-3 text-sm leading-relaxed text-paper-faint">
            This is not a score and neither direction is the good one. Backing
            something the audit flagged is not a failing — a tension is not a
            violation and the audit is sometimes wrong — and holding back from
            something clean is not virtue. What it says is that a law moves
            you, never that you are aligned with it.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-paper-faint">
            Nowhere is any of it stored, nobody else can read it, there is no
            function that will show it to anybody about you, and it weights
            nothing anywhere. Sovereign does not measure virtue. It can help
            you notice when what you say you hold and what you have been doing
            have come apart, which is a different thing and is yours to do
            something about.
          </p>
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
