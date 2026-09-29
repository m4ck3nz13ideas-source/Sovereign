"use client";

import { useEffect, useState, useTransition } from "react";

import { markRead, sendMessage, unsay } from "@/app/(app)/individual/chats/actions";
import { Button, cx, inputClass } from "@/components/ui";
import { ago } from "@/lib/format";
import type { Message } from "@/lib/types";

/**
 * One conversation.
 *
 * Read state is marked once, on arrival, and it is the reader's own — there is
 * nothing on this screen that tells the other person you looked, and no way
 * for them to find out. No typing indicator either: the pause before somebody
 * answers is theirs.
 *
 * Your own messages can be unsaid, which removes them for both. They may
 * already have read it, and the copy says so rather than implying an undo.
 */
export function Thread({
  other,
  name,
  messages,
  stillFriends,
}: {
  other: string;
  name: string;
  messages: Message[];
  stillFriends: boolean;
}) {
  const [pending, start] = useTransition();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void markRead(other);
  }, [other]);

  return (
    <div className="space-y-4">
      {messages.length ? (
        <ul className="space-y-3">
          {messages.map((m) => (
            <li
              key={m.id}
              className={cx("flex", m.mine ? "justify-end" : "justify-start")}
            >
              <div className="max-w-[82%]">
                <div
                  className={cx(
                    "rounded-card px-3.5 py-2.5",
                    m.mine ? "bg-gold text-ink" : "bg-surface text-paper",
                  )}
                >
                  <p
                    className="text-[0.9375rem] leading-relaxed whitespace-pre-wrap"
                    data-selectable
                  >
                    {m.body}
                  </p>
                </div>

                <div
                  className={cx(
                    "mt-1 flex items-center gap-2",
                    m.mine ? "justify-end" : "justify-start",
                  )}
                >
                  <span className="smallcaps text-[10px] text-paper-faint">
                    {ago(m.created_at)}
                  </span>
                  {m.mine ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const res = await unsay(m.id, other);
                          if (!res.ok) setError(res.error);
                        })
                      }
                      className="smallcaps text-[10px] text-paper-faint hover:text-alarm"
                    >
                      unsay
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[0.9375rem] leading-relaxed text-paper-dim">
          Nothing said yet.
        </p>
      )}

      {error ? <p className="text-[0.85rem] text-alarm">{error}</p> : null}

      {stillFriends ? (
        <div className="space-y-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder={`To ${name}`}
            aria-label="Message"
            className={inputClass}
          />
          <Button
            tone="gold"
            disabled={pending || !body.trim()}
            onClick={() =>
              start(async () => {
                setError(null);
                const res = await sendMessage(other, body);
                if (!res.ok) setError(res.error);
                else setBody("");
              })
            }
          >
            {pending ? "Sending…" : "Send"}
          </Button>
        </div>
      ) : (
        <p className="text-[0.8125rem] leading-relaxed text-paper-faint">
          You are not friends any more, so there is nothing new to add. What was
          said stays where both of you can read it — deleting your half of
          somebody else&rsquo;s conversation is not something this can do
          honestly.
        </p>
      )}
    </div>
  );
}
