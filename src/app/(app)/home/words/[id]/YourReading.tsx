"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, Field, inputClass } from "@/components/ui";

import { writeReading } from "../actions";

/**
 * Writing what you take a word to mean.
 *
 * Writing again makes a new revision rather than replacing the old one, and the
 * copy says so before you type rather than after you have. A silent edit would
 * let the discovery that two people meant different things be tidied away
 * afterwards, and that discovery is the whole point of the screen.
 */
export function YourReading({
  termId,
  term,
  existing,
}: {
  termId: string;
  term: string;
  existing: string | null;
}) {
  const [body, setBody] = useState(existing ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const changed = body.trim() !== (existing ?? "").trim();
  const tooShort = body.trim().length < 20;

  function run() {
    start(async () => {
      setError(null);
      const r = await writeReading(termId, body);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <Field
        label={existing ? "What you mean by it now" : "What you mean by it"}
        hint={
          existing
            ? "Saving this keeps the wording above as well. Nothing is overwritten, so a group can see how its language moved."
            : "Concretely enough that somebody could tell whether they disagree with you."
        }
      >
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          maxLength={600}
          placeholder={`When this group says “${term}”, I take it to mean…`}
          className={`${inputClass} resize-y`}
        />
      </Field>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          tone="quiet"
          disabled={tooShort || !changed || pending}
          onClick={run}
        >
          {pending ? "Saving" : existing ? "Save as a new wording" : "Save"}
        </Button>
        <span className="text-xs text-paper-faint">
          {body.trim().length}/600
        </span>
      </div>

      {error ? <p className="text-sm text-alarm">{error}</p> : null}
    </div>
  );
}
