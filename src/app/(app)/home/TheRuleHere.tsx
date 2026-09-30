import { Gutter } from "@/components/ui";

/**
 * The decision rule in force at the address you are looking at.
 *
 * It was invisible. A member at local scale had no way of knowing what bar a
 * proposal has to clear, or how long it sits before it can close — the numbers
 * live in `scope_rules`, which is SQL-only and readable by everyone and read
 * by nobody, because nothing showed it.
 *
 * The copy rule in docs/design-system.md says that where a constraint exists,
 * say what it is and why. This is the constraint every decision here passes
 * through, so it says it, quietly, once, under the scale selector.
 *
 * ON THE ONE-VOICE LINE
 *
 * When `min_voices` is 1 the rule permits one person to decide alone, and that
 * is worth saying in those words rather than leaving somebody to work it out
 * from a number. It is not a warning and there is no badge on it: a fresh
 * install genuinely should be able to get through a decision on its first day,
 * and whether that is still right is a judgement about who is here — which is
 * a question this product cannot answer, because a place has no register
 * (rule 15). So it states the rule and leaves the judgement where it belongs.
 */
export function TheRuleHere({
  scope,
  minVoices,
  threshold,
  deliberationDays,
}: {
  scope: string;
  minVoices: number;
  threshold: number;
  deliberationDays: number;
}) {
  const voices = minVoices === 1 ? "one voice" : `${minVoices} voices`;
  const wait =
    deliberationDays === 0
      ? "no waiting period"
      : deliberationDays === 1
        ? "a day of deliberation first"
        : `${deliberationDays} days of deliberation first`;

  return (
    <Gutter>
      <p className="border-b border-line-soft pb-3 pt-3 text-sm leading-relaxed text-paper-faint">
        At {scope} scale a proposal passes on {voices} at{" "}
        <span className="nums">{threshold.toFixed(3)}</span> alignment or above,
        with {wait}.
        {minVoices === 1 ? (
          <>
            {" "}
            <span className="text-paper-dim">
              Which means one person can decide alone.
            </span>{" "}
            That is the setting a new install starts on so a group can get
            through something on its first day. Raising it is a line of SQL
            against <span className="nums">scope_rules</span>.
          </>
        ) : null}
      </p>
    </Gutter>
  );
}
