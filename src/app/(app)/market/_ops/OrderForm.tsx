"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, Field, inputClass } from "@/components/ui";

import { openConversation, placeOrder } from "../ops";

/**
 * Order a product or book a service, on a business's page. The business
 * answers with the price it agrees to (and a time, for a booking); payment is
 * settled between the two for now.
 */
export function OrderForm({
  offeringId,
  kind,
  price,
}: {
  offeringId: string;
  kind: "product" | "service";
  price: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [wantedAt, setWantedAt] = useState("");
  const [request, setRequest] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const booking = kind === "service";

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-semibold text-gold hover:underline">
        {booking ? "Book" : "Order"}
      </button>
    );

  return (
    <div className="mt-3 space-y-3 rounded-card border border-line bg-surface-soft p-3">
      {booking ? (
        <Field label="When you would like it" hint="The business confirms a time when it accepts.">
          <input
            type="datetime-local"
            className={inputClass}
            value={wantedAt}
            onChange={(e) => setWantedAt(e.target.value)}
          />
        </Field>
      ) : (
        <Field label="How many">
          <input
            type="number"
            min={1}
            max={999}
            inputMode="numeric"
            className={inputClass}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
        </Field>
      )}
      <Field label="Anything they should know" hint={`Listed at ${price}. The business confirms the price before anything is owed.`}>
        <textarea
          className={`${inputClass} min-h-20`}
          value={request}
          maxLength={1000}
          onChange={(e) => setRequest(e.target.value)}
          placeholder={booking ? "What needs doing, and where" : "Size, colour, delivery or collection"}
        />
      </Field>
      {error ? <p className="text-sm text-alarm">{error}</p> : null}
      <div className="flex gap-2">
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await placeOrder({ offeringId, quantity, request, wantedAt });
              if (!r.ok) setError(r.error);
              else router.push(`/market/orders/${r.id}`);
            })
          }
        >
          {pending ? "Sending…" : booking ? "Ask to book" : "Send order"}
        </Button>
        <Button type="button" tone="ghost" onClick={() => setOpen(false)}>
          Not now
        </Button>
      </div>
    </div>
  );
}

/** Opens (or reopens) the one conversation between this customer and the business. */
export function MessageButton({ vendorId, label = "Message" }: { vendorId: string; label?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex flex-col items-center">
      <Button
        type="button"
        tone="quiet"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await openConversation(vendorId);
            if (!r.ok) setError(r.error);
            else router.push(`/market/m/${r.id}`);
          })
        }
      >
        {pending ? "Opening…" : label}
      </Button>
      {error ? <span className="mt-1 text-xs text-alarm">{error}</span> : null}
    </span>
  );
}
