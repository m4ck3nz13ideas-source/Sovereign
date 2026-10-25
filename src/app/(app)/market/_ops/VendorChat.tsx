"use client";

import { useEffect, useState, useTransition } from "react";

import { Button, cx, inputClass } from "@/components/ui";
import { ago } from "@/lib/format";

import { markConversationRead, sendVendorMessage } from "../ops";

export type VendorMessage = {
  id: string;
  author_id: string;
  author_name: string;
  from_business: boolean;
  body: string;
  created_at: string;
};

/**
 * A customer and a business. Whoever on the team answers speaks for the
 * business and is named under it, so a customer knows who they dealt with.
 * No receipts, no typing indicator (rule 23).
 */
export function VendorChat({
  conversationId,
  messages,
  me,
  asTeam,
  vendorName,
}: {
  conversationId: string;
  messages: VendorMessage[];
  me: string;
  asTeam: boolean;
  vendorName: string;
}) {
  const [pending, start] = useTransition();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void markConversationRead(conversationId);
  }, [conversationId, messages.length]);

  return (
    <div className="space-y-4">
      {messages.length ? (
        <ul className="space-y-3">
          {messages.map((m) => {
            // On the team, the business's side is "ours"; as the customer, mine is.
            const ours = asTeam ? m.from_business : m.author_id === me;
            return (
              <li key={m.id} className={cx("flex", ours ? "justify-end" : "justify-start")}>
                <div className="max-w-[82%]">
                  <p className={cx("smallcaps mb-1 text-[10px] text-paper-faint", ours && "text-right")}>
                    {m.author_id === me
                      ? m.from_business
                        ? `You, for ${vendorName}`
                        : "You"
                      : m.from_business
                        ? `${vendorName} · ${m.author_name}`
                        : m.author_name}
                  </p>
                  <div className={cx("rounded-card px-3.5 py-2.5", ours ? "bg-gold text-ink" : "bg-surface text-paper")}>
                    <p className="text-[0.9375rem] leading-relaxed whitespace-pre-wrap" data-selectable>
                      {m.body}
                    </p>
                  </div>
                  <p className={cx("smallcaps mt-1 text-[10px] text-paper-faint", ours && "text-right")}>
                    {ago(m.created_at)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-center text-[0.9375rem] leading-relaxed text-paper-dim">
          {asTeam ? "Nothing said yet." : `Ask ${vendorName} anything: what they make, when, how much.`}
        </p>
      )}

      {error ? <p className="text-[0.85rem] text-alarm">{error}</p> : null}

      <div className="space-y-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={4000}
          placeholder={asTeam ? `Reply as ${vendorName}` : "Write your message"}
          aria-label="Message"
          className={inputClass}
        />
        <Button
          tone="gold"
          disabled={pending || !body.trim()}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await sendVendorMessage(conversationId, body);
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
