"use client";

import { useEffect, useState, useTransition } from "react";

import { markThreadRead, sendThreadMessage, unsayInThread } from "@/app/(app)/chats/threads";
import { Button, cx, inputClass } from "@/components/ui";
import { ago } from "@/lib/format";
import type { ThreadMessage } from "@/lib/types";

/** A chat with several people. Same calm as two: no receipts, no typing. */
export function ThreadView({ thread, messages }: { thread: string; messages: ThreadMessage[] }) {
  const [pending, start] = useTransition();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void markThreadRead(thread);
  }, [thread]);

  return (
    <div className="space-y-4">
      {messages.length ? (
        <ul className="space-y-3">
          {messages.map((m) => (
            <li key={m.id} className={cx("flex", m.mine ? "justify-end" : "justify-start")}>
              <div className="max-w-[82%]">
                {!m.mine ? (
                  <p className="smallcaps mb-1 text-[10px] text-paper-faint">{m.display_name}</p>
                ) : null}
                <div
                  className={cx(
                    "rounded-card px-3.5 py-2.5",
                    m.mine ? "bg-gold text-ink" : "bg-surface text-paper",
                  )}
                >
                  <p className="text-[0.9375rem] leading-relaxed whitespace-pre-wrap" data-selectable>
                    {m.body}
                  </p>
                </div>
                <div className={cx("mt-1 flex items-center gap-2", m.mine ? "justify-end" : "justify-start")}>
                  <span className="smallcaps text-[10px] text-paper-faint">{ago(m.created_at)}</span>
                  {m.mine ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const res = await unsayInThread(m.id, thread);
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
        <p className="text-[0.9375rem] leading-relaxed text-paper-dim">Nothing said yet.</p>
      )}

      {error ? <p className="text-[0.85rem] text-alarm">{error}</p> : null}

      <div className="space-y-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Say something"
          aria-label="Message"
          className={inputClass}
        />
        <Button
          tone="gold"
          disabled={pending || !body.trim()}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await sendThreadMessage(thread, body);
              if (!res.ok) setError(res.error);
              else setBody("");
            })
          }
        >
          {pending ? "Sending…" : "Send"}
        </Button>
      </div>
    </div>
  );
}
