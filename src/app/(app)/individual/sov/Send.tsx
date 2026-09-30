"use client";

import { useState, useTransition } from "react";

import { Button, inputClass } from "@/components/ui";

import { sendSov } from "./actions";

/**
 * Sending some to somebody.
 *
 * The reason is not optional and not decoration: it is written onto both sides
 * of the entry, so what arrives in somebody's record says what it was for. The
 * same twenty-character floor `resolve_flag()` and `stand_down_proposal()` ask
 * for, and for the same reason — a movement nobody can explain is one nobody
 * can audit.
 */
export function Send({
  people,
}: {
  people: { profile_id: string; display_name: string; handle: string | null }[];
}) {
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  if (!people.length) {
    return (
      <p className="text-[0.9375rem] leading-relaxed text-paper-dim">
        There is nobody to send to yet. Following somebody, or being friends
        with them, is what makes them reachable — see People.
      </p>
    );
  }

  function send() {
    start(async () => {
      setError(null);
      setDone(false);
      const r = await sendSov({ to, amount: Number(amount), reason });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setDone(true);
      setAmount("");
      setReason("");
    });
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-2">
        <select
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className={`${inputClass} flex-1`}
        >
          <option value="">Who</option>
          {people.map((p) => (
            <option key={p.profile_id} value={p.profile_id}>
              {p.display_name}
              {p.handle ? ` · @${p.handle}` : ""}
            </option>
          ))}
        </select>

        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="How much"
          className={`${inputClass} w-32`}
        />
      </div>

      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        placeholder="What it is for. Both of you will read this later."
        className={`${inputClass} resize-y leading-relaxed`}
      />

      {error ? <p className="text-sm text-alarm">{error}</p> : null}
      {done ? <p className="text-sm text-paper-dim">Sent.</p> : null}

      <Button type="button" onClick={send} disabled={pending || !to || !amount}>
        {pending ? "Sending" : "Send"}
      </Button>
    </div>
  );
}
