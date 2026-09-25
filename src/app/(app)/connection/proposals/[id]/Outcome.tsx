import Link from "next/link";

import { Card, Empty, ScoreBar, Tag } from "@/components/ui";
import { shortDate } from "@/lib/format";
import type { Decision } from "@/lib/types";

/**
 * The outcome layer.
 *
 * Shows the decision, the numbers it was made on, the rationale written at the
 * time, and every member's resonance with their note — all of it only after
 * the proposal closed. Before that this section says so and nothing else.
 */
export function Outcome({
  decision,
  activated,
  proposalId,
  thresholds,
  minVoices,
  votes,
}: {
  decision: Decision | null;
  /** Whether the proposal has moved past 'passed' into a live project. */
  activated: boolean;
  proposalId: string;
  thresholds: { alignment: number; participation: number };
  /**
   * The floor this scale required, for a proposal addressed to a place. Null
   * for a group proposal, which has a participation share instead.
   */
  minVoices: number | null;
  votes: {
    name: string;
    alignment: number;
    confidence: number;
    urgency: number;
    note: string | null;
  }[];
}) {
  if (!decision) {
    return (
      <Empty>
        No decision yet. When this closes, the group&rsquo;s numbers, the
        rationale and everyone&rsquo;s resonance appear here at once.
      </Empty>
    );
  }

  const passed = decision.outcome === "passed";

  return (
    <div className="space-y-4">
      <Card className={passed ? "border-calm/40" : "border-alarm/40"}>
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-serif text-xl text-paper">
            {passed ? "Passed" : "Did not pass"}
          </h3>
          <Tag tone={passed ? "calm" : "alarm"}>
            {shortDate(decision.decided_at)}
          </Tag>
        </div>

        {decision.rationale_summary ? (
          <p className="mt-3 whitespace-pre-wrap text-[0.95rem] leading-relaxed text-paper-dim">
            {decision.rationale_summary}
          </p>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-paper-faint">
            The rationale was not written — the decision stands, but the record
            is thinner than it should be.
          </p>
        )}

        <div className="mt-5 grid gap-3.5 border-t border-line pt-4 sm:grid-cols-2">
          <ScoreBar
            label="Alignment"
            value={decision.avg_alignment === null ? null : Number(decision.avg_alignment)}
            critical={
              decision.avg_alignment !== null &&
              Number(decision.avg_alignment) < thresholds.alignment
            }
            hint={`threshold ${thresholds.alignment.toFixed(2)}`}
          />
          {decision.participation === null ? (
            // No register, so no share. The honest number is the count, and
            // the floor it had to clear.
            <div>
              <p className="smallcaps text-[10px] text-paper-faint">Voices</p>
              <p className="mt-1 text-[0.95rem] tabular-nums text-paper">
                {decision.voter_count}
                {minVoices ? (
                  <span className="text-paper-faint">
                    {" "}
                    · this scale needs {minVoices}
                  </span>
                ) : null}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-paper-faint">
                A count rather than a share — there is no register of everyone
                here, and a percentage of a population nobody counted would be
                a made-up number.
              </p>
            </div>
          ) : (
            <ScoreBar
              label="Participation"
              value={Number(decision.participation)}
              critical={Number(decision.participation) < thresholds.participation}
              hint={`${decision.voter_count} of ${decision.member_count} · threshold ${thresholds.participation.toFixed(2)}`}
            />
          )}
          <ScoreBar
            label="Confidence"
            value={decision.avg_confidence === null ? null : Number(decision.avg_confidence)}
          />
          <ScoreBar
            label="Urgency"
            value={decision.avg_urgency === null ? null : Number(decision.avg_urgency)}
          />
        </div>

        {/* A mean says nothing about a split. Everyone at 0.50 and half at
            0.10 with half at 0.90 both average 0.50, and they are not the same
            group — the first is unsure, the second disagrees. A system that
            reports them identically launders a rift into a consensus. */}
        {decision.dispersion !== null ? (
          <div
            className={`mt-4 rounded-md border px-3 py-2.5 ${
              decision.polarized
                ? "border-alarm/40 bg-alarm/10"
                : "border-line bg-surface"
            }`}
          >
            <p className="text-[0.95rem] leading-relaxed text-paper">
              {decision.polarized
                ? `The group was split. Spread ${Number(decision.dispersion).toFixed(2)}, with people at both ends.`
                : `Spread ${Number(decision.dispersion).toFixed(2)} — the responses sat close together.`}
            </p>
            {decision.polarized ? (
              <p className="mt-1 text-sm leading-relaxed text-paper-dim">
                {passed
                  ? "This passed, and the threshold is the threshold. But the mean above describes two groups rather than one, and anyone reading this later should know that."
                  : "Not a room that was unsure. A room that disagreed."}
              </p>
            ) : null}
          </div>
        ) : null}

        {decision.open_questions || decision.open_concerns ? (
          <p className="mt-3 text-sm leading-relaxed text-paper-faint">
            {[
              decision.open_questions
                ? `${decision.open_questions} ${decision.open_questions === 1 ? "question" : "questions"}`
                : null,
              decision.open_concerns
                ? `${decision.open_concerns} ${decision.open_concerns === 1 ? "concern" : "concerns"}`
                : null,
            ]
              .filter(Boolean)
              .join(" and ")}{" "}
            were unanswered when this closed. Nobody was blocked by them —
            they are recorded because the group decided with them open.
          </p>
        ) : null}

        {decision.prompt_version ? (
          <p className="smallcaps mt-4 text-[10px] text-paper-faint">
            rationale written by decision.rationale v{decision.prompt_version}
          </p>
        ) : null}
      </Card>

      {votes.length ? (
        <Card>
          <h3 className="smallcaps mb-4 text-[11px] text-paper-faint">
            How each member responded
          </h3>
          <ul className="space-y-4">
            {votes.map((v, i) => (
              <li key={i} className="border-b border-line pb-4 last:border-0 last:pb-0">
                <p className="text-[0.95rem] text-paper">{v.name}</p>
                <p className="mt-1 text-sm tabular-nums text-paper-dim">
                  alignment {v.alignment.toFixed(2)} · confidence{" "}
                  {v.confidence.toFixed(2)} · urgency {v.urgency.toFixed(2)}
                </p>
                {v.note ? (
                  <p className="mt-1.5 text-sm leading-relaxed text-paper-dim">
                    &ldquo;{v.note}&rdquo;
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {passed ? (
        activated ? (
          <Link
            href={`/connection/projects/${proposalId}`}
            className="smallcaps inline-block text-[11px] text-gold hover:underline"
          >
            Go to the project →
          </Link>
        ) : (
          <p className="text-sm leading-relaxed text-paper-faint">
            Ratified, but not yet under way. It becomes a project once the
            resources and people it needs have been committed — see Activate
            below.
          </p>
        )
      ) : (
        <p className="text-sm leading-relaxed text-paper-faint">
          A proposal that did not pass is not amended and resubmitted. If the
          group still wants the thing, it is written again as a new proposal,
          with what was learned here in it.
        </p>
      )}
    </div>
  );
}
