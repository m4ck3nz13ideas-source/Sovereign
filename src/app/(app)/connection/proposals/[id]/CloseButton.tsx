"use client";

import { useState, useTransition } from "react";

import { Button, Card } from "@/components/ui";

import { closeProposal } from "../../actions";

/**
 * Closing a proposal.
 *
 * The button does not decide anything — the database applies the rule. What
 * this does is show the steward, before they click, exactly what the rule is
 * about to say, so closing is never a surprise.
 */
export function CloseButton({
  proposalId,
  lawViolations,
  lawTensions,
  unanswered,
  voters,
  members,
  thresholds,
}: {
  proposalId: string;
  /** Violations of Universal Law. Any at all and the proposal cannot pass. */
  lawViolations: number;
  /** Tensions left unanswered. Same effect, but answerable. */
  lawTensions: number;
  unanswered: number;
  voters: number;
  members: number;
  thresholds: { alignment: number; participation: number };
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const participation = members > 0 ? voters / members : 0;
  const participationShort = participation < thresholds.participation;

  const willFail =
    lawViolations > 0 || lawTensions > 0 || unanswered > 0 || participationShort;

  if (!confirming) {
    return (
      <Button type="button" tone="quiet" onClick={() => setConfirming(true)}>
        Close this proposal
      </Button>
    );
  }

  return (
    <Card className="border-gold-dim">
      <h3 className="font-serif text-lg text-paper">Close it now?</h3>

      <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-paper-dim">
        <li className={lawViolations > 0 ? "text-alarm" : undefined}>
          {lawViolations === 0
            ? "No violation of Universal Law"
            : `${lawViolations} violation${lawViolations === 1 ? "" : "s"} of Universal Law — this cannot pass, and closing it now records that`}
        </li>
        <li className={lawTensions > 0 ? "text-alarm" : undefined}>
          {lawTensions === 0
            ? "No unanswered tension with Universal Law"
            : `${lawTensions} unanswered tension${lawTensions === 1 ? "" : "s"} with Universal Law`}
        </li>
        <li>
          {voters} of {members} responded ({participation.toFixed(2)}), threshold{" "}
          {thresholds.participation.toFixed(2)}
          {participationShort ? " — short" : ""}
        </li>
        <li>
          {unanswered === 0
            ? "No unanswered critical flags"
            : `${unanswered} unanswered critical ${unanswered === 1 ? "flag" : "flags"} — this alone fails it`}
        </li>
        <li>
          Mean alignment is checked against {thresholds.alignment.toFixed(2)}.
          The numbers are hidden until the moment you close, including from you.
        </li>
      </ul>

      {willFail ? (
        <p className="mt-3 rounded-md border border-alarm/40 bg-alarm/10 px-3 py-2.5 text-sm leading-relaxed text-alarm">
          As things stand this will not pass. That is a legitimate outcome —
          but if the group has more to say, or a flag can still be answered,
          closing now records a failure that did not have to happen.
        </p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-alarm">{error}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await closeProposal(proposalId);
              if (!r.ok) setError(r.error);
              else setConfirming(false);
            })
          }
        >
          {pending ? "Closing" : "Apply the decision rule"}
        </Button>
        <Button type="button" tone="ghost" onClick={() => setConfirming(false)}>
          Not yet
        </Button>
      </div>
    </Card>
  );
}
