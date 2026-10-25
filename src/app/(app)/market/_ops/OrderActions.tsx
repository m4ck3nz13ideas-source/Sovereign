"use client";

import { useState, useTransition } from "react";

import { Button, Field, inputClass } from "@/components/ui";
import { ORDER_REPLY_DAYS, orderNoun, type OrderAction } from "@/lib/business";

import {
  acceptOrder,
  cancelOrder,
  completeUnanswered,
  confirmOrder,
  declineOrder,
  deliverOrder,
  disputeOrder,
  resolveDispute,
} from "../ops";

type Res = { ok: true } | { ok: false; error: string };

const LABEL: Record<OrderAction, string> = {
  accept: "Accept",
  decline: "Decline",
  deliver: "Mark as done",
  cancel: "Cancel",
  confirm: "Confirm it's done",
  dispute: "Report a problem",
  complete_unanswered: "Close as completed",
  resolve: "Settle the problem",
};

/**
 * The moves open to whoever is looking at this order. Each opens its own
 * small form, because most of them ask for words: a price, a reason, what is
 * wrong. The database refuses anything this offers by mistake.
 */
export function OrderActions({
  orderId,
  kind,
  actions,
  listedPrice,
  wantedAt,
}: {
  orderId: string;
  kind: "product" | "service";
  actions: OrderAction[];
  listedPrice: string;
  wantedAt: string | null;
}) {
  const [open, setOpen] = useState<OrderAction | null>(null);
  const [note, setNote] = useState("");
  const [price, setPrice] = useState(listedPrice);
  const [when, setWhen] = useState(wantedAt ? toLocal(wantedAt) : "");
  const [outcome, setOutcome] = useState<"completed" | "cancelled">("completed");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const noun = orderNoun(kind);

  if (!actions.length) return null;

  const run = (fn: () => Promise<Res>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error);
      else {
        setOpen(null);
        setNote("");
      }
    });

  if (!open)
    return (
      <div className="flex flex-wrap justify-center gap-2">
        {actions.map((a) => (
          <Button
            key={a}
            type="button"
            tone={a === "decline" || a === "cancel" || a === "dispute" ? "quiet" : "gold"}
            onClick={() => setOpen(a)}
          >
            {LABEL[a]}
          </Button>
        ))}
      </div>
    );

  const noteField = (label: string, hint?: string, min?: number) => (
    <Field label={label} hint={hint}>
      <textarea
        className={`${inputClass} min-h-20`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={min ? `At least ${min} characters` : "Optional"}
      />
    </Field>
  );

  const submit: Record<OrderAction, () => Promise<Res>> = {
    accept: () => acceptOrder(orderId, price, when, note),
    decline: () => declineOrder(orderId, note),
    deliver: () => deliverOrder(orderId, note),
    cancel: () => cancelOrder(orderId, note),
    confirm: () => confirmOrder(orderId, note),
    dispute: () => disputeOrder(orderId, note),
    complete_unanswered: () => completeUnanswered(orderId),
    resolve: () => resolveDispute(orderId, outcome, note),
  };

  return (
    <div className="space-y-3 rounded-card border border-line bg-surface-soft p-4">
      {open === "accept" ? (
        <>
          <Field label="The price you are agreeing to" hint="What the customer will owe. Settled between you for now.">
            <input className={inputClass} value={price} maxLength={120} onChange={(e) => setPrice(e.target.value)} />
          </Field>
          {kind === "service" ? (
            <Field label="When">
              <input type="datetime-local" className={inputClass} value={when} onChange={(e) => setWhen(e.target.value)} />
            </Field>
          ) : null}
          {noteField("A note for the customer")}
        </>
      ) : null}
      {open === "decline" ? noteField("Why you can't take it", "The customer sees this.", 10) : null}
      {open === "deliver" ? noteField("A note", `The customer then confirms or reports a problem within ${ORDER_REPLY_DAYS} days.`) : null}
      {open === "cancel" ? noteField("Why", `Needed once the ${noun} has been accepted.`, 10) : null}
      {open === "confirm" ? noteField("Anything to add", "Confirming completes it. You can then write a review.") : null}
      {open === "dispute" ? noteField("What is wrong", "The business and a marketplace reviewer see this.", 20) : null}
      {open === "complete_unanswered" ? (
        <p className="text-sm text-paper-dim">
          The customer has not confirmed or reported a problem in {ORDER_REPLY_DAYS} days. Closing it records that.
        </p>
      ) : null}
      {open === "resolve" ? (
        <>
          <Field label="Settle it as">
            <select className={inputClass} value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)}>
              <option value="completed">Completed: the business did what it agreed</option>
              <option value="cancelled">Cancelled: it did not, and nothing is owed</option>
            </select>
          </Field>
          {noteField("How it was settled", "Both sides see this.", 20)}
        </>
      ) : null}

      {error ? <p className="text-sm text-alarm">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="button" disabled={pending} onClick={() => run(submit[open])}>
          {pending ? "Saving…" : LABEL[open]}
        </Button>
        <Button type="button" tone="ghost" onClick={() => setOpen(null)}>
          Back
        </Button>
      </div>
    </div>
  );
}

function toLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
