"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Button, Field, Panel, inputClass } from "@/components/ui";
import type { ProfilePassion } from "@/lib/types";

import { addPassion, removePassion } from "./actions";

/** Passions: domains and subjects that matter most, linked to Pipeline. */
export function PassionsPanel({ passions }: { passions: ProfilePassion[] }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Panel title="Passions" hint={`${passions.length}`}>
      {passions.length ? (
        <ul className="space-y-2.5">
          {passions.map((p) => (
            <li key={p.id} className="flex items-start gap-3">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gold-dim" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[0.95rem] text-paper">{p.name}</p>
                {p.note ? (
                  <p className="mt-0.5 text-sm leading-relaxed text-paper-dim">{p.note}</p>
                ) : null}
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => start(async () => { await removePassion(p.id); })}
                className="smallcaps text-[10px] text-paper-faint hover:text-alarm"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-relaxed text-paper-faint">
          The subjects you keep returning to. They sit alongside the disciplines
          in{" "}
          <Link href="/individual/ideas" className="text-gold hover:underline">
            Pipeline
          </Link>
          .
        </p>
      )}

      {adding ? (
        <div className="mt-5 space-y-3 border-t border-line pt-4">
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className={inputClass}
            />
          </Field>
          <Field label="Why it matters" hint="Optional.">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={inputClass}
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
                  const r = await addPassion(name, note);
                  if (!r.ok) setError(r.error);
                  else {
                    setName("");
                    setNote("");
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
          + Add a passion
        </button>
      )}
    </Panel>
  );
}
