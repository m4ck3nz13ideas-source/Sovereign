"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, Field, inputClass } from "@/components/ui";
import {
  WHO_LABEL,
  charterChangeLines,
  diffCharter,
  packChange,
  type Charter,
  type Who,
} from "@/lib/charters";

import { renameGroup, saveCharter } from "../../actions";

/**
 * Change the charter. Founding (fewer than three members) and a steward:
 * it saves directly. Otherwise the same form becomes a proposal — the
 * change, in words, is carried to the composer and written into the
 * proposal's body, where the law audit and every member read it.
 */
export function CharterEditor({
  groupId,
  charter,
  direct,
}: {
  groupId: string;
  charter: Charter;
  /** Stewards of a founding group write it directly. */
  direct: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [purpose, setPurpose] = useState(charter.purpose);
  const [goal, setGoal] = useState(charter.goal);
  const [values, setValues] = useState(charter.group_values.join(", "));
  const [inviters, setInviters] = useState<Who>(charter.inviters);
  const [proposers, setProposers] = useState<Who>(charter.proposers);
  const [aiContext, setAiContext] = useState(charter.ai_context);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <Button type="button" tone="quiet" className="w-full" onClick={() => setOpen(true)}>
        {direct ? "Edit the charter" : "Propose a change"}
      </Button>
    );
  }

  const next: Charter = {
    purpose,
    goal,
    group_values: values.split(",").map((v) => v.trim()).filter(Boolean),
    inviters,
    proposers,
    ai_context: aiContext,
  };
  const change = diffCharter(charter, next);
  const lines = charterChangeLines(charter, change);

  return (
    <div className="space-y-4">
      <Field label="What it is for">
        <textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={2} className={inputClass} />
      </Field>
      <Field label="What it is trying to do">
        <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={2} className={inputClass} />
      </Field>
      <Field label="Its values" hint="Comma-separated, up to twelve.">
        <input value={values} onChange={(e) => setValues(e.target.value)} className={inputClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Who can invite">
          <select value={inviters} onChange={(e) => setInviters(e.target.value as Who)} className={inputClass}>
            {(["stewards", "members"] as Who[]).map((w) => (
              <option key={w} value={w}>
                {WHO_LABEL[w]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Who can propose">
          <select value={proposers} onChange={(e) => setProposers(e.target.value as Who)} className={inputClass}>
            {(["members", "stewards"] as Who[]).map((w) => (
              <option key={w} value={w}>
                {WHO_LABEL[w]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="What the AI should weigh" hint="Read when it sets each proposal's conditions.">
        <textarea value={aiContext} onChange={(e) => setAiContext(e.target.value)} rows={3} className={inputClass} />
      </Field>

      {lines.length ? (
        <ul className="space-y-1 rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-paper-dim">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      ) : (
        <p className="text-center text-sm text-paper-faint">Nothing changed yet.</p>
      )}

      {error ? <p className="text-sm text-alarm">{error}</p> : null}

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          disabled={pending || !lines.length}
          onClick={() =>
            start(async () => {
              setError(null);
              if (direct) {
                const r = await saveCharter(groupId, change);
                if (!r.ok) setError(r.error);
                else {
                  setOpen(false);
                  router.refresh();
                }
              } else {
                router.push(`/connection/g/${groupId}/charter?c=${packChange(change)}`);
              }
            })
          }
        >
          {direct ? (pending ? "Saving" : "Save") : "Write it up as a proposal"}
        </Button>
        <Button type="button" tone="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** A steward renames the group. A name is not part of the charter. */
export function RenameGroup({ groupId, name }: { groupId: string; name: string }) {
  const router = useRouter();
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <Field label="Name">
        <input value={value} onChange={(e) => setValue(e.target.value)} className={inputClass} />
      </Field>
      {error ? <p className="text-sm text-alarm">{error}</p> : null}
      <Button
        type="button"
        tone="quiet"
        disabled={pending || !value.trim() || value.trim() === name}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await renameGroup(groupId, value);
            if (!r.ok) setError(r.error);
            else router.refresh();
          })
        }
      >
        {pending ? "Saving" : "Rename"}
      </Button>
    </div>
  );
}
