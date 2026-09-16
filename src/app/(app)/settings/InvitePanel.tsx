"use client";

import { useState, useTransition } from "react";

import { Button, Card, Field, inputClass } from "@/components/ui";

import { makeInvite } from "./actions";

export function InvitePanel({ groupId }: { groupId: string }) {
  const [uses, setUses] = useState("1");
  const [days, setDays] = useState("14");
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Card>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Uses" hint="How many people can redeem it.">
          <input
            value={uses}
            onChange={(e) => setUses(e.target.value)}
            inputMode="numeric"
            className={inputClass}
          />
        </Field>
        <Field label="Expires in days">
          <input
            value={days}
            onChange={(e) => setDays(e.target.value)}
            inputMode="numeric"
            className={inputClass}
          />
        </Field>
      </div>

      {error ? <p className="mt-3 text-sm text-alarm">{error}</p> : null}

      <Button
        type="button"
        tone="quiet"
        className="mt-4"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            setCopied(false);
            const r = await makeInvite(groupId, Number(uses) || 1, Number(days) || 14);
            if (!r.ok) setError(r.error);
            else setCode(r.code);
          })
        }
      >
        {pending ? "Making" : "Make a code"}
      </Button>

      {code ? (
        <div className="mt-4 rounded-md border border-gold-dim bg-gold-wash px-4 py-3">
          <p className="font-mono text-lg tracking-wider text-paper">{code}</p>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(code).then(
                () => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2000);
                },
                () => undefined,
              );
            }}
            className="smallcaps mt-2 text-[10px] text-gold hover:underline"
          >
            {copied ? "copied" : "copy"}
          </button>
        </div>
      ) : null}

      <p className="mt-4 text-xs leading-relaxed text-paper-faint">
        Anyone with this code and an email address becomes a member. There is no
        identity proof behind it and no uniqueness guarantee — send it the way
        you would send a house key.
      </p>
    </Card>
  );
}
