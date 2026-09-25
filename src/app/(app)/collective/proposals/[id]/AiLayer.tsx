import { Card, ScoreBar, Tag } from "@/components/ui";
import type { ProposalReview } from "@/lib/types";

/**
 * What the review found.
 *
 * Presented as a reading, not a verdict. The four qualities are one block, the
 * values another, the risks a third, and the questions last — because the
 * questions are the part a group should actually act on.
 *
 * Every panel carries the prompt version and model. A member who distrusts a
 * score can go and read the rubric that produced it.
 */
export function AiLayer({
  review,
  floor,
}: {
  review: ProposalReview;
  floor: number;
}) {
  const values = Object.entries(review.values_alignment).sort((a, b) => a[1] - b[1]);
  const isMock = review.model === "mock";

  return (
    <div className="space-y-4">
      {isMock ? (
        <p className="rounded-md border border-alarm/40 bg-alarm/10 px-3 py-2.5 text-sm leading-relaxed text-alarm">
          No model read this. It was produced by the offline reviewer because no
          API key is configured — the scores are structural guesses, not a
          reading. Set one and run the review again before relying on any of it.
        </p>
      ) : null}

      {review.summary ? (
        <Card>
          <p className="text-[0.95rem] leading-relaxed text-paper">{review.summary}</p>
        </Card>
      ) : null}

      <Card>
        <h3 className="smallcaps mb-4 text-[11px] text-paper-faint">Qualities</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <ScoreBar label="Clarity" value={review.clarity} hint="Could someone who missed the meeting act on this?" />
          <ScoreBar label="Evidence" value={review.evidence} hint="Are the claims supported?" />
          <ScoreBar label="Feasibility" value={review.feasibility} hint="Can this group actually do it?" />
          <ScoreBar label="Reversibility" value={review.reversibility} hint="How cheaply could it be undone?" />
        </div>
      </Card>

      {values.length ? (
        <Card>
          <h3 className="smallcaps mb-4 text-[11px] text-paper-faint">
            Against the group&rsquo;s values
          </h3>
          <div className="space-y-3.5">
            {values.map(([name, score]) => (
              <ScoreBar
                key={name}
                label={name}
                value={score}
                critical={score < floor}
                hint={score < floor ? `Below the group's floor of ${floor.toFixed(2)} — this has to be answered.` : undefined}
              />
            ))}
          </div>
        </Card>
      ) : null}

      {review.risks.length ? (
        <Card>
          <h3 className="smallcaps mb-4 text-[11px] text-paper-faint">Risks</h3>
          <ul className="space-y-3.5">
            {review.risks.map((risk, i) => (
              <li key={i}>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[0.95rem] leading-snug text-paper">{risk.title}</p>
                  <Tag tone={risk.severity === "high" ? "alarm" : "neutral"}>
                    {risk.severity}
                  </Tag>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-paper-dim">{risk.note}</p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {review.questions.length ? (
        <Card>
          <h3 className="smallcaps mb-4 text-[11px] text-paper-faint">
            Questions to answer first
          </h3>
          <ol className="space-y-2.5">
            {review.questions.map((q, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-4 shrink-0 text-right text-xs tabular-nums text-paper-faint">
                  {i + 1}
                </span>
                <span className="text-[0.95rem] leading-snug text-paper-dim">{q}</span>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      {review.memory_used.length ? (
        <Card>
          <h3 className="smallcaps mb-3 text-[11px] text-paper-faint">
            Past decisions this drew on
          </h3>
          <ul className="space-y-2">
            {review.memory_used.map((m) => (
              <li key={m.decision_id} className="text-sm leading-relaxed text-paper-dim">
                <span className="text-paper">{m.title}</span>
                <span className="text-paper-faint"> — {m.outcome}</span>
                {m.lesson ? <span className="block text-paper-faint">{m.lesson}</span> : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <p className="smallcaps text-[10px] text-paper-faint">
        {review.prompt_id} v{review.prompt_version} · {review.model} ·{" "}
        {review.memory_used.length
          ? `read ${review.memory_used.length} past ${review.memory_used.length === 1 ? "decision" : "decisions"}`
          : "no past decisions bore on this"}
      </p>
    </div>
  );
}
