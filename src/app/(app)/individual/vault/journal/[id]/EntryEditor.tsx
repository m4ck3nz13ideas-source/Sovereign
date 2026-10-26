"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui";

import { deleteJournal, updateJournal } from "../actions";
import { FilingEditor } from "../FilingEditor";

export function EntryEditor({
  id,
  body,
  folder,
  labels,
}: {
  id: string;
  body: string;
  folder: string | null;
  labels: string[];
}) {
  const router = useRouter();
  const [text, setText] = useState(body);
  const [filing, setFiling] = useState({ folder, labels });
  const [touched, setTouched] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const changed = text.trim() !== body.trim() || touched;

  function save() {
    setError(null);
    start(async () => {
      const r = await updateJournal(id, { body: text, ...filing, filingTouched: touched });
      if (!r.ok) return setError(r.error);
      setFiling({ folder: r.folder, labels: r.labels });
      setTouched(false);
      setNote("Saved");
      router.refresh();
    });
  }

  function remove() {
    start(async () => {
      const r = await deleteJournal(id);
      if (!r.ok) return setError(r.error);
      router.push("/individual/vault/journal");
    });
  }

  return (
    <div className="mt-3 space-y-6">
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setNote(null);
        }}
        rows={Math.min(18, Math.max(6, Math.ceil(text.length / 45)))}
        aria-label="Entry"
        className="w-full resize-y rounded-card border border-line bg-surface-soft p-4 text-[1rem] leading-relaxed text-paper focus:border-gold focus:outline-none"
      />

      <FilingEditor
        folder={filing.folder}
        labels={filing.labels}
        onChange={(next) => {
          setFiling(next);
          setTouched(true);
          setNote(null);
        }}
      />

      {error ? <p className="text-sm text-alarm">{error}</p> : null}

      <div className="flex items-center gap-3">
        <Button type="button" onClick={save} disabled={!changed || pending}>
          {pending ? "Saving" : "Save"}
        </Button>
        {note ? <span className="text-sm text-paper-faint">{note}</span> : null}
        <div className="ml-auto">
          {confirming ? (
            <span className="flex items-center gap-2 text-sm">
              <span className="text-paper-dim">Delete for good?</span>
              <Button type="button" tone="danger" onClick={remove} disabled={pending} className="min-h-9 px-3 py-1">
                Delete
              </Button>
              <Button type="button" tone="ghost" onClick={() => setConfirming(false)} className="min-h-9 px-2 py-1">
                Keep
              </Button>
            </span>
          ) : (
            <Button type="button" tone="ghost" onClick={() => setConfirming(true)} className="min-h-9 px-2 py-1">
              Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
