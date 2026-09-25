"use client";

import { useState, useTransition } from "react";

import { Button, Empty } from "@/components/ui";
import type { SurfacedPrompt } from "@/lib/types";

import { askForSynthesis, dismissSynthesis } from "./actions";

/**
 * Pipeline's counterpart to Reflection's prompt, but discipline-facing:
 * "You've been circling the idea of X across three entries. Is this a concept
 * worth naming?"
 */
export function SynthesisCard({
  prompt,
  ideaCount,
}: {
  prompt: SurfacedPrompt | null;
  ideaCount: number;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!prompt) {
    return (
      <Empty
        action={
          ideaCount >= 2 ? (
            <Button
              type="button"
              tone="quiet"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const r = await askForSynthesis();
                  if (!r.ok) setError(r.error);
                })
              }
            >
              {pending ? "Reading" : "Look for a thread"}
            </Button>
          ) : undefined
        }
      >
        {error ??
          (ideaCount >= 2
            ? "Ask whether anything in the inbox is circling."
            : "Two or more ideas in the inbox, and a thread can be looked for.")}
      </Empty>
    );
  }

  return (
    <div className="rounded-card border border-gold-dim bg-gold-wash p-5">
      <p className="font-serif text-xl leading-snug text-paper">{prompt.question}</p>

      {prompt.rationale ? (
        <p className="mt-3 text-sm leading-relaxed text-paper-dim">{prompt.rationale}</p>
      ) : null}

      <div className="mt-5 flex items-center gap-2">
        <Button
          type="button"
          tone="ghost"
          disabled={pending}
          onClick={() => start(async () => { await dismissSynthesis(prompt.id); })}
        >
          Let it pass
        </Button>
      </div>

      <p className="smallcaps mt-5 text-[10px] text-paper-faint">
        {prompt.prompt_id} v{prompt.prompt_version} · {prompt.model}
      </p>
    </div>
  );
}
