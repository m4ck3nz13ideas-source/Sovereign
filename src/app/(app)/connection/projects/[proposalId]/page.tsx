import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, Empty, Page, Prose, SectionLabel, Tag } from "@/components/ui";
import { ago, money, shortDate, STATUS_LABEL } from "@/lib/format";
import { requireGroup } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type {
  Decision,
  Project,
  ProjectTask,
  ProjectUpdate,
  Proposal,
  Reflection,
} from "@/lib/types";

import { ProjectBoard } from "./ProjectBoard";
import { ReflectionPanel } from "./ReflectionPanel";

/**
 * A project page, using the same five layers as the review screen so the shape
 * of a thing does not change when it stops being a proposal and starts being
 * work:
 *
 *   HEADER   what this is and where it stands
 *   CONTEXT  what was proposed, and what was decided
 *   AI LAYER the reflection's reading, once there is a reflection
 *   HUMAN    tasks, money, progress notes
 *   OUTCOME  what actually happened
 *
 * Keyed by proposal id, because that is the identity a member already has in
 * hand — the project is downstream of the decision, not a separate thing.
 */
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ proposalId: string }>;
}) {
  const { proposalId } = await params;
  const { userId, group } = await requireGroup();
  const supabase = await createClient();

  const { data: projectRow } = await supabase
    .from("projects")
    .select("*")
    .eq("proposal_id", proposalId)
    .maybeSingle();

  if (!projectRow) notFound();
  const project = projectRow as Project;

  const [
    { data: proposalRow },
    { data: decisionRow },
    { data: taskRows },
    { data: updateRows },
    { data: reflectionRow },
  ] = await Promise.all([
    supabase.from("proposals").select("*").eq("id", proposalId).single(),
    supabase.from("decisions").select("*").eq("proposal_id", proposalId).maybeSingle(),
    supabase
      .from("project_tasks")
      .select("*, profiles:assignee_id(display_name)")
      .eq("project_id", project.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("project_updates")
      .select("*, profiles(display_name)")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("reflections")
      .select("*, profiles:created_by(display_name)")
      .eq("project_id", project.id)
      .maybeSingle(),
  ]);

  const proposal = proposalRow as Proposal;
  const decision = decisionRow as Decision | null;
  const tasks = (taskRows ?? []) as unknown as (ProjectTask & {
    profiles: { display_name: string } | null;
  })[];
  const updates = (updateRows ?? []) as unknown as (ProjectUpdate & {
    profiles: { display_name: string } | null;
  })[];
  const reflection = reflectionRow as (Reflection & {
    profiles: { display_name: string } | null;
  }) | null;

  const committed = Number(project.budget_committed);
  const spent = Number(project.budget_spent);

  return (
    <Page>
      <Link
        href="/connection/projects"
        className="smallcaps mb-6 inline-block text-[11px] text-paper-faint hover:text-gold"
      >
        ← Projects
      </Link>

      {/* ---------------------------------------------------------- HEADER */}
      <header className="mb-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
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
          {committed > 0 ? (
            <Tag tone={spent > committed ? "alarm" : "neutral"}>
              {money(spent)} of {money(committed)}
            </Tag>
          ) : null}
        </div>

        <h1 className="font-serif text-[1.75rem] leading-tight text-paper">
          {project.title}
        </h1>

        <p className="smallcaps mt-3 flex flex-wrap gap-x-2 text-[10px] text-paper-faint">
          <span>
            passed {decision ? shortDate(decision.decided_at) : ago(project.created_at)}
          </span>
          <span>·</span>
          <Link href={`/connection/proposals/${proposalId}`} className="hover:text-gold">
            the proposal
          </Link>
        </p>
      </header>

      {/* --------------------------------------------------------- CONTEXT */}
      <section className="mb-10">
        <SectionLabel>What was decided</SectionLabel>
        <Card>
          <p className="text-[0.95rem] leading-relaxed text-paper">
            {project.expected_outcome ?? proposal.summary}
          </p>
          {decision?.rationale_summary ? (
            <p className="mt-3 border-t border-line pt-3 text-sm leading-relaxed text-paper-dim">
              {decision.rationale_summary}
            </p>
          ) : null}
        </Card>
      </section>

      {/* ----------------------------------------------------- HUMAN LAYER */}
      <section className="mb-10">
        <ProjectBoard
          projectId={project.id}
          status={project.status}
          tasks={tasks.map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            assignee: t.profiles?.display_name ?? null,
            mine: t.assignee_id === userId,
            dueOn: t.due_on,
          }))}
          updates={updates.map((u) => ({
            id: u.id,
            body: u.body,
            spend: Number(u.spend_delta),
            author: u.profiles?.display_name ?? "A member",
            when: ago(u.created_at),
          }))}
          budget={{ committed, spent }}
        />
      </section>

      {/* --------------------------------------------------------- OUTCOME */}
      <section>
        <SectionLabel>What actually happened</SectionLabel>

        {reflection ? (
          <Card className="border-calm/30">
            <Prose>{reflection.actual_outcome}</Prose>

            {reflection.assumption_wrong ? (
              <div className="mt-4 border-t border-line pt-4">
                <h3 className="smallcaps mb-1.5 text-[11px] text-alarm">
                  What we had wrong
                </h3>
                <p className="text-sm leading-relaxed text-paper-dim">
                  {reflection.assumption_wrong}
                </p>
              </div>
            ) : null}

            {reflection.lesson ? (
              <div className="mt-4 border-t border-line pt-4">
                <h3 className="smallcaps mb-1.5 text-[11px] text-paper-faint">
                  The lesson, for next time
                </h3>
                <p className="text-sm leading-relaxed text-paper">{reflection.lesson}</p>
                <p className="mt-2 text-xs leading-relaxed text-paper-faint">
                  This is read by the review layer when a proposal touching the
                  same values arrives. It is the only way this group gets better
                  at deciding.
                </p>
              </div>
            ) : null}

            <p className="smallcaps mt-4 text-[10px] text-paper-faint">
              {reflection.profiles?.display_name ?? "a member"} ·{" "}
              {shortDate(reflection.created_at)}
            </p>
          </Card>
        ) : project.status === "completed" ? (
          <Empty>No reflection on file.</Empty>
        ) : (
          <ReflectionPanel projectId={project.id} expected={project.expected_outcome} />
        )}
      </section>

      <p className="smallcaps mt-10 text-[10px] text-paper-faint">{group.name}</p>
    </Page>
  );
}
