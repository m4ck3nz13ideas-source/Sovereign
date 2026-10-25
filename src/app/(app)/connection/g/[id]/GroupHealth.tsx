import Link from "next/link";

import { BarList, StatGrid, StatTile, pct } from "@/components/dash";
import { PriorityTally, type TallyRow } from "@/components/spheres/PriorityTally";
import { SectionLabel } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

/** An ISO time n days back. Request time, on the server: this renders once. */
export function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400_000).toISOString();
}

/** A prediction whose horizon has passed. */
export function isDue(p: { created_at: string; horizon_days: number }): boolean {
  return new Date(p.created_at).getTime() + p.horizon_days * 86400_000 <= Date.now();
}

/**
 * How the group is doing, for its members (the group dashboard).
 *
 * Every figure is a count of the group's own record — proposals by stage,
 * decisions, turnout, projects, predictions waiting to be marked — read as the
 * member, so RLS is the boundary: nothing here a member could not already
 * open one item at a time. No person appears, and no figure is per person
 * (rules 19, 33). Turnout is the share of members who responded to decided
 * proposals, which the decision row already records.
 */
export async function GroupHealth({ groupId, members }: { groupId: string; members: number }) {
  const supabase = await createClient();
  const since90 = daysAgo(90);

  const { data: proposalRows } = await supabase
    .from("proposals")
    .select("id, status, submitted_at, charter_change")
    .eq("group_id", groupId);
  const proposals = (proposalRows ?? []) as {
    id: string;
    status: string;
    submitted_at: string;
    charter_change: unknown;
  }[];
  const ids = proposals.map((p) => p.id);

  const [{ data: decisionRows }, { data: projectionRows }, { data: projectRows }, { data: tally }] =
    await Promise.all([
      ids.length
        ? supabase.from("decisions").select("outcome, participation, decided_at").in("proposal_id", ids)
        : Promise.resolve({ data: [] }),
      ids.length
        ? supabase
            .from("projections")
            .select("created_at, horizon_days, verdict")
            .in("proposal_id", ids)
            .is("verdict", null)
        : Promise.resolve({ data: [] }),
      supabase.from("projects").select("status").eq("group_id", groupId),
      supabase.rpc("sphere_priority_tally", { p_group_id: groupId, p_scope: null }),
    ]);

  const count = (...s: string[]) => proposals.filter((p) => s.includes(p.status)).length;
  const held = count("in_review");
  const live = count("in_deliberation", "voting");
  const waiting = proposals.filter((p) => p.status === "passed" && !p.charter_change).length;

  const decisions = (decisionRows ?? []) as { outcome: string; participation: number | null; decided_at: string }[];
  const recent = decisions.filter((d) => d.decided_at >= since90);
  const passedRecent = recent.filter((d) => d.outcome === "passed").length;
  const turnouts = recent.map((d) => d.participation).filter((n): n is number => n !== null);
  const turnout = turnouts.length ? turnouts.reduce((a, b) => a + Number(b), 0) / turnouts.length : null;

  const due = ((projectionRows ?? []) as { created_at: string; horizon_days: number }[]).filter(isDue).length;

  const projects = (projectRows ?? []) as { status: string }[];
  const underway = projects.filter((p) => p.status === "planning" || p.status === "executing").length;
  const done = projects.filter((p) => p.status === "completed").length;

  return (
    <section>
      <SectionLabel right={<Link href="/collective/proposals" className="text-gold">proposals</Link>}>
        How it is going
      </SectionLabel>

      <StatGrid>
        <StatTile label="Open now" value={live} hint={live === 1 ? "proposal taking responses" : "proposals taking responses"} />
        <StatTile
          label="Held in review"
          value={held}
          attention={held > 0}
          hint={held ? "below 0.618 with the laws, or not yet read" : "nothing held"}
        />
        <StatTile
          label="Passed, waiting"
          value={waiting}
          attention={waiting > 0}
          hint={waiting ? "needs someone against each need" : "nothing waiting"}
        />
        <StatTile label="Decided, 90 days" value={recent.length} hint={`${passedRecent} passed`} />
        <StatTile
          label="Turnout, 90 days"
          value={turnout === null ? "—" : pct(turnout, 1)}
          hint={`of ${members} ${members === 1 ? "member" : "members"}, on decided proposals`}
        />
        <StatTile
          label="Predictions due"
          value={due}
          attention={due > 0}
          hint={due ? "to mark against what happened" : "none to mark"}
        />
      </StatGrid>

      {proposals.length ? (
        <div className="mt-5 rounded-card border border-line bg-surface-soft px-4 py-3.5">
          <p className="smallcaps mb-3 text-center text-[10px] text-paper-faint">Every proposal, by where it is</p>
          <BarList
            rows={[
              { label: "In review", value: held },
              { label: "Open", value: live },
              { label: "Passed", value: count("passed") },
              { label: "Under way", value: underway },
              { label: "Done", value: done },
              { label: "Did not pass", value: count("failed") },
            ]}
          />
        </div>
      ) : null}

      <div className="mt-5 rounded-card border border-line bg-surface-soft px-4 py-3.5">
        <p className="smallcaps mb-3 text-center text-[10px] text-paper-faint">What matters here</p>
        <PriorityTally rows={(tally ?? []) as TallyRow[]} here="this group" />
      </div>
    </section>
  );
}
