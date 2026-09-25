import { Card, Tag } from "@/components/ui";
import { SECTION_LABELS } from "@/lib/readiness";
import type { ProposalReadiness } from "@/lib/types";

/**
 * What the draft had to answer before anyone saw it.
 *
 * This is on the page for a reason beyond transparency: the readiness score is
 * produced outside the database, so it is attributable rather than
 * unforgeable. A claimed 0.99 with nothing behind it is visible here, with a
 * name against it, to everyone the proposal was addressed to. That is the same
 * standard as an answered flag, and at this scale it is the honest one.
 */
export function Sharpening({
  readiness,
  threshold,
}: {
  readiness: ProposalReadiness | null;
  threshold: number;
}) {
  if (!readiness) {
    return (
      <p className="text-sm leading-relaxed text-paper-faint">
        This proposal predates the readiness gate, so nothing was recorded.
      </p>
    );
  }

  const score = Number(readiness.readiness);
  const unanswered = readiness.sections.filter((s) => !s.ready);

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-serif text-lg text-paper">Before it was sent</h3>
          <Tag tone={score >= threshold ? "calm" : "alarm"}>
            {score.toFixed(2)} · bar {threshold.toFixed(2)}
          </Tag>
        </div>

        <p className="mt-3 whitespace-pre-wrap text-[0.95rem] leading-relaxed text-paper-dim">
          {readiness.verdict}
        </p>

        {readiness.model === "mock" ? (
          <p className="mt-3 rounded-md border border-gold-dim bg-gold-wash px-3 py-2 text-sm leading-relaxed text-paper-dim">
            No model read this draft. The offline reader judged structure only —
            whether each section is there and whether the costs carry numbers.
          </p>
        ) : null}

        <p className="smallcaps mt-4 text-[10px] text-paper-faint">
          {readiness.prompt_id} v{readiness.prompt_version} · {readiness.model}
        </p>
      </Card>

      {unanswered.length ? (
        <Card className="border-gold-dim">
          <h3 className="smallcaps mb-3 text-[11px] text-paper-faint">
            Still open when it was submitted
          </h3>
          <ul className="space-y-3">
            {unanswered.map((s) => (
              <li key={s.section}>
                <p className="text-[0.95rem] text-paper">
                  {SECTION_LABELS[s.section] ?? s.section}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-paper-dim">
                  {s.note}
                </p>
                {s.questions.length ? (
                  <ul className="mt-1.5 space-y-1">
                    {s.questions.map((q, i) => (
                      <li key={i} className="text-sm leading-relaxed text-paper-faint">
                        — {q}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-paper-faint">
            A proposal can clear the bar overall with a section still open.
            These are the questions to put in the deliberation thread.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
