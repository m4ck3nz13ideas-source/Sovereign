"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, inputClass } from "@/components/ui";

import { answerRequirement, runConditions } from "../../actions";

export function RequirementAnswer({ proposalId, idx }: { proposalId: string; idx: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-2 text-sm text-gold hover:underline">
        Answer
      </button>
    );

  return (
    <div className="mt-2 space-y-2">
      <textarea className={`${inputClass} min-h-20`} value={text} onChange={(e) => setText(e.target.value)} />
      {error ? <p className="text-xs text-alarm">{error}</p> : null}
      <Button
        type="button"
        tone="quiet"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await answerRequirement(proposalId, idx, text);
            if (!r.ok) setError(r.error);
            else router.refresh();
          })
        }
      >
        Answer on the record
      </Button>
    </div>
  );
}

export function RunConditions({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div>
      <Button
        type="button"
        tone="quiet"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await runConditions(proposalId);
            if (!r.ok) setError(r.error);
            else router.refresh();
          })
        }
      >
        {pending ? "Setting" : "Set its conditions"}
      </Button>
      {error ? <p className="mt-2 text-xs text-alarm">{error}</p> : null}
    </div>
  );
}
