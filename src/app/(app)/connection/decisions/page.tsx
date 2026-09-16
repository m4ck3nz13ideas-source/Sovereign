import Link from "next/link";

import { CollectiveTabs } from "@/components/nav/CollectiveTabs";
import { Card, Empty, Page, PageTitle, ScoreBar, Tag } from "@/components/ui";
import { shortDate } from "@/lib/format";
import { requireGroup } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Decision } from "@/lib/types";

export const metadata = { title: "Decisions · Sovereign" };

/**
 * The record of what the group decided, and why.
 *
 * This page is the group's memory, and it is also the retrieval corpus: when
 * a new proposal is reviewed, the decisions here — ranked by overlap of the
 * values they invoked — are given to the reviewer along with what actually
 * happened. A group that never writes reflections has a memory that cannot
 * teach it anything, which is the point of the gate on completing a project.
 */
export default async function DecisionsPage() {
  const { group } = await requireGroup();
  const supabase = await createClient();

  const { data } = await supabase
    .from("decisions")
    .select("*, proposals(title, summary, id)")
    .order("decided_at", { ascending: false })
    .limit(60);

  const decisions = (data ?? []) as unknown as (Decision & {
    proposals: { id: string; title: string; summary: string } | null;
  })[];

  return (
    <Page>
      <PageTitle sub={group.name}>Decisions</PageTitle>
      <CollectiveTabs />

      {decisions.length ? (
        <ul className="space-y-4">
          {decisions.map((d) => {
            const passed = d.outcome === "passed";
            return (
              <li key={d.id}>
                <Card className={passed ? "border-calm/30" : ""}>
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/connection/proposals/${d.proposal_id}`}
                      className="font-serif text-lg leading-snug text-paper hover:text-gold"
                    >
                      {d.proposals?.title ?? "A proposal"}
                    </Link>
                    <Tag tone={passed ? "calm" : "alarm"}>
                      {passed ? "passed" : "did not pass"}
                    </Tag>
                  </div>

                  {d.rationale_summary ? (
                    <p className="mt-2.5 text-sm leading-relaxed text-paper-dim">
                      {d.rationale_summary}
                    </p>
                  ) : null}

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <ScoreBar
                      label="Alignment"
                      value={d.avg_alignment === null ? null : Number(d.avg_alignment)}
                    />
                    <ScoreBar
                      label="Participation"
                      value={d.participation === null ? null : Number(d.participation)}
                      hint={`${d.voter_count} of ${d.member_count}`}
                    />
                  </div>

                  <p className="smallcaps mt-3.5 flex flex-wrap gap-x-2 text-[10px] text-paper-faint">
                    <span>{shortDate(d.decided_at)}</span>
                    {d.values_invoked.length ? (
                      <>
                        <span>·</span>
                        <span>{d.values_invoked.join(", ")}</span>
                      </>
                    ) : null}
                  </p>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty>
          Nothing decided yet. Decisions land here when a proposal closes, and
          this is what the review layer reads when the next one arrives.
        </Empty>
      )}
    </Page>
  );
}
