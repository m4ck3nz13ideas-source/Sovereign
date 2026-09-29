"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui";

import { releasePersonhood } from "./actions";

/**
 * The state of your own proof, and the one thing you can do to it.
 *
 * What is deliberately NOT here yet: the verifier's own client widget. The
 * server half is finished and tested — a proof is checked server-side and the
 * nullifier is written by a function that refuses a hash already belonging to
 * somebody else — but the browser half has to be built against whichever
 * verifier an instance configures, and against the version of its SDK that
 * instance is on. Shipping a widget wired to an API nobody here has run
 * against a live app would be a button that looks like it works.
 *
 * So the button that exists is the one that always works: releasing your own.
 */
export function ProvePanel({
  configured,
  verified,
}: {
  configured: boolean;
  verified: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (verified) {
    return (
      <div className="space-y-3">
        <p className="text-[0.95rem] leading-relaxed text-paper">
          You have proved you are one person. Nothing about you was stored to do
          it — only a hash that is the same for you here and different
          everywhere else.
        </p>
        {error ? <p className="text-[0.85rem] text-alarm">{error}</p> : null}
        <Button
          tone="quiet"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await releasePersonhood();
              if (!res.ok) setError(res.error);
            })
          }
        >
          {pending ? "Releasing…" : "Release it"}
        </Button>
        <p className="text-[0.8125rem] leading-relaxed text-paper-faint">
          Releasing frees the hash, so you can prove the same personhood on a
          different account. Nobody else can do this to you — there is no path
          in the database by which a steward, a group or an administrator can
          take it away.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[0.95rem] leading-relaxed text-paper-dim">
        {configured
          ? "A verifier is configured, but the step that runs in your browser is not connected to it yet. Until it is, nobody on this instance is verified — and national scale and above stay closed to everyone equally, which is the correct behaviour rather than a workaround."
          : "No verifier is configured on this instance, so there is nothing to press — and nobody here can prove personhood, including whoever set it up."}
      </p>
      <p className="text-[0.8125rem] leading-relaxed text-paper-faint">
        Everything below is true now and does not change when that step is
        connected. It is here so you can decide whether you want to do this
        before you are asked to.
      </p>
    </div>
  );
}
