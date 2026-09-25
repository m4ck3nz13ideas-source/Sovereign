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
      case "record_debate_summary":
        return { data: this.debate(input), model: "mock" };
      case "record_sharpening":
        return { data: this.sharpen(input), model: "mock" };
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
   * The offline debate summary.
   *
   * It abstains on the arguments and does not abstain on the shape. Those are
   * different jobs: putting words in a member's mouth is not something a
   * regular expression should ever do, but counting who wrote what, what is
   * still unanswered, and whether anybody is replying to anybody is arithmetic
   * — and it is most of what "is this thread going anywhere" means.
   *
   * So: unresolved comes from the thread verbatim, polarization comes from the
   * structure, and the two argument lists come back empty with the reading
   * saying why.
   */
  private debate(input: string) {
    // The thread sits between its heading and the closing note, and each
    // contribution starts with its kind in brackets. Anything before the first
    // bracket in a chunk is framing, not something somebody said.
    const body = input.split("THE THREAD, in order\n").slice(1).join("");
    const blocks = body
      .split(/\n\n---\n\n/)
      .map((b) => {
        const at = b.indexOf("[");
        const cut = at >= 0 ? b.slice(at) : "";
        return cut.split("\nYou cannot see anyone")[0].trim();
      })
      .filter((b) => /^\[[a-z]+\]/.test(b));

    const kindOf = (b: string) => b.match(/^\[([a-z]+)\]/)?.[1] ?? "reply";
    const authorOf = (b: string) => b.match(/^\[[a-z]+\]\s([^—]+)—/)?.[1]?.trim() ?? "a member";
    const firstLine = (b: string) =>
      b.split("\n").slice(1).join(" ").replace(/ANSWERED by[\s\S]*/, "").trim();

    const open = blocks.filter(
      (b) => ["question", "concern"].includes(kindOf(b)) && !b.includes("ANSWERED by"),
    );

    const voices = new Set(blocks.map(authorOf));
    const replies = blocks.filter((b) => kindOf(b) === "reply").length;
    const positions = blocks.filter((b) =>
      ["concern", "alternative"].includes(kindOf(b)),
    ).length;

    // Two or more people, several positions stated, and nobody replying to
    // anybody is the structural signature of a thread that has stopped being a
    // conversation. It is a weak signal and the reading says so.
    const polarization =
      blocks.length >= 4 && replies === 0 && positions >= 2 && voices.size >= 2
        ? ("splitting" as const)
        : replies >= blocks.length / 2 && blocks.length >= 3
          ? ("converging" as const)
          : ("mixed" as const);

    return {
      arguments_for: [],
      arguments_against: [],
      unresolved: open.slice(0, 6).map((b) => firstLine(b).slice(0, 200)),
      shifted: "",
      polarization,
      reading:
        `No model read this thread — ANTHROPIC_API_KEY is not set, so the offline reader answered. ` +
        `It will not put words in anybody's mouth, so the arguments are empty: read the thread. ` +
        `What it can count: ${blocks.length} ${blocks.length === 1 ? "contribution" : "contributions"} ` +
        `from ${voices.size} ${voices.size === 1 ? "person" : "people"}, ` +
        `${open.length} still unanswered, ${replies} ${replies === 1 ? "reply" : "replies"}. ` +
        (polarization === "splitting"
          ? `Several positions have been stated and nobody has replied to anybody, which is what a thread looks like when it has stopped being a conversation. That is a structural guess, not a reading of the argument.`
          : polarization === "converging"
            ? `Most of it is people replying to each other, which is what a working argument looks like from the outside.`
            : `Nothing structural stands out.`),
    };
  }

  /**
   * The offline sharpening pass.
   *
   * Unlike the law audit, this one does judge — and it should. The law audit
   * abstains because a guessed violation is unrecoverable; a draft sent back
   * for more work costs the author ten minutes. So the offline reader is
   * deliberately demanding, and it says plainly which of its objections come
   * from actually reading and which come from counting.
   *
   * What it can see: whether a section exists, whether it is more than a
   * gesture, whether the constraints carry a number, whether the risks name
   * something that could go wrong rather than performing caution, and whether
   * the alternatives consider doing nothing. That is a real filter — it is
   * most of what a weak draft is missing — and it is the honest limit of what
   * a reader without a model can tell you.
   */
  private sharpen(input: string) {
    const section = (name: string): string => {
      const m = input.match(
        new RegExp(`^${name}:\\n([\\s\\S]*?)(?=\\n\\n[a-z]+:|\\n\\nReturn exactly)`, "m"),
      );
      const body = (m?.[1] ?? "").trim();
      return body === "(empty)" || body.startsWith("(none given") ? "" : body;
    };

    const intent = section("intent");
    const change = section("change");
    const constraints = section("constraints");
    const risks = section("risks");
    const alternatives = section("alternatives");
    const evidence = section("evidence");

    const vague =
      /\b(improve|explore|look into|support|enhance|optimi[sz]e|better|more effective|as needed|etc\.?)\b/i;
    const hasNumber = /[£$€]\s?\d|\b\d+\s*(hours?|days?|weeks?|months?|people|%)/i;
    const namesNothing = /\b(nothing|no risks?|none|n\/a)\b/i;
    const considersDoingNothing = /\b(do nothing|doing nothing|leave it|status quo|as (we|things) are)\b/i;

    const readings = [
      {
        section: "intent" as const,
        ready: intent.length >= 100 && !vague.test(intent),
        note: !intent
          ? "There is no intent here at all. Name the problem, not the solution — what is going wrong now, and for whom?"
          : intent.length < 100
            ? "Too short to be a problem statement. Someone reading this cold should be able to tell what is currently going wrong."
            : vague.test(intent)
              ? "This describes wanting things to be better rather than what is wrong. Vague verbs are where proposals go to die."
              : "A problem is named. No model read it, so whether it is the real problem is not something this reader can tell you.",
        questions: intent && intent.length >= 100 ? [] : ["What is happening now that should not be?", "Who is affected by it?"],
      },
      {
        section: "change" as const,
        ready: change.length >= 100 && !vague.test(change),
        note: !change
          ? "Nothing here. What would be different the day after this happened?"
          : vague.test(change)
            ? "Improve, explore, support — these are not changes anyone can picture, agree to, or later check against what happened."
            : change.length < 100
              ? "Say it concretely enough that somebody who was not in the room could carry it out."
              : "Concrete enough to picture.",
        questions:
          change.length >= 100 && !vague.test(change)
            ? []
            : ["What exactly would be different afterwards?", "Who does the first thing, and when?"],
      },
      {
        section: "constraints" as const,
        ready: constraints.length >= 80 && hasNumber.test(constraints),
        note: !constraints
          ? "Nothing about what this takes. Money, time, people, and anything it depends on that is not in your gift."
          : !hasNumber.test(constraints)
            ? "No numbers. An unnumbered budget is not a constraint — it is a hope."
            : "Costs are stated with figures.",
        questions:
          constraints.length >= 80 && hasNumber.test(constraints)
            ? []
            : ["How much money, and how many hours of whose time?", "What does this depend on that you cannot decide yourself?"],
      },
      {
        section: "risks" as const,
        ready: risks.length >= 100 && !namesNothing.test(risks),
        note: !risks
          ? "No risks given. Every proposal has at least one, and 'none' usually means it has not been looked for."
          : namesNothing.test(risks)
            ? "This says there are no risks, which is the one answer that is never true. A risks section with no risk in it performs having thought about it."
            : risks.length < 100
              ? "Thin. What would you take as evidence, three months in, that this was not working?"
              : "A real risk is named.",
        questions:
          risks.length >= 100 && !namesNothing.test(risks)
            ? []
            : ["What is most likely to go wrong?", "What would tell you it was not working?"],
      },
      {
        section: "alternatives" as const,
        ready: alternatives.length >= 80,
        note: !alternatives
          ? "No alternatives considered. Somebody who has weighed no other option has not made a choice, they have had an idea."
          : !considersDoingNothing.test(alternatives)
            ? "Doing nothing is not among these, and it is a real option — often the right one. Say why it is not, here."
            : alternatives.length < 80
              ? "Say what else you looked at and why not that."
              : "Alternatives were weighed, including leaving things alone.",
        questions: alternatives.length >= 80 ? [] : ["What else did you consider?", "Why not simply leave things as they are?"],
      },
      {
        section: "evidence" as const,
        ready: true,
        note: evidence
          ? "Evidence given. This reader cannot check whether it supports the claim."
          : "Optional, and not given. That is allowed — but any claim doing real work here rests on your word.",
        questions: [],
      },
    ];

    const readyCount = readings.filter((r) => r.ready).length;
    // Six of six is 0.72, just over the bar. Five is 0.60, under it. That is
    // deliberate: offline, every section has to be there.
    const readiness = round(clamp(readyCount / 6 - 0.2 + (evidence ? 0.06 : 0)));

    return {
      sections: readings,
      readiness,
      verdict:
        `No model read this draft — ANTHROPIC_API_KEY is not set, so the offline reader answered. ` +
        `It judged structure: whether each section is there, whether the costs carry numbers, whether the ` +
        `risks name something real. It cannot tell you whether the idea is any good, whether the problem ` +
        `is the real problem, or whether your plan would work. ` +
        (readiness >= 0.7
          ? `On structure this is complete enough to put to people. Set a key if you want it actually read before you do.`
          : `On structure it is not ready yet: ${readings.filter((r) => !r.ready).map((r) => r.section).join(", ")}.`),
    };
  }

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
