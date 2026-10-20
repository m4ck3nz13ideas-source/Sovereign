import Link from "next/link";

import { ScaleSelector } from "@/components/nav/ScaleSelector";
import { Card, Empty, Page, ScreenHead, SectionLabel, Tag } from "@/components/ui";
import { addressOptions, requireAddress } from "@/lib/address";
import { ago, money, shortDate, STATUS_LABEL } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type {
  ContributionRecord,
  DueProjection,
  ForecastRecord,
  Project,
  Reflection,
} from "@/lib/types";

import { DueList } from "./DueList";
import { LedgerCheck } from "./LedgerCheck";

export const metadata = { title: "Projects · Sovereign" };

/**
 * Projects, with their impact on the same screen (Mackenzie, 20 October).
 *
 * Impact used to be its own tab. It is the result of the projects, so it now
 * sits at the top of them as a picture: how many finished, how much of the
 * money committed has been spent, and how the predictions made before each
 * decision actually went. Anything waiting to be marked comes straight after,
 * because that is the step that normally never happens. The longer record —
 * learnings, what the group was wrong about, your contribution, the ledger
 * check — folds away below the list.
 *
 * Everything in the impact half is derived: nothing on it can be edited,
 * because a record you can edit is not a record.
 */
type Row = Project & { project_tasks: { status: string }[]; reflections: { id: string }[] };

