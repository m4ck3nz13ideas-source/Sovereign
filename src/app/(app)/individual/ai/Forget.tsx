"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui";

import { forgetGuardian } from "./actions";

/**
 * Forgetting, which is a real verb here and almost nowhere else in this app.
 *
 * A flag cannot be dismissed, a prediction cannot be unsaid, a decision is
 * permanent — because in every one of those cases other people are entitled to
 * the record. Nobody is entitled to this one, so it goes when you say.
 */
export function Forget({ count }: { count: number }) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!count) return null;

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="smallcaps text-[10px] text-paper-faint hover:text-alarm"
      >
        forget all of it →
      </button>
    );
  }

  return (
    <div className="space-y-2">
      {error ? <p className="text-[0.85rem] text-alarm">{error}</p> : null}
      <p className="text-[0.8125rem] leading-relaxed text-paper-faint">
        All {count} of them, permanently. Nothing here was ever seen by anybody
        else and nothing is attached to any proposal, so this affects nothing
        but your own record of what you were asked.
      </p>
      <div className="flex gap-2">
        <Button
          tone="danger"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await forgetGuardian();
              if (!res.ok) setError(res.error);
              else setConfirming(false);
            })
          }
        >
          {pending ? "…" : "Forget it"}
        </Button>
        <Button tone="quiet" disabled={pending} onClick={() => setConfirming(false)}>
          Keep it
        </Button>
      </div>
    </div>
  );
}
