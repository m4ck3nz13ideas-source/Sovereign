import { describe, expect, it } from "vitest";

import { NEEDS, STATEMENTS, scoreNeeds, topNeeds } from "./know";

describe("know yourself", () => {
  it("has three statements for each of the six needs", () => {
    for (const n of NEEDS) expect(STATEMENTS.filter((s) => s.need === n)).toHaveLength(3);
  });

  it("scores 1 as 0 and 5 as 1", () => {
    const all5 = Object.fromEntries(STATEMENTS.map((_, i) => [i, 5]));
    const all1 = Object.fromEntries(STATEMENTS.map((_, i) => [i, 1]));
    expect(scoreNeeds(all5).growth).toBe(1);
    expect(scoreNeeds(all1).growth).toBe(0);
  });

  it("finds the driving needs", () => {
    const answers: Record<number, number> = {};
    STATEMENTS.forEach((s, i) => (answers[i] = s.need === "growth" ? 5 : s.need === "connection" ? 4 : 2));
    expect(topNeeds(scoreNeeds(answers))).toEqual(["growth", "connection"]);
  });
});
