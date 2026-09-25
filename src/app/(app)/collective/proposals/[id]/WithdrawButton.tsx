"use client";

import { useState, useTransition } from "react";

import { Button, Card } from "@/components/ui";

import { withdrawProposal } from "../../actions";

/**
 * The author's only edit.
 *
 * A proposal cannot be changed after submission, so when it was wrong the
 * honest move is to pull it and write a better one. It stays on the record as
 * withdrawn — the review and the deliberation remain readable, because the
 * group spent time on them.
 */
export function WithdrawButton({ proposalId }: { proposalId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="smallcaps text-[11px] text-paper-faint hover:text-alarm"
      >
        Withdraw this
      </button>
    );
  }

  return (
    <Card className="border-alarm/40">
      <p className="text-[0.95rem] leading-relaxed text-paper">
        Withdraw it?
      </p>
      <p className="mt-2 text-sm leading-relaxed text-paper-dim">
        It stays visible as withdrawn, with the review and everything said about
        it. Nothing is deleted. If you want the thing after all, write it again
        as a new proposal with what you learned here in it.
      </p>

      {error ? <p className="mt-3 text-sm text-alarm">{error}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          tone="danger"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await withdrawProposal(proposalId);
              if (!r.ok) setError(r.error);
              else setConfirming(false);
            })
          }
        >
          {pending ? "Withdrawing" : "Withdraw"}
        </Button>
        <Button type="button" tone="ghost" onClick={() => setConfirming(false)}>
          Keep it open
        </Button>
      </div>
    </Card>
  );
}
