"use client";

import { useState, useTransition } from "react";

import { Button, Card, Tag, inputClass } from "@/components/ui";
import { shortDate } from "@/lib/format";
import type { ProposalFlag } from "@/lib/types";

import { answerFlag } from "../../actions";

/**
 * Critical flags.
 *
 * A flag cannot be dismissed, only answered — in writing, attributed and
 * timestamped, naming what changed or why the risk is acceptable. The database
 * enforces the same rule, so this is a UI for a constraint rather than the
 * constraint itself.
 *
 * This is the mechanism that lets a weak proposal be retired early without
 * anyone having to be the person who objected.
 */
export function FlagList({
  flags,
  canAnswer,
}: {
  flags: (ProposalFlag & { profiles: { display_name: string } | null })[];
  canAnswer: boolean;
}) {
  return (
    <ul className="space-y-3">
      {flags.map((flag) => (
        <li key={flag.id}>
          <FlagCard flag={flag} canAnswer={canAnswer} />
        </li>
      ))}
    </ul>
  );
}

function FlagCard({
  flag,
  canAnswer,
}: {
  flag: ProposalFlag & { profiles: { display_name: string } | null };
  canAnswer: boolean;
}) {
  const [answering, setAnswering] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const answered = Boolean(flag.resolved_at);

  return (
    <Card className={answered ? "" : "border-alarm/40"}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.95rem] leading-snug text-paper">{flag.label}</p>
        <Tag tone={answered ? "calm" : "alarm"}>
          {answered ? "answered" : flag.kind === "values" ? "values" : "risk"}
        </Tag>
      </div>

      {flag.detail ? (
        <p className="mt-1.5 text-sm leading-relaxed text-paper-dim">{flag.detail}</p>
      ) : null}

      {answered ? (
        <div className="mt-3.5 border-t border-line pt-3.5">
          <p className="text-sm leading-relaxed text-paper">{flag.resolution}</p>
          <p className="smallcaps mt-2 text-[10px] text-paper-faint">
            {flag.profiles?.display_name ?? "a member"} ·{" "}
            {flag.resolved_at ? shortDate(flag.resolved_at) : ""}
          </p>
        </div>
      ) : canAnswer ? (
        answering ? (
          <div className="mt-3.5 space-y-3 border-t border-line pt-3.5">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              autoFocus
              placeholder="What changed in the proposal, or why this risk is acceptable here. This goes on the record with your name on it."
              className={`${inputClass} resize-y leading-relaxed`}
            />
            {error ? <p className="text-sm text-alarm">{error}</p> : null}
            <div className="flex gap-2">
              <Button
                type="button"
                disabled={pending || text.trim().length < 20}
                onClick={() =>
                  start(async () => {
                    setError(null);
                    const r = await answerFlag(flag.id, text);
                    if (!r.ok) setError(r.error);
                    else setAnswering(false);
                  })
                }
              >
                {pending ? "Recording" : "Answer it"}
              </Button>
              <Button type="button" tone="ghost" onClick={() => setAnswering(false)}>
                Cancel
              </Button>
            </div>
            <p className="text-xs text-paper-faint">
              At least twenty characters. There is no way to dismiss a flag —
              answering it is the only move, and the answer stays on the record
              whichever way the decision goes.
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAnswering(true)}
            className="smallcaps mt-3.5 text-[11px] text-gold hover:underline"
          >
            Answer this
          </button>
        )
      ) : (
        <p className="smallcaps mt-3.5 text-[10px] text-paper-faint">
          left unanswered
        </p>
      )}
    </Card>
  );
}
