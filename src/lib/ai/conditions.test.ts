import { describe, expect, it } from "vitest";

import { MockProvider } from "./mock";
import { PROPOSAL_CONDITIONS } from "./prompts";
import { conditionsSchema } from "./schemas";

describe("proposal conditions (0042)", () => {
  it("accepts no time window", () => {
    const r = conditionsSchema.safeParse({
      min_voices: 3,
      window_hours: null,
      affected: ["Tenants of Elm Court"],
      requirements: ["Who pays"],
      rationale: "Small, reversible, the voters are the people affected.",
    });
    expect(r.success).toBe(true);
  });

  it("defaults affected to none", () => {
    const r = conditionsSchema.parse({ min_voices: 2, window_hours: 48, requirements: [], rationale: "A reason long enough." });
    expect(r.affected).toEqual([]);
  });

  it("offline: no window for a local proposal, a window for a national one", async () => {
    const m = new MockProvider();
    const call = (scale: string) =>
      m.complete({ input: `scale: ${scale}\nmembers: n/a\nbudget: none`, schemaName: "record_conditions" });
    expect(((await call("local")).data as { window_hours: number | null }).window_hours).toBeNull();
    expect(((await call("national")).data as { window_hours: number | null }).window_hours).toBe(336);
  });

  it("the prompt tells the AI it may only add when challenged", () => {
    expect(PROPOSAL_CONDITIONS.system).toMatch(/may only ADD/);
    expect(PROPOSAL_CONDITIONS.version).toBe("1.1.0");
  });
});
