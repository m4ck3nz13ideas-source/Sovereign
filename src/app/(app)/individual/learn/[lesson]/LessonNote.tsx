"use client";

import { useState, useTransition } from "react";

import { inputClass } from "@/components/ui";

import { saveLesson } from "../actions";

/** Your answer to the lesson's question, and finishing it. Private (0044). */
export function LessonNote({ id, initial, done }: { id: string; initial: string; done: boolean }) {
  const [text, setText] = useState(initial);
  const [finished, setFinished] = useState(done);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save(markDone: boolean) {
    setError(null);
    setSaved(false);
    start(async () => {
      const r = await saveLesson(id, text, markDone);
      if (!r.ok) return setError(r.error);
      setFinished(markDone);
      setSaved(true);
    });
  }

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
        rows={5}
        maxLength={2000}
        placeholder="What's true for you"
        className={inputClass}
      />
      <div className="mt-3 flex items-center gap-3">
        {finished ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => save(true)}
              className="press rounded-lg border border-line px-4 py-2 text-sm text-paper"
            >
              Save
            </button>
            <button type="button" disabled={pending} onClick={() => save(false)} className="press text-sm text-paper-faint">
              Mark not done
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => save(true)}
            className="press rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-ink"
          >
            Done
          </button>
        )}
        {saved ? <span className="text-xs text-paper-faint">Saved.</span> : null}
        {finished && !saved ? <span className="text-xs text-gold">✓ Finished</span> : null}
      </div>
      {error ? <p className="mt-2 text-xs text-alarm">{error}</p> : null}
    </div>
  );
}
