"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui";

import { fileFaithEntry } from "./actions";

/**
 * A faith entry from Launch, sitting at the top of Profile.
 *
 * Same banner logic as everywhere else: a quiet pull toward reflection rather
 * than a notification. It does not count anything and it does not nag.
 */
export function FaithBanner({
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
              Faith · ready to sit with this?
            </p>
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="animate-settle-in rounded-card border border-gold-dim bg-surface-soft p-4">
      <p className="smallcaps mb-3 text-[10px] text-paper-faint">Faith · {when}</p>
      <p className="whitespace-pre-wrap text-[0.95rem] leading-relaxed text-paper-dim">
        {body}
      </p>
      <div className="mt-4 flex items-center gap-2">
        <Button
          type="button"
          tone="quiet"
          disabled={pending}
          onClick={() => start(async () => { await fileFaithEntry(id); })}
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
      </div>
    </div>
  );
}
