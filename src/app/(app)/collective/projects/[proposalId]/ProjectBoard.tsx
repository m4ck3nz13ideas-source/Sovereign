"use client";

import { useState, useTransition } from "react";

import { Button, Card, Empty, Field, SectionLabel, Tag, inputClass } from "@/components/ui";
import { money } from "@/lib/format";
import type { ProjectStatus, TaskStatus } from "@/lib/types";

import { addTask, claimTask, postUpdate, setTaskStatus, startProject } from "../actions";

/**
 * Tasks, money and progress — the working half of a project page.
 *
 * Money is book-keeping, not a payment rail: recording spend writes a note
 * through the treasury interface and nothing moves anywhere.
 */
export function ProjectBoard({
  projectId,
  status,
  tasks,
  updates,
  budget,
}: {
  projectId: string;
  status: ProjectStatus;
  tasks: {
    id: string;
    title: string;
    status: TaskStatus;
    assignee: string | null;
    mine: boolean;
    dueOn: string | null;
  }[];
  updates: { id: string; body: string; spend: number; author: string; when: string }[];
  budget: { committed: number; spent: number };
}) {
  const [newTask, setNewTask] = useState("");
  const [due, setDue] = useState("");
  const [note, setNote] = useState("");
  const [spend, setSpend] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const live = status !== "completed" && status !== "abandoned";
  const overspent = budget.committed > 0 && budget.spent > budget.committed;

  return (
    <div className="space-y-8">
      {status === "planning" && live ? (
        <Card className="border-gold-dim">
          <p className="text-[0.95rem] leading-relaxed text-paper">
            This has passed but not started. Break it into tasks first if that
            helps; nothing here is blocking.
          </p>
          <Button
            type="button"
            className="mt-3"
            disabled={pending}
            onClick={() => start(async () => { await startProject(projectId); })}
          >
            {pending ? "Starting" : "Mark it started"}
          </Button>
        </Card>
      ) : null}

      <div>
        <SectionLabel right={tasks.length ? `${tasks.filter((t) => t.status === "done").length}/${tasks.length}` : undefined}>
          Tasks
        </SectionLabel>

        {tasks.length ? (
          <ul className="space-y-2">
            {tasks.map((task) => (
              <li
                key={task.id}
                className="flex items-start gap-3 rounded-card border border-line bg-surface-soft px-4 py-3"
              >
                <button
                  type="button"
                  disabled={pending || !live}
                  aria-label={task.status === "done" ? "Mark as not done" : "Mark as done"}
                  onClick={() =>
                    start(async () => {
                      await setTaskStatus(
                        task.id,
                        task.status === "done" ? "todo" : "done",
                        projectId,
                      );
                    })
                  }
                  className={`mt-0.5 h-4 w-4 shrink-0 rounded border transition-colors ${
                    task.status === "done"
                      ? "border-gold bg-gold"
                      : "border-line hover:border-gold-dim"
                  }`}
                />

                <div className="min-w-0 flex-1">
                  <p
                    className={`text-[0.95rem] leading-snug ${
                      task.status === "done" ? "text-paper-faint line-through" : "text-paper"
                    }`}
                  >
                    {task.title}
                  </p>
                  <p className="smallcaps mt-1 flex flex-wrap gap-x-2 text-[10px] text-paper-faint">
                    {task.assignee ? (
                      <span>{task.mine ? "you" : task.assignee}</span>
                    ) : live ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => start(async () => { await claimTask(task.id, projectId); })}
                        className="text-gold hover:underline"
                      >
                        take it
                      </button>
                    ) : (
                      <span>unclaimed</span>
                    )}
                    {task.dueOn ? (
                      <>
                        <span>·</span>
                        <span>{task.dueOn}</span>
                      </>
                    ) : null}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No tasks yet.</Empty>
        )}

        {live ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="Something someone has to do"
              className={`${inputClass} flex-1 min-w-[12rem]`}
            />
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className={`${inputClass} w-auto`}
            />
            <Button
              type="button"
              tone="quiet"
              disabled={pending || !newTask.trim()}
              onClick={() =>
                start(async () => {
                  const r = await addTask(projectId, newTask, due);
                  if (r.ok) {
                    setNewTask("");
                    setDue("");
                  }
                })
              }
            >
              Add
            </Button>
          </div>
        ) : null}
      </div>

      {budget.committed > 0 ? (
        <div>
          <SectionLabel right={overspent ? <span className="text-alarm">over</span> : undefined}>
            Money
          </SectionLabel>
          <Card className={overspent ? "border-alarm/40" : ""}>
            <div className="flex items-baseline justify-between">
              <span className="text-[0.95rem] text-paper">{money(budget.spent)}</span>
              <span className="text-sm text-paper-faint">
                of {money(budget.committed)}
              </span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface">
              <div
                className={`h-full rounded-full ${overspent ? "bg-alarm" : "bg-gold"}`}
                style={{
                  width: `${Math.min(100, Math.round((budget.spent / budget.committed) * 100))}%`,
                }}
              />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-paper-faint">
              A record of what the group committed and what it spent. Nothing is
              moved and nothing is held — Sovereign is not a payment rail.
            </p>
          </Card>
        </div>
      ) : null}

      <div>
        <SectionLabel>Progress</SectionLabel>

        {updates.length ? (
          <ul className="space-y-2">
            {updates.map((u) => (
              <li
                key={u.id}
                className="rounded-card border border-line bg-surface-soft px-4 py-3"
              >
                <p className="whitespace-pre-wrap text-[0.95rem] leading-relaxed text-paper">
                  {u.body}
                </p>
                <p className="smallcaps mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-paper-faint">
                  <span>{u.author}</span>
                  <span>·</span>
                  <span>{u.when}</span>
                  {u.spend !== 0 ? <Tag tone="gold">{money(u.spend)}</Tag> : null}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Nothing recorded yet.</Empty>
        )}

        {live ? (
          <div className="mt-3 space-y-3">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="What moved, what got stuck."
              className={`${inputClass} resize-y leading-relaxed`}
            />
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-32">
                <Field label="Spend">
                  <input
                    value={spend}
                    onChange={(e) => setSpend(e.target.value)}
                    inputMode="decimal"
                    placeholder="0"
                    className={inputClass}
                  />
                </Field>
              </div>
              <Button
                type="button"
                tone="quiet"
                disabled={pending || !note.trim()}
                onClick={() =>
                  start(async () => {
                    setError(null);
                    const r = await postUpdate(projectId, note, spend);
                    if (!r.ok) setError(r.error);
                    else {
                      setNote("");
                      setSpend("");
                    }
                  })
                }
              >
                {pending ? "Recording" : "Record"}
              </Button>
            </div>
            {error ? <p className="text-sm text-alarm">{error}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
