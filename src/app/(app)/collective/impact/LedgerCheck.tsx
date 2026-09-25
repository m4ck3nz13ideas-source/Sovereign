"use client";

import { useState, useTransition } from "react";

import { Button, Card } from "@/components/ui";

import { verifyRecord } from "./actions";

/**
 * Replay the group's hash chain and report whether it still adds up.
 *
 * This is the honest version of the whitepaper's verifiability claim at this
 * scale: every governance act commits to the hash of the one before it, so an
 * altered or deleted row is detectable. It is tamper-evident, not trustless —
 * whoever runs the database could still rewrite the whole chain. The page says
 * so, because a verification badge that overstates what it proves is worse
 * than no badge.
 */
export function LedgerCheck({ groupId }: { groupId: string | null }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<
    { ok: boolean; checked: number; brokenAt: number | null } | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card>
      <p className="text-[0.95rem] leading-relaxed text-paper">
        Every proposal, flag, resonance and decision is written to an
        append-only chain, each entry sealed against the one before it.
      </p>

      {result ? (
        <p
          className={`mt-3 text-sm leading-relaxed ${result.ok ? "text-calm" : "text-alarm"}`}
        >
          {result.ok
            ? `${result.checked} entries replayed, chain intact.`
            : `The chain breaks at entry ${result.brokenAt}. Something has been altered or removed since it was written.`}
        </p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-alarm">{error}</p> : null}

      <Button
        type="button"
        tone="quiet"
        className="mt-4"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await verifyRecord(groupId);
            if (!r.ok) setError(r.error);
            else setResult(r.result);
          })
        }
      >
        {pending ? "Replaying" : "Check the record"}
      </Button>

      <p className="mt-4 text-xs leading-relaxed text-paper-faint">
        This proves the record has not been edited since it was written. It does
        not prove more than that: whoever runs this database could rewrite the
        entire chain, and there is no second copy to contradict them. That is
        what a chain would buy, and it is not what this is.
      </p>
    </Card>
  );
}
