import { AiError, type AiProvider } from "./provider";

/**
 * The adapter used when ANTHROPIC_API_KEY is absent.
 *
 * It is deliberately not a stub that returns lorem ipsum. It produces a
 * plausible, deterministic reading of the actual input so that the whole loop —
 * review, flags, resolution, resonance, decision, reflection — can be walked
 * end to end, in tests and in a demo, without a key or a bill.
 *
 * It is also honest about what it is: every artefact it writes records the
 * model as "mock", and the UI labels those reviews as unread by any model.
 */
export class MockProvider implements AiProvider {
  readonly name = "mock";
  readonly live = false;

  async complete({
    input,
    schemaName,
  }: {
    input: string;
    schemaName: string;
  }): Promise<{ data: unknown; model: string }> {
    const text = input.toLowerCase();

    switch (schemaName) {
      case "record_law_audit":
        return { data: this.lawAudit(input), model: "mock" };
      case "record_review":
        return { data: this.review(input, text), model: "mock" };
      case "record_rationale":
        return { data: this.rationale(text), model: "mock" };
      case "record_reflection":
        return { data: this.reflection(input), model: "mock" };
      case "record_synthesis":
        return { data: this.synthesis(input), model: "mock" };
      default:
        throw new AiError(`The mock provider has no response for ${schemaName}.`);
    }
  }

  /* ----------------------------------------------------------------------- */

  /**
   * The offline Universal Law audit.
   *
   * It returns `aligned` for every law and says why in plain terms. That is a
   * deliberate choice, not laziness: this reviewer cannot read, and a
   * structural guess that returned `violation` would permanently invalidate a
   * proposal on the strength of a regular expression. Under-blocking here is
   * recoverable — someone sets a key and runs the audit again. Over-blocking
   * is not, because the whole point of the law layer is that its verdicts
   * cannot be overridden.
   *
   * Every reading says, in the text a member will read, that no model examined
   * it. The UI marks the audit as unread as well, so nobody mistakes this for
   * a constitutional clearance.
   */
  private lawAudit(input: string) {
    const ids = [...input.matchAll(/^\s*id: ([a-z_]+)$/gm)].map((m) => m[1]);

    return {
      readings: ids.map((law_id) => ({
        law_id,
        verdict: "aligned" as const,
        reasoning:
          "No model read this proposal — ANTHROPIC_API_KEY is not set, so the offline reviewer answered. It cannot weigh a proposal against a law, so it records no objection rather than inventing one: a violation it guessed at would invalidate this proposal permanently, and nothing here could overturn it. Treat this as unexamined, not as cleared. Set a key and run the audit again before relying on it.",
      })),
    };
  }

  private review(input: string, text: string) {
    // Values are passed to the prompt as "- <name>: <definition>" lines.
    const values = [...input.matchAll(/^- ([^:\n]+):/gm)].map((m) => m[1].trim());

    const hasNumbers = /[£$€]\s?\d|(\d+\s*(%|per cent))/.test(text);
    const hasEvidence = /(because|evidence|we found|last time|data|measured|survey)/.test(text);
    const isReversible = /(trial|pilot|for (a|one|two|three|six) (week|month)|temporar|revisit|review after)/.test(text);
    const isBig = /(permanent|forever|contract|lease|hire|sell|buy|commit)/.test(text);

    const length = input.length;

    const clarity = clamp(0.35 + Math.min(length, 1600) / 3200 + (hasNumbers ? 0.15 : 0));
    const evidence = clamp(hasEvidence ? 0.62 : 0.28);
    const feasibility = clamp(hasNumbers ? 0.66 : 0.48);
    const reversibility = clamp(isReversible ? 0.82 : isBig ? 0.24 : 0.55);

    // Give each value a deterministic score derived from the text, so the same
    // proposal always reviews the same way. One value is pushed below the
    // critical floor when the proposal spends money without justifying it, so
    // the flag-answering path is exercisable without a key.
    const values_alignment: Record<string, number> = {};
    values.forEach((name, i) => {
      const base = 0.45 + (hash(name + length) % 45) / 100;
      const penalised = hasNumbers && !hasEvidence && i === 0 ? 0.28 : base;
      values_alignment[name] = round(penalised);
    });

    const risks: { title: string; severity: "low" | "medium" | "high"; note: string }[] = [];
    if (hasNumbers && !hasEvidence) {
      risks.push({
        title: "The cost is stated but not justified",
        severity: "high",
        note: "There is a number in the proposal and no working behind it. If the estimate is wrong there is nothing here that would reveal it before the money is spent.",
      });
    }
    if (isBig && !isReversible) {
      risks.push({
        title: "Hard to undo",
        severity: "high",
        note: "As written this commits the group with no stated point at which it could be stopped.",
      });
    }
    if (!hasEvidence) {
      risks.push({
        title: "Rests on an untested assumption",
        severity: "medium",
        note: "The central claim is asserted rather than shown. It may well be right; nothing here would tell the group if it were not.",
      });
    }

    const questions = [
      hasNumbers
        ? "Where does the figure come from, and what happens if it is out by half?"
        : "What would this cost, in money and in someone's time?",
      "What would tell us within a month that this is not working?",
      isReversible ? null : "What is the smallest version of this that could be tried first?",
    ].filter((q): q is string => Boolean(q));

    return {
      clarity: round(clarity),
      evidence: round(evidence),
      feasibility: round(feasibility),
      reversibility: round(reversibility),
      values_alignment,
      risks,
      questions,
      memory_used: [],
      summary:
        "This review was generated without a model — ANTHROPIC_API_KEY is not set, so Sovereign fell back to its offline reviewer. The scores come from simple signals in the text (whether costs are given, whether claims are supported, whether the commitment is reversible) and are here to make the loop walkable, not to be relied on. Set a key and run the review again for a real reading.",
    };
  }

  private rationale(text: string) {
    const passed = text.includes("outcome: passed");
    return {
      rationale: passed
        ? "Recorded without a model. The proposal met the group's participation and alignment thresholds with no unresolved critical flag, and so passed. Set ANTHROPIC_API_KEY and re-run to get a written rationale that engages with what was actually argued."
        : "Recorded without a model. The proposal did not meet the group's decision rule — either participation or mean alignment fell short, or a critical flag was left unanswered. Set ANTHROPIC_API_KEY and re-run for a rationale that names the objection.",
    };
  }

  private reflection(input: string) {
    const count = (input.match(/^---$/gm) ?? []).length;
    if (count < 2) {
      return { question: "", rationale: "" };
    }
    return {
      question: "What has stayed the same across these entries, that you have not written down?",
      rationale: `Offline reflection: ${count} unexamined entries, no model reading them. Set ANTHROPIC_API_KEY for a question drawn from what you actually wrote.`,
    };
  }

  private synthesis(input: string) {
    const count = (input.match(/^---$/gm) ?? []).length;
    if (count < 2) {
      return { question: "", rationale: "", suggested_title: "", discipline: "" };
    }
    return {
      question: "You have several ideas in the inbox and no model to read them. Is there a thread here worth naming yourself?",
      rationale: `Offline synthesis: ${count} idea entries waiting. Set ANTHROPIC_API_KEY to have them read.`,
      suggested_title: "",
      discipline: "",
    };
  }
}

function clamp(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) % 100000;
  }
  return h;
}
