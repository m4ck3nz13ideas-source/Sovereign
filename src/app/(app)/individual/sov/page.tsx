import { Card, Gutter, Screen, SectionLabel } from "@/components/ui";
import { coordination } from "@/lib/ledger";
import { shortDate } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

import { Send } from "./Send";

export const metadata = { title: "SOV · Sovereign" };

/**
 * SOV.
 *
 *   "SOV is minted through Proof of Alignment — earned by verifiable
 *    contributions that preserve or enhance life. No speculative mining; only
 *    service, wisdom and creation generate tokens."                  Overview
 *
 * Two figures, kept apart on the screen as they are kept apart in the schema,
 * because conflating them is how a contribution record becomes a wealth
 * ranking. Earned only goes up and is the Proof of Alignment record. Held moves
 * when you send or back something, and the moment SOV became transferable it
 * stopped being a claim about the person holding it.
 *
 * What is not here: a price, a conversion, anybody else's balance, and any way
 * to rank people. The first three are absent from the schema; the fourth is
 * impossible rather than merely absent, because no policy lets one person read
 * another's account.
 */
export default async function SovPage() {
  const { userId } = await requireSession();
  const supabase = await createClient();
  const sov = coordination();

  const [standing, entries, schedule, { data: people }] = await Promise.all([
    sov.standing(),
    sov.entries(30),
    sov.schedule(),
    supabase.rpc("my_people"),
  ]);

  const reachable = ((people ?? []) as {
    profile_id: string;
    display_name: string;
    handle: string | null;
  }[]).filter((p) => p.profile_id !== userId);

  return (
    <Screen>
      <Gutter className="space-y-8 pt-6">
        <div>
          <h2 className="display text-[1.75rem] text-paper">SOV</h2>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-paper-dim">
            {sov.describe()}
          </p>
        </div>

        {/* ------------------------------------------------------ THE TWO FIGURES */}
        <section>
          <SectionLabel>Where you stand</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <Card className="space-y-1">
              <p className="smallcaps text-[10px] text-paper-faint">Earned</p>
              <p className="display text-[1.75rem] text-gold tabular-nums">
                {standing.minted.toLocaleString()}
              </p>
              <p className="text-xs leading-relaxed text-paper-faint">
                Issued for finished acts. Only goes up, and cannot be sent or
                received — this is the record, not the money.
              </p>
            </Card>

            <Card className="space-y-1">
              <p className="smallcaps text-[10px] text-paper-faint">Held</p>
              <p className="display text-[1.75rem] text-paper tabular-nums">
                {standing.balance.toLocaleString()}
              </p>
              <p className="text-xs leading-relaxed text-paper-faint">
                What you have now. Moves when you send or back something, so it
                says nothing about what you did.
              </p>
            </Card>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-paper-faint tabular-nums">
            sent {standing.sent.toLocaleString()} · received{" "}
            {standing.received.toLocaleString()} · behind projects{" "}
            {standing.backing.toLocaleString()}
          </p>
        </section>

        {/* ------------------------------------------------------------ SENDING */}
        <section>
          <SectionLabel>Send some</SectionLabel>
          <Send people={reachable} />
        </section>

        {/* ----------------------------------------------------------- SCHEDULE */}
        <section>
          <SectionLabel>What mints, and what it is worth</SectionLabel>
          <Card className="space-y-4">
            {schedule.map((s) => (
              <div key={s.kind}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[0.9375rem] text-paper">
                    {s.kind === "project.completed"
                      ? "Finishing a project, with the reflection written"
                      : s.kind === "flag.answered"
                        ? "Answering a critical flag on the record"
                        : "Marking a prediction against what happened"}
                  </p>
                  <p className="tabular-nums text-gold">{Number(s.amount).toLocaleString()}</p>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-paper-faint">{s.rationale}</p>
              </div>
            ))}
            <p className="border-t border-line-soft pt-3 text-xs leading-relaxed text-paper-faint">
              Nothing mints for posting, following, being kept, turning up, or
              holding an opinion. Every issuance points at an act on the ledger
              and happens once.
            </p>
          </Card>
        </section>

        {/* ------------------------------------------------------------ ENTRIES */}
        <section>
          <SectionLabel>Every movement, and what for</SectionLabel>
          {entries.length ? (
            <ul className="divide-y divide-line-soft">
              {entries.map((e) => (
                <li key={e.id} className="py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[0.9375rem] text-paper">
                      {e.kind === "mint"
                        ? "Proof of Alignment"
                        : e.kind === "backing"
                          ? `Behind ${e.project_title ?? "a project"}`
                          : Number(e.amount) < 0
                            ? `To ${e.other_name ?? "somebody"}`
                            : `From ${e.other_name ?? "somebody"}`}
                    </p>
                    <p
                      className={`tabular-nums ${
                        Number(e.amount) < 0 ? "text-paper-dim" : "text-gold"
                      }`}
                    >
                      {Number(e.amount) > 0 ? "+" : ""}
                      {Number(e.amount).toLocaleString()}
                    </p>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-paper-faint">
                    {e.reason} · {shortDate(e.happened_at)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[0.9375rem] leading-relaxed text-paper-dim">
              Nothing yet. The first issuance comes from finishing something —
              a project delivered and reflected on, a critical flag answered, a
              prediction marked against what actually happened.
            </p>
          )}
        </section>

        <p className="border-t border-line-soft pt-6 text-xs leading-relaxed text-paper-faint">
          Nobody can read what you hold, which is what makes a league table
          impossible rather than merely absent. What is visible to your group is
          what you put behind a project, because that is a commitment to them.
        </p>
      </Gutter>
    </Screen>
  );
}
