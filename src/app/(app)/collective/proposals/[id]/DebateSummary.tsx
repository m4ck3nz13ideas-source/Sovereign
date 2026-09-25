"use client";

import { useState, useTransition } from "react";

import { Button, Card, Tag } from "@/components/ui";
import { ago } from "@/lib/format";
import type { DebateSummary as Summary } from "@/lib/types";

import { summariseThread } from "../../actions";

/**
 * The debate summary.
 *
 *   "AI periodically summarizes debates to reduce noise."
 *
 * Not periodically — on request. A summary is an artefact with a version on
 * it, and one written at 3am by a timer is one nobody asked for and nobody can
 * date to a moment in the argument.
 *
 * It carries the number of contributions it was written across, so a summary
 * made over nine and then left while six more arrive is visibly stale rather
 * than quietly wrong.
 */

const POLARIZATION: Record<
  Summary["polarization"],
  { label: string; tone: "calm" | "neutral" | "alarm"; note: string }
> = {
  converging: {
    label: "converging",
    tone: "calm",
    note: "People are addressing each other's actual points. The disagreement is getting more precise, which is what a working argument looks like.",
  },
  mixed: {
    label: "mixed",
    tone: "neutral",
    note: "A range of views, put reasonably, without much engagement between them. Most healthy threads look like this.",
  },
  splitting: {
    label: "splitting",
    tone: "alarm",
    note: "The argument has stopped addressing itself — positions are being restated rather than argued. A group that knows it is splitting can do something about it.",
  },
};

export function DebateSummary({
  proposalId,
  summary,
  contributions,
  canRun,
}: {
  proposalId: string;
  summary: Summary | null;
  /** How many contributions there are now, against what the summary covered. */
  contributions: number;
  canRun: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const stale = summary ? contributions > summary.covers : false;
  const behind = summary ? contributions - summary.covers : 0;

  const run = (
    <>
      {canRun ? (
        <Button
          type="button"
          tone="quiet"
          disabled={pending || contributions < 2}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await summariseThread(proposalId);
              if (!r.ok) setError(r.error);
            })
          }
        >
          {pending
            ? "Reading the thread"
            : summary
              ? "Read it again"
              : "Summarise the thread"}
        </Button>
      ) : null}
      {error ? <p className="mt-2 text-sm text-alarm">{error}</p> : null}
    </>
  );

  if (!summary) {
    return (
      <div>
        <p className="mb-3 text-sm leading-relaxed text-paper-faint">
          {contributions < 2
            ? "Two contributions is the floor for a summary. There is nothing to reduce yet."
            : "Nobody has summarised this thread. Run it when it has got long enough that people are starting not to read it."}
        </p>
        {run}
      </div>
    );
  }

  const pol = POLARIZATION[summary.polarization];

  return (
    <div className="space-y-4">
      <Card className={summary.polarization === "splitting" ? "border-alarm/40" : undefined}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-serif text-lg text-paper">What is being argued</h3>
          <Tag tone={pol.tone}>{pol.label}</Tag>
        </div>

        <p className="mt-3 whitespace-pre-wrap text-[0.95rem] leading-relaxed text-paper-dim">
          {summary.reading}
        </p>

        <p className="mt-3 border-t border-line pt-3 text-sm leading-relaxed text-paper-faint">
          {pol.note} This is a reading of the argument, not of anyone&rsquo;s
          resonance — those are hidden until this closes, including from the
          model that wrote this.
        </p>

        {summary.model === "mock" ? (
          <p className="mt-3 rounded-md border border-gold-dim bg-gold-wash px-3 py-2 text-sm leading-relaxed text-paper-dim">
            No model read this thread. The offline reader counted what it could
            and refused to put words in anybody&rsquo;s mouth, which is why the
            arguments below are empty.
          </p>
        ) : null}

        <p className="smallcaps mt-4 text-[10px] text-paper-faint">
          {summary.prompt_id} v{summary.prompt_version} · {summary.model} ·
          across {summary.covers}{" "}
          {summary.covers === 1 ? "contribution" : "contributions"} ·{" "}
          {ago(summary.created_at)}
        </p>
      </Card>

      {stale ? (
        <p className="text-sm leading-relaxed text-paper-faint">
          {behind} more {behind === 1 ? "contribution has" : "contributions have"}{" "}
          arrived since this was written. It is not wrong, it is behind.
        </p>
      ) : null}

      {summary.arguments_for.length || summary.arguments_against.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Side title="The case for" points={summary.arguments_for} />
          <Side title="The case against" points={summary.arguments_against} />
        </div>
      ) : null}

      {summary.shifted ? (
        <Card>
          <h3 className="smallcaps mb-2 text-[11px] text-paper-faint">
            What moved
          </h3>
          <p className="text-[0.95rem] leading-relaxed text-paper-dim">
            {summary.shifted}
          </p>
        </Card>
      ) : null}

      {summary.unresolved.length ? (
        <Card className="border-gold-dim">
          <h3 className="smallcaps mb-2 text-[11px] text-paper-faint">
            Nobody has taken these up
          </h3>
          <ul className="space-y-1.5">
            {summary.unresolved.map((u, i) => (
              <li key={i} className="text-[0.95rem] leading-relaxed text-paper">
                — {u}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {run}
    </div>
  );
}

function Side({
  title,
  points,
}: {
  title: string;
  points: { point: string; from: string }[];
}) {
  return (
    <Card>
      <h3 className="smallcaps mb-3 text-[11px] text-paper-faint">{title}</h3>
      {points.length ? (
        <ul className="space-y-3">
          {points.map((p, i) => (
            <li key={i}>
              <p className="text-[0.95rem] leading-relaxed text-paper-dim">
                {p.point}
              </p>
              {p.from ? (
                <p className="smallcaps mt-1 text-[10px] text-paper-faint">
                  {p.from}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-relaxed text-paper-faint">
          Nothing on this side.
        </p>
      )}
    </Card>
  );
}
