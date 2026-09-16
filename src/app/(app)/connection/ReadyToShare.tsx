"use client";

import { useState, useTransition } from "react";

import { Button, inputClass } from "@/components/ui";

import { publishEntry } from "./actions";

/**
 * An Output entry from Launch, waiting above the feed.
 *
 * Nothing is posted automatically. "Ready to share" is a statement about the
 * entry, not an instruction to the person — Edit first and Post are equally
 * available, and leaving it alone is a complete answer.
 */
export function ReadyToShare({
  id,
  body,
  when,
  hasGroup,
}: {
  id: string;
  body: string;
  when: string;
  hasGroup: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(body);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function post() {
    start(async () => {
      setError(null);
      const r = await publishEntry(id, text);
      if (!r.ok) setError(r.error);
    });
  }

  return (
    <div className="rounded-card border border-line bg-surface-soft px-4 py-3.5">
      {editing ? (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          autoFocus
          className={`${inputClass} resize-y leading-relaxed`}
        />
      ) : (
        <p className="text-[0.95rem] leading-snug text-paper">{text}</p>
      )}

      <p className="smallcaps mt-1.5 text-[10px] text-paper-faint">Output · {when}</p>

      {error ? <p className="mt-2 text-sm text-alarm">{error}</p> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" onClick={post} disabled={pending || !hasGroup}>
          {pending ? "Posting" : "Post"}
        </Button>
        {editing ? (
          <Button type="button" tone="ghost" onClick={() => setEditing(false)}>
            Done editing
          </Button>
        ) : (
          <Button type="button" tone="quiet" onClick={() => setEditing(true)}>
            Edit first
          </Button>
        )}
      </div>

      {!hasGroup ? (
        <p className="mt-2 text-xs text-paper-faint">
          A post needs a group to land in.
        </p>
      ) : null}
    </div>
  );
}
