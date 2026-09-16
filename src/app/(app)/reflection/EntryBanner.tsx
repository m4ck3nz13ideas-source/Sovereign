"use client";

import { useState, useTransition } from "react";

import { Button, inputClass } from "@/components/ui";

import { expandEntry, fileEntry } from "./actions";

/**
 * An unexamined banner.
 *
 * The copy is the point: "From three days ago: '…'. Ready to sit with this?"
 * It must read as a gentle pull, not a task. There is no badge, no counter on
 * the row, and no way to mark it done without opening it.
 */
export function EntryBanner({
  id,
  preview,
  body,
  when,
}: {
  id: string;
  preview: string;
  body: string;
  when: string;
}) {
  const [open, setOpen] = useState(false);
  const [expanding, setExpanding] = useState(false);
  const [draft, setDraft] = useState(body);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full rounded-card border border-line bg-surface-soft px-4 py-3.5 text-left transition-colors hover:border-gold-dim"
      >
        <div className="flex items-start gap-3">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" aria-hidden />
          <div className="min-w-0">
            <p className="text-[0.95rem] leading-snug text-paper">
              <span className="text-paper-faint">From {when}: </span>
              &ldquo;{preview}&rdquo;
            </p>
            <p className="smallcaps mt-1.5 text-[10px] text-paper-faint">
              Journal · ready to sit with this?
            </p>
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="animate-settle-in rounded-card border border-gold-dim bg-surface-soft p-4">
      <p className="smallcaps mb-3 text-[10px] text-paper-faint">
        Journal · {when}
      </p>

      {expanding ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={10}
          autoFocus
          className={`${inputClass} resize-y leading-relaxed`}
        />
      ) : (
        <p className="whitespace-pre-wrap text-[0.95rem] leading-relaxed text-paper-dim">
          {body}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {expanding ? (
          <>
            <Button
              type="button"
              disabled={pending}
              onClick={() => start(async () => { await expandEntry(id, draft); })}
            >
              {pending ? "Saving" : "Save and file"}
            </Button>
            <Button type="button" tone="ghost" onClick={() => setExpanding(false)}>
              Back
            </Button>
          </>
        ) : (
          <>
            <Button type="button" tone="quiet" onClick={() => setExpanding(true)}>
              Expand
            </Button>
            <Button
              type="button"
              tone="ghost"
              disabled={pending}
              onClick={() => start(async () => { await fileEntry(id); })}
            >
              {pending ? "Filing" : "File"}
            </Button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="smallcaps ml-auto text-[11px] text-paper-faint hover:text-paper-dim"
            >
              Not now
            </button>
          </>
        )}
      </div>
    </div>
  );
}
