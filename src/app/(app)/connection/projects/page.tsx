import Link from "next/link";

import { CollectiveTabs } from "@/components/nav/CollectiveTabs";
import { ScaleSelector } from "@/components/nav/ScaleSelector";
import { Card, Empty, Page, PageTitle, Tag } from "@/components/ui";
import { addressOptions, requireAddress } from "@/lib/address";
import { ago, money, STATUS_LABEL } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Project } from "@/lib/types";

export const metadata = { title: "Projects · Sovereign" };

export default async function ProjectsPage() {
  const session = await requireAddress();
  const { address } = session;
  const supabase = await createClient();

  const base = supabase
    .from("projects")
    .select("*, project_tasks(status), reflections(id), proposals!inner(scope, group_id)");

  const { data } =
    address.kind === "group"
      ? await base
          .eq("group_id", address.group.id)
          .order("created_at", { ascending: false })
      : await base
          .is("group_id", null)
          .eq("proposals.scope", address.scope)
          .order("created_at", { ascending: false });

  const projects = (data ?? []) as unknown as (Project & {
    project_tasks: { status: string }[];
    reflections: { id: string }[];
  })[];

  const live = projects.filter((p) => p.status !== "completed" && p.status !== "abandoned");
  const done = projects.filter((p) => p.status === "completed" || p.status === "abandoned");

  return (
    <Page>
      <PageTitle sub="What passed, and what became of it.">Projects</PageTitle>
      <CollectiveTabs />
      <ScaleSelector
        options={addressOptions(session)}
        current={
          address.kind === "group"
            ? `group:${address.group.id}`
            : `scope:${address.scope}`
        }
      />

      {live.length ? (
        <ul className="mb-10 space-y-3">
          {live.map((p) => (
            <li key={p.id}>
              <ProjectRow project={p} />
            </li>
          ))}
        </ul>
      ) : (
        <Empty>
          Nothing in progress. A project appears here automatically when a
          proposal passes.
        </Empty>
      )}

      {done.length ? (
        <>
          <h2 className="smallcaps mb-3 text-xs text-paper-faint">Finished</h2>
          <ul className="space-y-3">
            {done.map((p) => (
              <li key={p.id}>
                <ProjectRow project={p} />
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </Page>
  );
}

function ProjectRow({
  project,
}: {
  project: Project & { project_tasks: { status: string }[]; reflections: { id: string }[] };
}) {
  const total = project.project_tasks.length;
  const done = project.project_tasks.filter((t) => t.status === "done").length;
  const committed = Number(project.budget_committed);
  const spent = Number(project.budget_spent);

  return (
    <Link href={`/connection/projects/${project.proposal_id}`} className="block">
      <Card className="transition-colors hover:border-gold-dim">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-serif text-lg leading-snug text-paper">
            {project.title}
          </h3>
          <Tag
            tone={
              project.status === "completed"
                ? "calm"
                : project.status === "executing"
                  ? "gold"
                  : "neutral"
            }
          >
            {STATUS_LABEL[project.status]}
          </Tag>
        </div>

        {total ? (
          <div className="mt-3">
            <div className="h-1 overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full bg-gold"
                style={{ width: `${Math.round((done / total) * 100)}%` }}
              />
            </div>
            <p className="smallcaps mt-1.5 text-[10px] text-paper-faint">
              {done} of {total} tasks
            </p>
          </div>
        ) : null}

        <p className="smallcaps mt-2.5 flex flex-wrap gap-x-2 text-[10px] text-paper-faint">
          {committed > 0 ? (
            <>
              <span>
                {money(spent)} of {money(committed)}
              </span>
              <span>·</span>
            </>
          ) : null}
          <span>{ago(project.created_at)}</span>
          {project.reflections.length ? (
            <>
              <span>·</span>
              <span className="text-calm">reflected on</span>
            </>
          ) : null}
        </p>
      </Card>
    </Link>
  );
}
