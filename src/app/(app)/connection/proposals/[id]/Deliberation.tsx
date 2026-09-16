"use client";

import { useState, useTransition } from "react";

import { Button, Empty, inputClass } from "@/components/ui";

import { comment } from "../../actions";

/**
 * The deliberation thread.
 *
 * Flat, chronological, no voting on comments and no sorting by popularity.
 * Amendments to a proposal live here, which is why the thread is part of the
 * permanent record rather than a chat attached to it.
 */
export function Deliberation({
  proposalId,
  comments,
  canComment,
}: {
  proposalId: string;
  comments: { id: string; author: string; body: string; when: string; mine: boolean }[];
  canComment: boolean;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      {comments.length ? (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li
              key={c.id}
              className="rounded-card border border-line bg-surface-soft px-4 py-3.5"
            >
              <p className="whitespace-pre-wrap text-[0.95rem] leading-relaxed text-paper">
                {c.body}
              </p>
              <p className="smallcaps mt-2 text-[10px] text-paper-faint">
                {c.mine ? "you" : c.author} · {c.when}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>
          Nothing said yet. The questions in the review are a reasonable place to
          start.
        </Empty>
      )}

      {canComment ? (
        <div className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Say the thing you would say in the room."
            className={`${inputClass} resize-y leading-relaxed`}
          />
          {error ? <p className="text-sm text-alarm">{error}</p> : null}
          <Button
            type="button"
            tone="quiet"
            disabled={pending || !text.trim()}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await comment(proposalId, text);
                if (!r.ok) setError(r.error);
                else setText("");
              })
            }
          >
            {pending ? "Adding" : "Add to the deliberation"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
