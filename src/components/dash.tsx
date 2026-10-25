import type { ReactNode } from "react";

/**
 * The pieces the three dashboards are made of (founder, group, personal):
 * stat tiles for single headline numbers, and a one-hue bar list for a
 * funnel or a breakdown. One series each, so no legend; text stays in the
 * text tokens and the gold bar carries the magnitude. Status colours (calm,
 * alarm) appear only on a tile that is saying something needs attention,
 * and always with words, never colour alone.
 *
 * Nothing here ranks, scores or compares people (rules 19, 33): every number
 * a dashboard shows is a count of acts or a state of the record.
 */

export function StatGrid({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">{children}</dl>;
}

export function StatTile({
  label,
  value,
  hint,
  attention = false,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** Something here wants doing. Said in the hint as well as shown. */
  attention?: boolean;
}) {
  return (
    <div
      className={`rounded-card border bg-surface-soft px-3.5 py-3 text-center ${
        attention ? "border-alarm/40" : "border-line"
      }`}
    >
      <dt className="smallcaps text-[10px] text-paper-faint">{label}</dt>
      <dd className="mt-1 font-serif text-[1.625rem] leading-none tabular-nums text-paper">{value}</dd>
      {hint ? <dd className="mt-1.5 text-[0.75rem] leading-snug text-paper-dim">{hint}</dd> : null}
    </div>
  );
}

export interface BarRow {
  label: string;
  value: number;
  /** Optional words after the number, e.g. "of 50". */
  note?: string;
}

/**
 * A horizontal bar per row, scaled to `max` (default: the largest value).
 * Each row carries its number in text, so the bar is never the only way to
 * read it, and the list doubles as its own table.
 */
export function BarList({ rows, max, unit = "" }: { rows: BarRow[]; max?: number; unit?: string }) {
  const top = Math.max(1, max ?? Math.max(0, ...rows.map((r) => r.value)));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const share = Math.max(0, Math.min(1, r.value / top));
        return (
          <li key={r.label} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-3">
            <span className="truncate text-[0.875rem] text-paper">{r.label}</span>
            <span className="h-2 rounded-full bg-surface" aria-hidden>
              <span
                className="block h-2 rounded-full bg-gold"
                style={{ width: `${share > 0 ? Math.max(share * 100, 2) : 0}%` }}
              />
            </span>
            <span className="text-right text-[0.8125rem] tabular-nums text-paper-dim">
              {r.value}
              {unit}
              {r.note ? <span className="text-paper-faint"> {r.note}</span> : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** "3 of 5" with the share, for a step in a funnel. */
export function pct(n: number, of: number): string {
  return of > 0 ? `${Math.round((n / of) * 100)}%` : "—";
}
