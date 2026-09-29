"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { markProjection } from "@/app/(app)/collective/actions";
import { Button, Card, cx, inputClass } from "@/components/ui";
import type { DueProjection } from "@/lib/types";

/**
 * What has come due and nobody has marked.
 *
 * This is the part of the loop that normally does not happen. A group predicts
 * things, decides, executes, and then never goes back — so the predictions
 * turn into decoration retroactively, which is the same outcome as never
 * having made them.
 *
 * Oldest first, because the longer a claim sits unmarked the less anybody
 * remembers what was meant by it, and a verdict written from a dim memory is
 * worse than no verdict at all.
 */
export function DueList({ items }: { items: DueProjection[] }) {
  return (
    <ul className="space-y-3">
      {items.map((d) => (
        <li key={d.projection_id}>
          <DueRow item={d} />
        </li>
      ))}
    </ul>
  );
}

function DueRow({ item }: { item: DueProjection }) {
  const [pending, start] = useTransition();
  const [verdict, setVerdict] = useState<"held" | "missed" | "unclear" | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) return null;

  return (
    <Card>
      <p className="text-[0.95rem] leading-relaxed text-paper" data-selectable>
        {item.statement}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Link
          href={`/collective/proposals/${item.proposal_id}`}
          className="smallcaps text-[10px] text-paper-faint hover:text-gold"
        >
          {item.title}
        </Link>
        <span className="smallcaps text-[10px] text-paper-faint">
          · {item.direction}
          {item.confidence !== null ? ` at ${item.confidence.toFixed(2)}` : ""}
        </span>
        <span className="smallcaps text-[10px] text-alarm">
          · due {item.days_overdue === 0 ? "today" : `${item.days_overdue} days ago`}
        </span>
      </div>

      <div className="mt-3 flex gap-2">
        {(["held", "missed", "unclear"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setVerdict(v)}
            className={cx(
              "press rounded-pill px-3 py-1.5 text-[0.8125rem] font-medium",
              v === verdict ? "bg-paper text-ink" : "bg-surface text-paper-dim",
            )}
          >
            {v}
          </button>
        ))}
      </div>

      {verdict ? (
        <div className="mt-3 space-y-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="What actually happened, in your own words."
            className={inputClass}
          />
          {error ? <p className="text-[0.85rem] text-alarm">{error}</p> : null}
          <p className="text-[0.8125rem] leading-relaxed text-paper-faint">
            Written once, attributed to you, and not editable afterwards.
          </p>
          <Button
            tone="gold"
            disabled={pending || note.trim().length < 20}
            onClick={() =>
              start(async () => {
                const res = await markProjection(item.projection_id, verdict, note);
                if (!res.ok) setError(res.error);
                else setDone(true);
              })
            }
          >
            {pending ? "Recording…" : "Record it"}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
