import { describe, expect, it } from "vitest";

import {
  asReview,
  isClosed,
  isOpen,
  proposalProgress,
  reviewQuality,
  scoreTone,
  sentenceAround,
  whatHappensNext,
} from "./collective";
import { CLOSED_STATUSES, type ProposalStatus } from "./types";

describe("proposal status", () => {
  it("treats deliberation and voting as open", () => {
    expect(isOpen("in_deliberation")).toBe(true);
    expect(isOpen("voting")).toBe(true);
  });

  it("does not treat a proposal still in review as open", () => {
    // Nobody is asked to respond to something that has not been read.
    expect(isOpen("in_review")).toBe(false);
  });

  it("reveals resonance only once a proposal has closed", () => {
    for (const s of ["passed", "failed", "executing", "completed"] as ProposalStatus[]) {
      expect(isClosed(s)).toBe(true);
    }
    for (const s of ["in_review", "in_deliberation", "voting"] as ProposalStatus[]) {
      expect(isClosed(s)).toBe(false);
    }
  });

  it("keeps the shared constant and the helper in step", () => {
    // The RLS policy and resonance_summary() use the same four statuses.
    expect(CLOSED_STATUSES.every(isClosed)).toBe(true);
  });
});

describe("reviewQuality", () => {
  const base = {
    id: "r",
    proposal_id: "p",
    prompt_id: "proposal.review",
    prompt_version: "1.2.0",
    model: "test",
    values_alignment: {},
    risks: [],
    questions: [],
    memory_used: [],
    summary: null,
    created_at: "",
    created_by: null,
  };

  it("averages the four qualities", () => {
    expect(
      reviewQuality({
        ...base,
        clarity: 0.8,
        evidence: 0.6,
        feasibility: 0.4,
        reversibility: 0.2,
      }),
    ).toBeCloseTo(0.5);
  });

  it("returns null rather than zero when a review has no scores", () => {
    // Zero would render as a damning 0.00 bar for a review that simply has none.
    expect(
      reviewQuality({
        ...base,
        clarity: null,
        evidence: null,
        feasibility: null,
        reversibility: null,
      }),
    ).toBeNull();
    expect(reviewQuality(null)).toBeNull();
  });
});

describe("scoreTone", () => {
  it("marks anything under the floor as critical", () => {
    expect(scoreTone(0.28)).toBe("alarm");
    expect(scoreTone(0.31)).not.toBe("alarm");
  });

  it("respects a group's own floor", () => {
    expect(scoreTone(0.45, 0.5)).toBe("alarm");
  });
});

describe("asReview", () => {
  it("survives jsonb columns coming back null", () => {
    const r = asReview({ id: "x", values_alignment: null, risks: null });
    expect(r.values_alignment).toEqual({});
    expect(r.risks).toEqual([]);
    expect(r.questions).toEqual([]);
    expect(r.memory_used).toEqual([]);
  });
});


describe("where a proposal has got to", () => {
  const current = (s: ProposalStatus) =>
    proposalProgress(s).find((x) => x.state === "current")?.key;

  it("puts each open status on its own step", () => {
    expect(current("in_review")).toBe("review");
    expect(current("in_deliberation")).toBe("deliberation");
    expect(current("voting")).toBe("resonance");
  });

  it("marks everything before the current step as done and after as ahead", () => {
    const steps = proposalProgress("voting");
    expect(steps.map((s) => s.state)).toEqual([
      "done", "done", "current", "ahead", "ahead", "ahead",
    ]);
  });

  it("keeps the project step ahead after passing — ratification is not activation", () => {
    const steps = proposalProgress("passed");
    expect(steps.find((s) => s.key === "decided")?.label).toBe("Passed");
    expect(steps.find((s) => s.key === "underway")?.state).toBe("ahead");
  });

  it("ends a failed proposal where it ended, without the road it did not take", () => {
    const steps = proposalProgress("failed");
    expect(steps.at(-1)?.label).toBe("Did not pass");
    expect(steps.some((s) => s.key === "underway" || s.key === "done")).toBe(false);
  });

  it("does not invent a history for a withdrawn proposal", () => {
    // status does not say which stage it was withdrawn from.
    expect(proposalProgress("withdrawn")).toEqual([
      { key: "withdrawn", label: "Withdrawn", state: "current" },
    ]);
  });

  it("has something to say for every status", () => {
    const all: ProposalStatus[] = [
      "in_review", "in_deliberation", "voting", "passed",
      "failed", "withdrawn", "executing", "completed",
    ];
    for (const s of all) {
      expect(whatHappensNext(s, { hasGroup: true, closesAt: null }).length).toBeGreaterThan(10);
    }
  });

  it("names the closing date for a place, where the clock decides", () => {
    const line = whatHappensNext("voting", { hasGroup: false, closesAt: "2026-10-14T12:00:00Z" });
    expect(line).toContain("14 October");
  });
});

describe("quoting the sentence a word was noticed in", () => {
  const text =
    "The ladder is kept at number 6. Members get shared access to the workshop. Nobody pays.";

  it("returns the sentence around a selection, full stop included", () => {
    const at = text.indexOf("shared");
    expect(sentenceAround(text, at, at + 6)).toBe(
      "Members get shared access to the workshop.",
    );
  });

  it("handles a selection in the first and last sentence", () => {
    expect(sentenceAround(text, 4, 10)).toBe("The ladder is kept at number 6.");
    const at = text.indexOf("pays");
    expect(sentenceAround(text, at, at + 4)).toBe("Nobody pays.");
  });

  it("stops at a line break as well as a full stop", () => {
    const t = "A heading\nshared access for all";
    const at = t.indexOf("shared");
    expect(sentenceAround(t, at, at + 6)).toBe("shared access for all");
  });

  it("keeps a run-on sentence quotable and keeps the word in it", () => {
    const long = "a ".repeat(400) + "shared " + "b ".repeat(400);
    const at = long.indexOf("shared");
    const s = sentenceAround(long, at, at + 6);
    expect(s.length).toBeLessThanOrEqual(400);
    expect(s).toContain("shared");
  });
});
