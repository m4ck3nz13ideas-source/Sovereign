import Link from "next/link";

import { BarList, StatGrid, StatTile } from "@/components/dash";
import { Gutter, Readers, SectionLabel } from "@/components/ui";
import { coordination } from "@/lib/ledger";
import { SPHERES } from "@/lib/spheres";
import { createClient } from "@/lib/supabase/server";

/**
 * Your record (the personal dashboard): what you have done here, from your
 * own rows only, read as you — every query below is answered by an
 * owner-only policy or by a proposal you could already open.
 *
 * It is a record, not a score (rules 19, 33): counts of acts, never a ratio
 * of you against anybody, and SOV shown as MINTED only — the balance lives in
 * Vault and no screen adds the two. "Where your responses went" puts the
 * Spheres of the proposals you responded to beside the ones you rated 4 or
 * 5, worked out here in the app, because no database function may read a
 * rating except the tally (rule 43).
 */
export async function RecordSection({ userId }: { userId: string }) {
  const supabase = await createClient();
  const since = daysAgo(30);

  const [
    { count: notes },
    { count: todosOpen },
    { count: todosDone },
    { data: myVotes },
    { data: mine },
    { data: ratings },
    entries,
  ] = await Promise.all([
    supabase.from("entries").select("id", { count: "exact", head: true }).eq("profile_id", userId).gte("created_at", since),
    supabase.from("todos").select("id", { count: "exact", head: true }).eq("profile_id", userId).is("done_at", null),
    supabase.from("todos").select("id", { count: "exact", head: true }).eq("profile_id", userId).gte("done_at", since),
    supabase.from("resonance_votes").select("proposal_id, proposals(sphere)").eq("profile_id", userId),
    supabase.from("proposals").select("status").eq("author_id", userId),
    supabase.from("sphere_priorities").select("sphere_id, rating"),
    coordination().entries(200),
  ]);

  const votes = (myVotes ?? []) as unknown as { proposal_id: string; proposals: { sphere: string | null } | null }[];
  const written = (mine ?? []) as { status: string }[];
  const passed = written.filter((p) => ["passed", "executing", "completed"].includes(p.status)).length;

  const mints = entries.filter((e) => e.kind === "mint");
  const minted = mints.reduce((a, e) => a + Number(e.amount), 0);
  const mintedRecent = mints.filter((e) => e.happened_at >= since).reduce((a, e) => a + Number(e.amount), 0);

  const cares = new Set(
    ((ratings ?? []) as { sphere_id: string; rating: number }[]).filter((r) => r.rating >= 4).map((r) => r.sphere_id),
  );
  const bySphere = new Map<string, number>();
  for (const v of votes) {
    const s = v.proposals?.sphere;
    if (s) bySphere.set(s, (bySphere.get(s) ?? 0) + 1);
  }
  const sphereRows = SPHERES.filter((s) => bySphere.has(s.id) || cares.has(s.id)).map((s) => ({
    label: s.name,
    value: bySphere.get(s.id) ?? 0,
    note: cares.has(s.id) ? "· matters to you" : undefined,
  }));

  return (
    <Gutter className="pt-8">
      <section id="record" className="scroll-mt-20">
        <SectionLabel right={<Link href="/individual/vault" className="text-gold">vault</Link>}>Your record</SectionLabel>
        <StatGrid>
          <StatTile label="Notes, 30 days" value={notes ?? 0} hint="written in your journal" />
          <StatTile label="To do" value={todosOpen ?? 0} hint={`${todosDone ?? 0} done in 30 days`} />
          <StatTile label="Responses" value={votes.length} hint="to proposals you read" />
          <StatTile label="Proposals" value={written.length} hint={`${passed} passed`} />
          <StatTile label="SOV minted" value={minted} hint={`${mintedRecent} in 30 days · a simulation`} />
        </StatGrid>

        {sphereRows.length ? (
          <div className="mt-5 rounded-card border border-line bg-surface-soft px-4 py-3.5">
            <p className="smallcaps mb-3 text-center text-[10px] text-paper-faint">Where your responses went</p>
            <BarList rows={sphereRows} />
            {[...cares].some((id) => !bySphere.has(id)) ? (
              <p className="mt-3 text-center text-[0.8125rem] text-paper-dim">
                Something you rated highly has had none of your responses yet.{" "}
                <Link href="/home?feed=foryou" className="text-gold hover:underline">
                  For you
                </Link>{" "}
                shows what touches it.
              </p>
            ) : null}
          </div>
        ) : null}

        <Readers className="mt-2">Only you. Counts of what you did, never a comparison with anybody.</Readers>
      </section>
    </Gutter>
  );
}

/** An ISO time n days back, at request time. */
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400_000).toISOString();
}
