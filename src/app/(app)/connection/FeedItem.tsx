"use client";

import { useTransition } from "react";

import { toggleReaction } from "./actions";

/**
 * A post in the feed.
 *
 * No repost, no share count, no engagement metric on the card. The only
 * action is a quiet acknowledgement, and it does not show a number until
 * someone has actually given one.
 */
export function FeedItem({
  id,
  author,
  body,
  when,
  sourceTag,
  reactions,
  reacted,
  mine,
}: {
  id: string;
  author: string;
  body: string;
  when: string;
  sourceTag: string | null;
  reactions: number;
  reacted: boolean;
  mine: boolean;
}) {
  const [pending, start] = useTransition();

  return (
    <article className="rounded-card border border-line bg-surface-soft p-4">
      <p className="whitespace-pre-wrap text-[0.95rem] leading-relaxed text-paper">
        {body}
      </p>

      <div className="mt-3 flex items-center gap-3">
        <p className="smallcaps text-[10px] text-paper-faint">
          {[mine ? "you" : author, sourceTag, when].filter(Boolean).join(" · ")}
        </p>

        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => { await toggleReaction(id); })}
          className={`smallcaps ml-auto text-[10px] transition-colors ${
            reacted ? "text-gold" : "text-paper-faint hover:text-paper-dim"
          }`}
        >
          {reacted ? "acknowledged" : "acknowledge"}
          {reactions > 0 ? ` · ${reactions}` : ""}
        </button>
      </div>
    </article>
  );
}
