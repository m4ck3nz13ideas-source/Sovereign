"use client";

import { useState, useTransition } from "react";

import { Button, Field, inputClass } from "@/components/ui";

import { saveGroupAbout } from "../actions";

/** For stewards: the group's purpose, goal and values. */
export function AboutEditor({
  groupId,
  purpose,
  goal,
  values,
}: {
  groupId: string;
  purpose: string;
  goal: string;
  values: string[];
}) {
  const [open, setOpen] = useState(false);
  const [p, setP] = useState(purpose);
  const [g, setG] = useState(goal);
  const [v, setV] = useState(values.join(", "));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <div className="text-center">
        <button type="button" onClick={() => setOpen(true)} className="smallcaps text-[11px] text-gold">
          edit the rundown
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-card border border-line bg-surface-soft p-4">
      <Field label="What it is for">
        <textarea className={`${inputClass} min-h-20`} value={p} maxLength={1000} onChange={(e) => setP(e.target.value)} />
      </Field>
      <Field label="What it is trying to do">
        <textarea className={`${inputClass} min-h-20`} value={g} maxLength={600} onChange={(e) => setG(e.target.value)} />
      </Field>
      <Field label="Its values" hint="Up to twelve, separated by commas.">
        <input className={inputClass} value={v} maxLength={600} onChange={(e) => setV(e.target.value)} />
      </Field>
      {error ? <p className="text-sm text-alarm">{error}</p> : null}
      <div className="flex justify-center gap-2">
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await saveGroupAbout(groupId, { purpose: p, goal: g, values: v.split(",") });
              if (!r.ok) setError(r.error);
              else setOpen(false);
            })
          }
        >
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" tone="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
