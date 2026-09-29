"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { enactAmendment } from "@/app/(app)/collective/actions";
import { Button, Card, Tag } from "@/components/ui";
import type { AmendmentStanding, PastRefusal } from "@/lib/types";

/**
 * A proposal that rewrites a Universal Law.
 *
 * The panel's job is to make the weight obvious without dressing it up. Three
 * things it insists on saying:
 *
 *   - what the law says now, next to what it would say, in full. Nobody should
 *     have to click to see what they are changing.
 *   - that the bar is on the LOWEST voice. A mean would let a strong majority
 *     carry a constitution over a minority's objection, which is the thing a
 *     constitution exists to stop happening to a minority.
 *   - what this law has already refused. No function can tell you whether a
 *     rewording would permit something it previously forbade — that is a
 *     reading, and a machine claiming to do it would be the most dangerous
 *     thing in this codebase. So the history goes on the table and people
 *     decide with it in front of them.
 */
export function Amendment({
  proposalId,
  standing,
  lawName,
  currentText,
  refusals,
  canEnact,
}: {
  proposalId: string;
  standing: AmendmentStanding;
  lawName: string;
  currentText: string;
  refusals: PastRefusal[];
  canEnact: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const lowest = standing.lowest_voice;
  const clears = lowest !== null && lowest >= standing.threshold;

  return (
    <div className="space-y-4">
      <Card className="border-gold-dim bg-gold-wash">
        <p className="text-[0.95rem] leading-relaxed text-paper">
          This rewrites <strong>{lawName}</strong>, the{" "}
          {standing.current_revision > 1
            ? `${standing.current_revision}${standing.current_revision === 2 ? "nd" : "th"} revision of a`
            : "shipped text of a"}{" "}
          Universal Law. It applies to everybody, everywhere, from the moment it
          is enacted.
        </p>
      </Card>

      <div>
        <p className="smallcaps mb-2 text-[10px] text-paper-faint">as it reads now</p>
        <Card>
          <p className="text-[0.95rem] leading-relaxed text-paper-dim" data-selectable>
            {currentText}
          </p>
        </Card>
      </div>

      <div>
        <p className="smallcaps mb-2 text-[10px] text-paper-faint">as it would read</p>
        <Card className="border-gold-dim">
          <p className="text-[0.95rem] leading-relaxed text-paper" data-selectable>
            {standing.proposed_text}
          </p>
          <p className="mt-3 border-t border-line pt-3 text-[0.875rem] leading-relaxed text-paper-dim">
            <span className="smallcaps text-[10px] text-paper-faint">
              what a violation would look like
            </span>
            <br />
            {standing.proposed_violation}
          </p>
        </Card>
      </div>

      {/* ------------------------------------------------- the reading list */}
      {refusals.length ? (
        <div>
          <p className="smallcaps mb-2 text-[10px] text-paper-faint">
            what this law has already refused — {refusals.length}
          </p>
          <ul className="space-y-2">
            {refusals.map((r) => (
              <li key={r.proposal_id}>
                <Card>
                  <Link
                    href={`/collective/proposals/${r.proposal_id}`}
                    className="text-[0.95rem] text-paper hover:text-gold"
                  >
                    {r.title}
                  </Link>
                  <p className="mt-1 text-[0.875rem] leading-relaxed text-paper-dim">
                    {r.reasoning}
                  </p>
                  <p className="smallcaps mt-1 text-[10px] text-paper-faint">
                    under revision {r.law_revision}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[0.8125rem] leading-relaxed text-paper-faint">
            These are the proposals this law has killed. Nothing here says the
            new wording would let them through — that is a reading, and no
            function in this app is going to pretend it can make it. Read them
            and decide whether you still want them stopped. Sometimes the answer
            is that the group was wrong before, and that is exactly what the
            tenth law is for.
          </p>
        </div>
      ) : null}

      {/* ------------------------------------------------------- the bar */}
      <Card>
        <p className="text-[0.95rem] leading-relaxed text-paper-dim">
          An amendment needs <strong>every single voice</strong> at{" "}
          {standing.threshold.toFixed(3)} or above — not an average of it. One
          person below the line stops it.
        </p>

        {standing.voices ? (
          <p className="mt-3 text-[0.9375rem] text-paper">
            {standing.voices} {standing.voices === 1 ? "voice" : "voices"} ·
            lowest {lowest?.toFixed(2) ?? "—"} ·{" "}
            {clears ? (
              <Tag tone="calm">clears the bar</Tag>
            ) : (
              <Tag tone="alarm">does not clear it</Tag>
            )}
          </p>
        ) : (
          <p className="mt-3 text-[0.875rem] text-paper-faint">
            Nothing is revealed until it closes.
          </p>
        )}
      </Card>

      {error ? <p className="text-[0.85rem] text-alarm">{error}</p> : null}

      {standing.enacted ? (
        <p className="text-[0.9375rem] leading-relaxed text-paper">
          Enacted. The law now reads as above, and every audit from here runs
          against it.
        </p>
      ) : standing.passed && canEnact ? (
        <div className="space-y-2">
          <Button
            tone="gold"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const res = await enactAmendment(proposalId);
                if (!res.ok) setError(res.error);
              })
            }
          >
            {pending ? "…" : "Enact it"}
          </Button>
          <p className="text-[0.8125rem] leading-relaxed text-paper-faint">
            Passing is not enacting. This is the separate act that changes the
            constitution, and the database checks the bar again rather than
            trusting that whoever closed it applied one.
          </p>
        </div>
      ) : null}
    </div>
  );
}
