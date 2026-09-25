"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, Field, inputClass } from "@/components/ui";

import { connectToConcept, discardIdea, startConcept } from "./actions";

type Mode = "idle" | "expand" | "connect";

/**
 * One idea in the inbox, with the three actions the spec names:
 * Expand (open a writing space to develop it), Connect (tag it to an existing
 * concept), Discard.
 */
export function IdeaCard({
  entry,
  when,
  concepts,
}: {
  entry: { id: string; body: string; created_at: string };
  when: string;
  concepts: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("idle");
  const [title, setTitle] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [body, setBody] = useState(entry.body);
  const [target, setTarget] = useState(concepts[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="rounded-card border border-line bg-surface-soft p-4">
      <p className="text-[0.95rem] leading-snug text-paper">{entry.body}</p>
      <p className="smallcaps mt-1.5 text-[10px] text-paper-faint">Idea · {when}</p>

      {mode === "idle" ? (
        <div className="mt-3.5 flex flex-wrap gap-2">
          <Button type="button" tone="quiet" onClick={() => setMode("expand")}>
            Expand
          </Button>
          <Button
            type="button"
            tone="quiet"
            disabled={!concepts.length}
            title={concepts.length ? undefined : "No concepts to connect to yet"}
            onClick={() => setMode("connect")}
          >
            Connect
          </Button>
          <Button
            type="button"
            tone="ghost"
            disabled={pending}
            onClick={() => start(async () => { await discardIdea(entry.id); })}
          >
            Discard
          </Button>
        </div>
      ) : null}

      {mode === "expand" ? (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <Field label="Name it">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              placeholder="A noun phrase, not a sentence"
              className={inputClass}
            />
          </Field>

          <Field label="Discipline" hint="Philosophy, History, Psychology, Theology…">
            <input
              value={discipline}
              onChange={(e) => setDiscipline(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Develop it">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className={`${inputClass} resize-y leading-relaxed`}
            />
          </Field>

          {error ? <p className="text-sm text-alarm">{error}</p> : null}

          <div className="flex gap-2">
            <Button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const r = await startConcept(entry.id, title, discipline, body);
                  if (!r.ok) setError(r.error);
                  else router.push(`/individual/ideas/${r.conceptId}`);
                })
              }
            >
              {pending ? "Starting" : "Start concept"}
            </Button>
            <Button type="button" tone="ghost" onClick={() => setMode("idle")}>
              Back
            </Button>
          </div>
        </div>
      ) : null}

      {mode === "connect" ? (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <Field label="Connect to">
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className={inputClass}
            >
              {concepts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </Field>

          {error ? <p className="text-sm text-alarm">{error}</p> : null}

          <div className="flex gap-2">
            <Button
              type="button"
              disabled={pending || !target}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const r = await connectToConcept(entry.id, target);
                  if (!r.ok) setError(r.error);
                })
              }
            >
              {pending ? "Connecting" : "Connect"}
            </Button>
            <Button type="button" tone="ghost" onClick={() => setMode("idle")}>
              Back
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
