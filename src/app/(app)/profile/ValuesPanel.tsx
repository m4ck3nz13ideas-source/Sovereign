"use client";

import { useState, useTransition } from "react";

import { Button, Field, Panel, inputClass } from "@/components/ui";
import type { ProfileValue } from "@/lib/types";

import { addValue, removeValue, reorderValue, setSharing, updateValue } from "./actions";

/**
 * Values: a list of named values, each with a short personal definition.
 * Reorderable, refinable, added to over time.
 *
 * These are not decoration. When a proposal is reviewed, it is scored against
 * these names using these definitions — the group's rubric is its own words.
 */
export function ValuesPanel({
  values,
  shared,
}: {
  values: ProfileValue[];
  shared: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [definition, setDefinition] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Panel title="Values" hint={`${values.length}`} defaultOpen={values.length === 0}>
      {values.length ? (
        <ul className="space-y-3">
          {values.map((v, i) => (
            <li key={v.id}>
              {editingId === v.id ? (
                <ValueEditor
                  value={v}
                  onDone={() => setEditingId(null)}
                />
              ) : (
                <div className="flex items-start gap-3">
                  <span className="mt-1 w-4 shrink-0 text-right text-xs tabular-nums text-paper-faint">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.95rem] text-paper">{v.name}</p>
                    {v.definition ? (
                      <p className="mt-0.5 text-sm leading-relaxed text-paper-dim">
                        {v.definition}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-sm text-paper-faint">
                        No definition yet — the reviewer will use a general one.
                      </p>
                    )}
                    <div className="mt-1.5 flex gap-3">
                      <button
                        type="button"
                        onClick={() => setEditingId(v.id)}
                        className="smallcaps text-[10px] text-paper-faint hover:text-gold"
                      >
                        Refine
                      </button>
                      {i > 0 ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            start(async () => {
                              await reorderValue(v.id, values[i - 1].position);
                              await reorderValue(values[i - 1].id, v.position);
                            })
                          }
                          className="smallcaps text-[10px] text-paper-faint hover:text-gold"
                        >
                          Up
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => start(async () => { await removeValue(v.id); })}
                        className="smallcaps text-[10px] text-paper-faint hover:text-alarm"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-relaxed text-paper-faint">
          Nothing named yet. Values here become the rubric a proposal is read
          against — so name them in your own words, with your own definitions,
          not the ones that sound right.
        </p>
      )}

      {adding ? (
        <div className="mt-5 space-y-3 border-t border-line pt-4">
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              placeholder="Honesty, Restraint, Hospitality…"
              className={inputClass}
            />
          </Field>
          <Field label="What you mean by it">
            <textarea
              value={definition}
              onChange={(e) => setDefinition(e.target.value)}
              rows={3}
              placeholder="A sentence. Your definition, not the dictionary's."
              className={`${inputClass} resize-y`}
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
                  const r = await addValue(name, definition);
                  if (!r.ok) setError(r.error);
                  else {
                    setName("");
                    setDefinition("");
                    setAdding(false);
                  }
                })
              }
            >
              {pending ? "Adding" : "Add"}
            </Button>
            <Button type="button" tone="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="smallcaps mt-5 text-[11px] text-gold hover:underline"
        >
          + Name a value
        </button>
      )}

      <ShareToggle
        field="share_values"
        shared={shared}
        label="Show these to my group"
        note="Your group can see the names and definitions. They stay hidden otherwise, including from the people you deliberate with."
      />
    </Panel>
  );
}

function ValueEditor({
  value,
  onDone,
}: {
  value: ProfileValue;
  onDone: () => void;
}) {
  const [name, setName] = useState(value.name);
  const [definition, setDefinition] = useState(value.definition ?? "");
  const [pending, start] = useTransition();

  return (
    <div className="space-y-2 rounded-md border border-gold-dim bg-ink-raised p-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={inputClass}
        aria-label="Value name"
      />
      <textarea
        value={definition}
        onChange={(e) => setDefinition(e.target.value)}
        rows={3}
        className={`${inputClass} resize-y`}
        aria-label="Definition"
      />
      <div className="flex gap-2">
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await updateValue(value.id, name, definition);
              onDone();
            })
          }
        >
          {pending ? "Saving" : "Save"}
        </Button>
        <Button type="button" tone="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function ShareToggle({
  field,
  shared,
  label,
  note,
}: {
  field: "share_values" | "share_purpose" | "share_faith";
  shared: boolean;
  label: string;
  note: string;
}) {
  const [on, setOn] = useState(shared);
  const [, start] = useTransition();

  return (
    <div className="mt-6 border-t border-line pt-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => {
            const next = e.target.checked;
            setOn(next);
            start(async () => { await setSharing(field, next); });
          }}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-gold)]"
        />
        <span>
          <span className="text-sm text-paper">{label}</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-paper-faint">
            {note}
          </span>
        </span>
      </label>
    </div>
  );
}
