import { describe, expect, it } from "vitest";

import { asReview, isClosed, isOpen, reviewQuality, scoreTone } from "./collective";
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
