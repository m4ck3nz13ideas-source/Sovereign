"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, inputClass } from "@/components/ui";

import { raiseTerm } from "./actions";

/**
 * Raising a word.
 *
 * It goes straight to the word's page afterwards, because raising one without
 * saying what you mean by it is half of nothing — the word on its own is just
 * an assertion that somebody is confused.
 */
export function RaiseWord({ groupId }: { groupId: string }) {
  const [word, setWord] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const tooShort = word.trim().length < 2;

  function run() {
    start(async () => {
      setError(null);
      const r = await raiseTerm(groupId, word);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setWord("");
      router.push(`/collective/lexicon/${r.id}`);
    });
  }

  return (
    <div className="mb-6">
      <div className="flex gap-2">
        <input
          value={word}
          onChange={(e) => setWord(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !tooShort && !pending) run();
          }}
          placeholder="shared, urgent, the fund, ours"
          aria-label="A word this group uses"
          className={inputClass}
        />
        <Button type="button" tone="quiet" disabled={tooShort || pending} onClick={run}>
          {pending ? "Raising" : "Raise"}
        </Button>
      </div>
      {error ? <p className="mt-2 text-sm text-alarm">{error}</p> : null}
    </div>
  );
}
