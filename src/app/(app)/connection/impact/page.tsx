import Link from "next/link";

import { CollectiveTabs } from "@/components/nav/CollectiveTabs";
import { Card, Empty, Page, PageTitle, SectionLabel } from "@/components/ui";
import { money, shortDate } from "@/lib/format";
import { requireGroup } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { ContributionRecord, Project, Reflection } from "@/lib/types";

import { LedgerCheck } from "./LedgerCheck";

export const metadata = { title: "Impact · Sovereign" };

/**
 * Impact — results, reflection, learnings, contribution record.
 *
 * The last node in the chain from Sovereign Overview (2), and the one that
 * feeds back into the Individual and the Collective. Everything here is
 * derived: nothing on this page can be edited, because a record you can edit
 * is not a record.
 */
export default async function ImpactPage() {
  const { userId, group } = await requireGroup();
  const supabase = await createClient();

  const [{ data: projectRows }, { data: reflectionRows }, { data: record }] =
    await Promise.all([
      supabase.from("projects").select("*").eq("group_id", group.id),
      supabase
        .from("reflections")
        .select("*, projects(title, proposal_id, group_id)")
        .order("created_at", { ascending: false })
        .limit(30),
      supabase.rpc("contribution_record", {
        p_profile_id: userId,
        p_group_id: group.id,
      }),
    ]);

  const projects = (projectRows ?? []) as Project[];
  const reflections = (reflectionRows ?? []).filter(
    (r) => (r.projects as unknown as { group_id: string } | null)?.group_id === group.id,
  ) as unknown as (Reflection & {
    projects: { title: string; proposal_id: string } | null;
  })[];

  const mine = (Array.isArray(record) ? record[0] : record) as
    | ContributionRecord
    | undefined;

  const completed = projects.filter((p) => p.status === "completed").length;
  const committed = projects.reduce((n, p) => n + Number(p.budget_committed), 0);
  const spent = projects.reduce((n, p) => n + Number(p.budget_spent), 0);

  const lessons = reflections.filter((r) => r.lesson);
  const wrongAssumptions = reflections.filter((r) => r.assumption_wrong);

  return (
    <Page>
      <PageTitle sub={group.name}>Impact</PageTitle>
      <CollectiveTabs />

      <section className="mb-10">
        <SectionLabel>Results</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Projects finished" value={String(completed)} />
          <Stat label="Still running" value={String(projects.length - completed)} />
          <Stat label="Committed" value={money(committed)} />
          <Stat label="Spent" value={money(spent)} />
        </div>
      </section>

      <section className="mb-10">
        <SectionLabel right={lessons.length ? `${lessons.length}` : undefined}>
          Learnings
        </SectionLabel>

        {lessons.length ? (
          <ul className="space-y-3">
            {lessons.map((r) => (
              <li key={r.id}>
                <Card>
                  <p className="text-[0.95rem] leading-relaxed text-paper">{r.lesson}</p>
                  {r.projects ? (
                    <Link
                      href={`/connection/projects/${r.projects.proposal_id}`}
                      className="smallcaps mt-2 inline-block text-[10px] text-paper-faint hover:text-gold"
                    >
                      {r.projects.title} · {shortDate(r.created_at)}
                    </Link>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>
            Nothing learned on the record yet. A lesson lands here when a
            project is completed with a reflection.
          </Empty>
        )}
      </section>

      {wrongAssumptions.length ? (
        <section className="mb-10">
          <SectionLabel right={`${wrongAssumptions.length}`}>
            What this group has been wrong about
          </SectionLabel>
          <ul className="space-y-3">
            {wrongAssumptions.map((r) => (
              <li key={r.id}>
                <Card className="border-alarm/30">
                  <p className="text-[0.95rem] leading-relaxed text-paper-dim">
                    {r.assumption_wrong}
                  </p>
                  {r.projects ? (
                    <p className="smallcaps mt-2 text-[10px] text-paper-faint">
                      {r.projects.title}
                    </p>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-paper-faint">
            Kept deliberately visible. A group that can point at its own wrong
            assumptions is the one this is built for.
          </p>
        </section>
      ) : null}

      <section className="mb-10">
        <SectionLabel>Your contribution</SectionLabel>

        {mine ? (
          <Card>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5 text-sm">
              <Row label="Proposals written" value={mine.proposals_authored} />
              <Row label="Of those, passed" value={mine.proposals_passed} />
              <Row label="Resonance recorded" value={mine.resonance_recorded} />
              <Row label="Said something" value={mine.comments_written} />
              <Row label="Tasks finished" value={mine.tasks_completed} />
              <Row label="Reflections written" value={mine.reflections_written} />
            </dl>
            <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-paper-faint">
              A record of what you did, not a score. Nothing here is ranked,
              compared, or weighted into anyone&rsquo;s influence — and there is
              no token behind it.
            </p>
          </Card>
        ) : (
          <Empty>Nothing recorded yet.</Empty>
        )}
      </section>

      <section>
        <SectionLabel>The record itself</SectionLabel>
        <LedgerCheck groupId={group.id} />
      </section>
    </Page>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-line bg-surface-soft px-4 py-3.5">
      <p className="font-serif text-2xl text-paper">{value}</p>
      <p className="smallcaps mt-0.5 text-[10px] text-paper-faint">{label}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <>
      <dt className="text-paper-dim">{label}</dt>
      <dd className="text-right tabular-nums text-paper">{value}</dd>
    </>
  );
}