export default async function ProjectsPage() {
  const session = await requireAddress();
  const { userId, address } = session;
  const supabase = await createClient();

  const base = supabase
    .from("projects")
    .select("*, project_tasks(status), reflections(id), proposals!inner(scope, group_id)");

  const [
    { data },
    { data: reflectionRows },
    { data: record },
    { data: dueRows },
    { data: forecastRows },
  ] = await Promise.all([
    address.kind === "group"
      ? base.eq("group_id", address.group.id).order("created_at", { ascending: false })
      : base
          .is("group_id", null)
          .eq("proposals.scope", address.scope)
          .order("created_at", { ascending: false }),
    supabase
      .from("reflections")
      .select("*, projects!inner(title, proposal_id, group_id, proposals!inner(scope))")
      .order("created_at", { ascending: false })
      .limit(30),
    // The contribution record is a group question. At place scale there is no
    // single circle to have a record within, and inventing one would be a
    // reputation score by another name.
    address.kind === "group"
      ? supabase.rpc("contribution_record", { p_profile_id: userId, p_group_id: address.group.id })
      : Promise.resolve({ data: null }),
    supabase.rpc("due_projections", {
      p_group_id: address.kind === "group" ? address.group.id : null,
      p_scope: address.kind === "place" ? address.scope : null,
      p_limit: 20,
    }),
    supabase.rpc("forecast_record", {
      p_scope: address.kind === "place" ? address.scope : null,
      p_place: address.kind === "place" ? address.place : null,
      p_group_id: address.kind === "group" ? address.group.id : null,
    }),
  ]);

  const projects = (data ?? []) as unknown as Row[];
  const live = projects.filter((p) => p.status !== "completed" && p.status !== "abandoned");
  const done = projects.filter((p) => p.status === "completed" || p.status === "abandoned");

  const reflections = (reflectionRows ?? []).filter((r) => {
    const p = r.projects as unknown as
      | { group_id: string | null; proposals: { scope: string } | null }
      | null;
    if (!p) return false;
    return address.kind === "group"
      ? p.group_id === address.group.id
      : p.group_id === null && p.proposals?.scope === address.scope;
  }) as unknown as (Reflection & { projects: { title: string; proposal_id: string } | null })[];

  const mine = (Array.isArray(record) ? record[0] : record) as ContributionRecord | undefined;
  const due = (dueRows ?? []) as DueProjection[];
  const forecast = (forecastRows ?? []) as ForecastRecord[];
  const lessons = reflections.filter((r) => r.lesson);
  const wrong = reflections.filter((r) => r.assumption_wrong);

  return (
    <Page>
      <ScreenHead sub={address.label}>Projects</ScreenHead>
      <ScaleSelector
        options={addressOptions(session)}
        current={address.kind === "group" ? `group:${address.group.id}` : `scope:${address.scope}`}
      />

      {/* ------------------------------------------------------------ IMPACT */}
      <section id="impact" className="mb-8 mt-4 scroll-mt-32">
        <ImpactVisual projects={projects} forecast={forecast} />
      </section>

      {due.length ? (
        <section className="mb-10">
          <SectionLabel right={`${due.length}`}>Waiting to be marked</SectionLabel>
          <p className="mb-3 text-[0.8125rem] leading-relaxed text-paper-faint">
            Predicted before the decision, and the date has passed. Say how each
            went. A project cannot be completed while one of its own predictions
            is sitting here.
          </p>
          <DueList items={due} />
        </section>
      ) : null}

      {/* ---------------------------------------------------------- PROJECTS */}
      <SectionLabel>In progress</SectionLabel>
      {live.length ? (
        <ul className="mb-10 space-y-3">
          {live.map((p) => (
            <li key={p.id}>
              <ProjectRow project={p} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mb-10">
          <Empty>Nothing in progress. A project appears here automatically when a proposal passes.</Empty>
        </div>
      )}

      {done.length ? (
        <>
          <SectionLabel>Finished</SectionLabel>
          <ul className="mb-10 space-y-3">
            {done.map((p) => (
              <li key={p.id}>
                <ProjectRow project={p} />
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {/* ------------------------------------------------------- THE RECORD */}
      <details className="group rounded-card border border-line bg-surface-soft">
        <summary className="press flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5">
          <span className="text-[0.95rem] text-paper">Learnings and the record</span>
          <span className="smallcaps text-[10px] text-paper-faint">
            {lessons.length} learned · {wrong.length} wrong about
            <span className="ml-2 inline-block transition-transform group-open:rotate-180">▾</span>
          </span>
        </summary>

        <div className="space-y-10 border-t border-line px-4 pb-5 pt-5">
          <section>
            <SectionLabel>Learnings</SectionLabel>
            {lessons.length ? (
              <ul className="space-y-3">
                {lessons.map((r) => (
                  <li key={r.id}>
                    <Card>
                      <p className="text-[0.95rem] leading-relaxed text-paper">{r.lesson}</p>
                      {r.projects ? (
                        <Link
                          href={`/collective/projects/${r.projects.proposal_id}`}
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
              <Empty>Nothing learned on the record yet. A lesson lands here when a project is completed with a reflection.</Empty>
            )}
          </section>

          {wrong.length ? (
            <section>
              <SectionLabel right={`${wrong.length}`}>What this group has been wrong about</SectionLabel>
              <ul className="space-y-3">
                {wrong.map((r) => (
                  <li key={r.id}>
                    <Card className="border-alarm/30">
                      <p className="text-[0.95rem] leading-relaxed text-paper-dim">{r.assumption_wrong}</p>
                      {r.projects ? (
                        <p className="smallcaps mt-2 text-[10px] text-paper-faint">{r.projects.title}</p>
                      ) : null}
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <SectionLabel>Your contribution</SectionLabel>
            {mine ? (
              <Card>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5 text-sm">
                  <Count label="Proposals written" value={mine.proposals_authored} />
                  <Count label="Of those, passed" value={mine.proposals_passed} />
                  <Count label="Resonance recorded" value={mine.resonance_recorded} />
                  <Count label="Said something" value={mine.comments_written} />
                  <Count label="Tasks finished" value={mine.tasks_completed} />
                  <Count label="Reflections written" value={mine.reflections_written} />
                </dl>
                <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-paper-faint">
                  A record of what you did, not a score. Nothing here is ranked,
                  compared, or weighted into anyone&rsquo;s influence.
                </p>
              </Card>
            ) : (
              <Empty>Nothing recorded yet.</Empty>
            )}
          </section>

          <section>
            <SectionLabel>The record itself</SectionLabel>
            <LedgerCheck groupId={address.kind === "group" ? address.group.id : null} />
          </section>
        </div>
      </details>
    </Page>
  );
}

/**
 * The picture of impact: three bars, read top to bottom.
 *
 *   Projects     finished / running / stopped, as one bar
 *   Money        spent against committed
 *   Predictions  how often each kind held, with a tick where it said it would
 *
 * The prediction tick is the point of that row: a bar that reaches the tick is
 * well calibrated, one that falls short was overconfident. Nobody is named.
 */
function ImpactVisual({ projects, forecast }: { projects: Row[]; forecast: ForecastRecord[] }) {
  const finished = projects.filter((p) => p.status === "completed").length;
  const stopped = projects.filter((p) => p.status === "abandoned").length;
  const running = projects.length - finished - stopped;
  const committed = projects.reduce((n, p) => n + Number(p.budget_committed), 0);
  const spent = projects.reduce((n, p) => n + Number(p.budget_spent), 0);
  const pct = (a: number, b: number) => (b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0);
  const settled = forecast.filter((f) => f.hit_rate !== null);

  return (
    <Card>
      <p className="smallcaps mb-4 text-center text-[10px] text-gold">Impact</p>

      {/* Projects */}
      <div>
        <div className="flex items-baseline justify-between">
          <span className="text-[0.875rem] text-paper">Projects</span>
          <span className="font-serif text-xl text-paper">{projects.length}</span>
        </div>
        <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-surface" aria-hidden>
          <div className="h-full bg-calm" style={{ width: `${pct(finished, projects.length)}%` }} />
          <div className="h-full bg-gold" style={{ width: `${pct(running, projects.length)}%` }} />
          <div className="h-full bg-paper-faint/40" style={{ width: `${pct(stopped, projects.length)}%` }} />
        </div>
        <p className="smallcaps mt-1.5 flex flex-wrap gap-x-3 text-[10px] text-paper-faint">
          <Key className="bg-calm">{finished} finished</Key>
          <Key className="bg-gold">{running} running</Key>
          {stopped ? <Key className="bg-paper-faint/40">{stopped} stopped</Key> : null}
        </p>
      </div>

      {/* Money */}
      <div className="mt-5">
        <div className="flex items-baseline justify-between">
          <span className="text-[0.875rem] text-paper">Money</span>
          <span className="text-[0.8125rem] tabular-nums text-paper-dim">
            {money(spent)} <span className="text-paper-faint">of {money(committed)}</span>
          </span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface" aria-hidden>
          <div
            className={`h-full rounded-full ${spent > committed ? "bg-alarm" : "bg-gold"}`}
            style={{ width: `${committed > 0 ? pct(spent, committed) : 0}%` }}
          />
        </div>
        <p className="smallcaps mt-1.5 text-[10px] text-paper-faint">
          {committed > 0 ? `${pct(spent, committed)}% of what was committed has been spent` : "Nothing committed yet"}
        </p>
      </div>

      {/* Predictions */}
      <div className="mt-5">
        <span className="text-[0.875rem] text-paper">Predictions</span>
        {settled.length ? (
          <div className="mt-2 space-y-3">
            {settled.map((f) => {
              const hit = Math.round((f.hit_rate ?? 0) * 100);
              const said = f.mean_confidence !== null ? Math.round(f.mean_confidence * 100) : null;
              return (
                <div key={f.source}>
                  <div className="flex items-baseline justify-between text-[0.8125rem]">
                    <span className="text-paper-dim">{f.source === "ai" ? "By the AI" : "By people"}</span>
                    <span className="tabular-nums text-paper">{hit}% held</span>
                  </div>
                  <div className="relative mt-1.5 h-2.5 rounded-full bg-surface" aria-hidden>
                    <div className="h-full rounded-full bg-calm" style={{ width: `${hit}%` }} />
                    {said !== null ? (
                      <div
                        className="absolute -top-1 h-[1.125rem] w-0.5 rounded bg-paper"
                        style={{ left: `calc(${said}% - 1px)` }}
                        title={`Said ${said}% on average`}
                      />
                    ) : null}
                  </div>
                  <p className="smallcaps mt-1 text-[10px] text-paper-faint">
                    {f.held} held · {f.missed} missed{f.unclear ? ` · ${f.unclear} unclear` : ""}
                    {said !== null ? ` · tick = how sure they said they were (${said}%)` : ""}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="smallcaps mt-1.5 text-[10px] text-paper-faint">None marked yet</p>
        )}
      </div>
    </Card>
  );
}

function Key({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${className}`} aria-hidden />
      {children}
    </span>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <>
      <dt className="text-paper-dim">{label}</dt>
      <dd className="text-right tabular-nums text-paper">{value}</dd>
    </>
  );
}

function ProjectRow({ project }: { project: Row }) {
  const total = project.project_tasks.length;
  const done = project.project_tasks.filter((t) => t.status === "done").length;
  const committed = Number(project.budget_committed);
  const spent = Number(project.budget_spent);

  return (
    <Link href={`/collective/projects/${project.proposal_id}`} className="block">
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
