"use client";

import { useState, useTransition } from "react";

import { rateSphere } from "@/app/(app)/individual/self/priorities";
import { SPHERES } from "@/lib/spheres";

const LABELS = ["Not for me", "A little", "Matters", "Matters a lot", "Most important"];

/**
 * Rate how much each Sphere matters to you, 1 to 5. Saves on tap; tap the same
 * one again to clear it. Your ratings are yours alone — the group or place
 * sees only the combined tally, once enough people have rated (0047).
 */
export function SphereRatings({ initial, compact = false }: { initial: Record<string, number>; compact?: boolean }) {
  const [ratings, setRatings] = useState<Record<string, number>>(initial);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  function set(id: string, value: number) {
    const was = ratings[id];
    const next = was === value ? null : value;
    setRatings((r) => {
      const copy = { ...r };
      if (next === null) delete copy[id];
      else copy[id] = next;
      return copy;
    });
    start(async () => {
      const res = await rateSphere(id, next);
      if (!res.ok) {
        setError(res.error);
        setRatings((r) => {
          const copy = { ...r };
          if (was) copy[id] = was;
          else delete copy[id];
          return copy;
        });
      } else setError(null);
    });
  }

  return (
    <div>
      <ul className="divide-y divide-line-soft">
        {SPHERES.map((s) => {
          const r = ratings[s.id];
          return (
            <li key={s.id} className="py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[0.95rem] font-semibold text-paper">{s.name}</p>
                <p className="text-xs text-paper-faint">{r ? LABELS[r - 1] : "Not rated"}</p>
              </div>
              {compact ? null : <p className="mt-0.5 text-[0.8125rem] text-paper-dim">{s.description}</p>}
              <div className="mt-2 grid grid-cols-5 gap-1.5" role="radiogroup" aria-label={`How much ${s.name} matters to you`}>
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={r === v}
                    aria-label={LABELS[v - 1]}
                    title={LABELS[v - 1]}
                    onClick={() => set(s.id, v)}
                    className={`press h-8 rounded-pill text-xs font-semibold tabular-nums ${
                      r && v <= r ? "bg-gold text-ink" : "bg-surface text-paper-faint"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      {error ? <p className="mt-2 text-sm text-alarm">{error}</p> : null}
    </div>
  );
}
