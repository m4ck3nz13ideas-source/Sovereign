import { cx } from "@/components/ui";
import { proposalProgress, whatHappensNext } from "@/lib/collective";
import type { ProposalStatus } from "@/lib/types";

/**
 * Where this proposal has got to, and what happens next.
 *
 * The question that brings somebody back to a proposal is "what is happening
 * with it?", and until now the only answer was a status tag and a scroll. This
 * draws the path and puts one sentence under it saying what the next step
 * needs — the rule, not a prediction. Nothing here estimates when anything will
 * happen, because nothing in the schema knows, and a date the system made up
 * would be read as a promise.
 */
export function Progress({
  status,
  hasGroup,
  closesAt,
}: {
  status: ProposalStatus;
  hasGroup: boolean;
  closesAt: string | null;
}) {
  const steps = proposalProgress(status);

  return (
    <div className="mb-8">
      <ol className="flex items-start gap-1" aria-label="Where this proposal has got to">
        {steps.map((s) => (
          <li key={s.key} className="min-w-0 flex-1">
            <div
              className={cx(
                "h-[3px] rounded-full",
                s.state === "done" && "bg-paper-dim",
                s.state === "current" &&
                  (status === "failed" ? "bg-alarm" : status === "withdrawn" ? "bg-paper-faint" : "bg-gold"),
                s.state === "ahead" && "bg-line",
              )}
            />
            <p
              className={cx(
                "smallcaps mt-1.5 truncate text-[9px]",
                s.state === "current" ? "text-paper" : "text-paper-faint",
              )}
              aria-current={s.state === "current" ? "step" : undefined}
            >
              {s.label}
            </p>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[0.8125rem] leading-relaxed text-paper-faint">
        {whatHappensNext(status, { hasGroup, closesAt })}
      </p>
    </div>
  );
}
