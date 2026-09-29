"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { askAboutProposal } from "@/app/(app)/individual/ai/actions";
import { Button } from "@/components/ui";

/**
 * Asking your guardian about this one.
 *
 * Deliberately a button rather than a panel that fills itself in. The
 * guardian never speaks first, which means it does not appear on a proposal
 * page uninvited — and it sits below the sliders rather than above the text,
 * because something that reads a proposal for you before you have read it
 * yourself is not a guardian.
 */
export function AskGuardian({ proposalId }: { proposalId: string }) {
  const [pending, start] = useTransition();
  const [asked, setAsked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {error ? <p className="text-[0.85rem] text-alarm">{error}</p> : null}

      {asked ? (
        <p className="text-[0.8125rem] leading-relaxed text-paper-faint">
          Saved to{" "}
          <Link href="/individual/ai" className="text-gold hover:underline">
            your AI
          </Link>
          , where only you can read it.
        </p>
      ) : null}

      <Button
        tone="quiet"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await askAboutProposal(proposalId);
            if (!res.ok) setError(res.error);
            else setAsked(true);
          })
        }
      >
        {pending ? "Reading…" : asked ? "Ask again" : "Ask your guardian"}
      </Button>

      <p className="text-[0.8125rem] leading-relaxed text-paper-faint">
        It reads this against the values you wrote down and asks you questions.
        It has no view on whether you should support it, nothing it says is
        attached to this proposal, and nobody else can see any of it — not the
        author, not a steward, not anybody.{" "}
        <Link href="/individual/ai" className="text-gold hover:underline">
          What it will not do
        </Link>
        .
      </p>
    </div>
  );
}
