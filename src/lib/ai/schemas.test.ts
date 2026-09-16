import { describe, expect, it } from "vitest";

import { reviewSchema } from "./schemas";

/**
 * A model's output is parsed before it reaches the database.
 *
 * This matters more than it looks: members read a review as authoritative, so
 * a half-formed one written into the record is worse than a visible failure.
 */

const valid = {
  clarity: 0.8,
  evidence: 0.6,
  feasibility: 0.7,
  reversibility: 0.4,
  values_alignment: { Hospitality: 0.28 },
  risks: [{ title: "A risk", severity: "high", note: "Why." }],
  questions: ["Who is liable?"],
  memory_used: [],
  summary: "A reading.",
};

describe("review parsing", () => {
  it("accepts a well-formed review", () => {
    expect(reviewSchema.parse(valid)).toMatchObject({ clarity: 0.8 });
  });

  it("rejects a score outside 0–1", () => {
    expect(() => reviewSchema.parse({ ...valid, clarity: 1.4 })).toThrow();
    expect(() => reviewSchema.parse({ ...valid, evidence: -0.1 })).toThrow();
  });

  it("rejects a value score outside 0–1", () => {
    expect(() =>
      reviewSchema.parse({ ...valid, values_alignment: { Hospitality: 12 } }),
    ).toThrow();
  });

  it("rejects an invented severity", () => {
    expect(() =>
      reviewSchema.parse({
        ...valid,
        risks: [{ title: "A risk", severity: "catastrophic", note: "" }],
      }),
    ).toThrow();
  });

  it("rejects a review with no summary", () => {
    expect(() => reviewSchema.parse({ ...valid, summary: "" })).toThrow();
  });

  it("caps questions at five, so a group is not handed a homework list", () => {
    expect(() =>
      reviewSchema.parse({ ...valid, questions: Array(6).fill("q") }),
    ).toThrow();
  });

  it("accepts an empty values_alignment, for a group that has named nothing", () => {
    expect(
      reviewSchema.parse({ ...valid, values_alignment: {} }).values_alignment,
    ).toEqual({});
  });
});
