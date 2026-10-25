import { describe, expect, it } from "vitest";

import {
  CHARTER_FOUNDING_SIZE,
  TEMPLATES,
  charterChangeLines,
  charterChangeProblem,
  charterOf,
  diffCharter,
  packChange,
  unpackChange,
} from "./charters";

const base = charterOf({ purpose: "Look after the garden", goal: null, group_values: ["Care"], inviters: "stewards", proposers: "members" });

describe("charters (0057)", () => {
  it("matches the database's founding size", () => {
    expect(CHARTER_FOUNDING_SIZE).toBe(3);
  });

  it("only carries the fields that changed", () => {
    const c = diffCharter(base, { ...base, proposers: "stewards", group_values: [" Care "] });
    expect(c).toEqual({ proposers: "stewards" });
  });

  it("refuses anything that is not a charter field, as Postgres does", () => {
    expect(charterChangeProblem({ threshold_alignment: 0.1 })).toMatch(/not part of a charter/);
    expect(charterChangeProblem({})).toMatch(/at least one/);
    expect(charterChangeProblem({ inviters: "anyone" })).toMatch(/stewards or members/);
    expect(charterChangeProblem({ proposers: "members" })).toBeNull();
  });

  it("writes the change in words, from and to", () => {
    expect(charterChangeLines(base, { proposers: "stewards" })).toEqual([
      'Who can propose: from "Any member" to "Stewards only"',
    ]);
  });

  it("survives the trip through a URL, unicode included", () => {
    const c = { goal: "Café garden — by spring" };
    expect(unpackChange(packChange(c))).toEqual(c);
    expect(unpackChange("not-json")).toBeNull();
  });

  it("every template is a valid charter", () => {
    for (const t of TEMPLATES) {
      expect(charterChangeProblem({ inviters: t.charter.inviters, proposers: t.charter.proposers })).toBeNull();
      expect(t.charter.ai_context.length).toBeLessThanOrEqual(1200);
    }
  });
});
