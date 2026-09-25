import { lastNDays } from "@/lib/format";
import type { EntryMode } from "@/lib/types";

/**
 * "Not a complex graph; more like a quiet rhythm display, dots or thin bars
 * arranged by day."
 *
 * Thirty columns, one per day, four rows for the four modes. A day with an
 * entry is a filled mark; a day without is a faint one. No axis, no numbers,
 * no trend line — this is a rhythm you glance at, not a metric you chase.
 */

const MODES: { mode: EntryMode; label: string }[] = [
  { mode: "journal", label: "Journal" },
  { mode: "faith", label: "Faith" },
  { mode: "idea", label: "Idea" },
  { mode: "output", label: "Output" },
];

export function PatternTracker({
  entries,
}: {
  entries: { mode: string; created_at: string }[];
}) {
  const days = lastNDays(30);

  const counts = new Map<string, number>();
  for (const e of entries) {
    const key = `${e.mode}:${e.created_at.slice(0, 10)}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const total = entries.length;

  return (
    <div className="rounded-card border border-line bg-surface-soft p-4">
      <div className="space-y-2.5">
        {MODES.map(({ mode, label }) => (
          <div key={mode} className="flex items-center gap-3">
            <span className="smallcaps w-14 shrink-0 text-[10px] text-paper-faint">
              {label}
            </span>
            <div className="flex flex-1 items-center gap-[3px]">
              {days.map((day) => {
                const n = counts.get(`${mode}:${day}`) ?? 0;
                return (
                  <span
                    key={day}
                    title={`${label} · ${day} · ${n}`}
                    className="h-4 flex-1 rounded-[2px]"
                    style={{
                      backgroundColor:
                        n === 0
                          ? "var(--color-surface)"
                          : "var(--color-gold)",
                      opacity: n === 0 ? 0.55 : Math.min(0.45 + n * 0.25, 1),
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-paper-faint">
        {total === 0
          ? "Nothing in the last thirty days."
          : `${total} ${total === 1 ? "entry" : "entries"} over thirty days.`}
      </p>
    </div>
  );
}
