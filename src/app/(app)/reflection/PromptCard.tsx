"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Button, Empty } from "@/components/ui";
import type { SurfacedPrompt } from "@/lib/types";

import { askForPrompt, dismissPrompt } from "./actions";

/**
 * One question at a time, with a Respond button that opens a new Journal input.
 *
 * The question is asked for, never pushed. The rationale beneath it names the
 * pattern rather than interpreting it, which is what the prompt in
 * src/lib/ai/prompts.ts insists on.
 */
export function PromptCard({
  prompt,
  hasEntries,
}: {
  prompt: SurfacedPrompt | null;
  hasEntries: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!prompt) {
    return (
      <Empty
        action={
          hasEntries ? (
            <Button
              type="button"
              tone="quiet"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const r = await askForPrompt();
                  if (!r.ok) setError(r.error);
                })
              }
            >
              {pending ? "Reading" : "Read my entries"}
            </Button>
          ) : undefined
        }
      >
        {error ??
          (hasEntries
            ? "There are unexamined entries. Ask for a question drawn from them whenever you want one."
            : "A question appears here once there are entries to draw it from.")}
      </Empty>
    );
  }

  return (
    <div className="rounded-card border border-gold-dim bg-gold-wash p-5">
      <p className="font-serif text-xl leading-snug text-paper">
        {prompt.question}
      </p>

      {prompt.rationale ? (
        <p className="mt-3 text-sm leading-relaxed text-paper-dim">
          {prompt.rationale}
        </p>
      ) : null}

      <div className="mt-5 flex items-center gap-2">
        <Link
          href="/launch"
          className="smallcaps inline-flex items-center rounded-md bg-gold px-4 py-2.5 text-xs text-ink transition-colors hover:bg-gold/90"
        >
          Respond
        </Link>
        <Button
          type="button"
          tone="ghost"
          disabled={pending}
          onClick={() => start(async () => { await dismissPrompt(prompt.id); })}
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
