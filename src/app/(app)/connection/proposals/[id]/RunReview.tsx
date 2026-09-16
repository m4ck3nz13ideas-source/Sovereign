"use client";

import { useState, useTransition } from "react";

import { Button, Empty } from "@/components/ui";

import { runReview } from "../../actions";

/**
 * The review normally runs on submission. When it did not — no key, a model
 * error, a network failure — anyone in the group can run it, because a
 * proposal stuck without a review is a proposal nobody can respond to.
 */
export function RunReview({ proposalId }: { proposalId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Empty
      action={
        <Button
          type="button"
          tone="quiet"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await runReview(proposalId);
              if (!r.ok) setError(r.error);
            })
          }
        >
          {pending ? "Reading the proposal" : "Run the review"}
        </Button>
      }
    >
      {error ??
        "No review yet. Until one exists, resonance stays closed — nobody is asked to respond to something that has not been read."}
    </Empty>
  );
}
