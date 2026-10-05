"use client";

import { useState, useTransition } from "react";

import { Button, Field, inputClass } from "@/components/ui";

import { raiseConcern } from "../../actions";

export function ConcernForm({ vendorId, laws }: { vendorId: string; laws: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [law, setLaw] = useState(laws[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm text-gold hover:underline">
        Raise a concern
      </button>
    );

  if (msg?.ok) return <p className="text-sm text-calm">{msg.text}</p>;

  return (
    <div className="space-y-3">
      <Field label="Which law">
        <select className={inputClass} value={law} onChange={(e) => setLaw(e.target.value)}>
          {laws.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="What you saw">
        <textarea className={`${inputClass} min-h-24`} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      {msg && !msg.ok ? <p className="text-sm text-alarm">{msg.text}</p> : null}
      <Button
        type="button"
        tone="quiet"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await raiseConcern(vendorId, law, reason);
            setMsg(r.ok ? { ok: true, text: "Sent to the reviewers. Thank you." } : { ok: false, text: r.error });
          })
        }
      >
        Send to reviewers
      </Button>
    </div>
  );
}
