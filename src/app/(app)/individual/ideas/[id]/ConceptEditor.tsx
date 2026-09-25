"use client";

import { useState, useTransition } from "react";

import { Button, Field, inputClass } from "@/components/ui";
import type { Concept, ConceptStatus } from "@/lib/types";

import { saveConcept } from "../actions";

const STATUSES: ConceptStatus[] = ["seed", "developing", "named", "dormant"];

export function ConceptEditor({ concept }: { concept: Concept }) {
  const [title, setTitle] = useState(concept.title);
  const [discipline, setDiscipline] = useState(concept.discipline ?? "");
  const [body, setBody] = useState(concept.body);
  const [status, setStatus] = useState<ConceptStatus>(concept.status);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const dirty =
    title !== concept.title ||
    discipline !== (concept.discipline ?? "") ||
    body !== concept.body ||
    status !== concept.status;

  function save() {
    start(async () => {
      setError(null);
      const r = await saveConcept(concept.id, { title, discipline, body, status });
      if (!r.ok) setError(r.error);
      else {
        setSaved(true);
        window.setTimeout(() => setSaved(false), 2000);
      }
    });
  }

  /** Download this concept as markdown, ready to drop into a vault. */
  function exportMarkdown() {
    const front = [
      "---",
      `title: ${title}`,
      discipline ? `discipline: ${discipline}` : null,
      `status: ${status}`,
      `exported: ${new Date().toISOString().slice(0, 10)}`,
      "---",
      "",
    ]
      .filter((l) => l !== null)
      .join("\n");

    const blob = new Blob([`${front}# ${title}\n\n${body}\n`], {
      type: "text/markdown",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^\w\s-]/g, "").trim() || "concept"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full bg-transparent font-serif text-[1.75rem] leading-tight text-paper focus:outline-none"
        aria-label="Title"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Discipline">
          <input
            value={discipline}
            onChange={(e) => setDiscipline(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ConceptStatus)}
            className={inputClass}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="The note">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={18}
          className={`${inputClass} resize-y leading-relaxed`}
          placeholder="Markdown. Whatever this concept is becoming."
        />
      </Field>

      {error ? <p className="text-sm text-alarm">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={save} disabled={pending || !dirty}>
          {pending ? "Saving" : saved ? "Saved" : "Save"}
        </Button>
        <Button type="button" tone="quiet" onClick={exportMarkdown}>
          Export .md
        </Button>
      </div>
    </div>
  );
}
