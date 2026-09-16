import { describe, expect, it } from "vitest";

import { MockProvider } from "./mock";
import { reviewSchema } from "./schemas";

/**
 * The offline reviewer is what runs when no API key is set, which means it is
 * what most people will see first. It has to produce something that fits the
 * schema, behaves the same way twice, and is honest about being offline.
 */

const provider = new MockProvider();

async function review(input: string) {
  const { data, model } = await provider.complete({
    input,
    schemaName: "record_review",
  });
  return { parsed: reviewSchema.parse(data), model };
}

const VALUES = `GROUP
Thursday Studio

THE GROUP'S VALUES
- Hospitality: Nobody who wants to be here is turned away over money.
- Restraint: We do not commit to what we cannot sustain for a year.

THE PROPOSAL
`;

describe("the offline reviewer", () => {
  it("produces output that fits the schema", async () => {
    const { parsed } = await review(
      `${VALUES}Rent the room above the pub for £480 over twelve weeks.`,
    );
    expect(parsed.summary).toBeTruthy();
    expect(parsed.clarity).toBeGreaterThanOrEqual(0);
    expect(parsed.clarity).toBeLessThanOrEqual(1);
  });

  it("scores every value the group named, and only those", async () => {
    const { parsed } = await review(`${VALUES}A proposal body.`);
    expect(Object.keys(parsed.values_alignment).sort()).toEqual([
      "Hospitality",
      "Restraint",
    ]);
  });

  it("says it is the model, so reviews can be labelled honestly", async () => {
    const { model } = await review(`${VALUES}A proposal body.`);
    expect(model).toBe("mock");
  });

  it("never claims to have read a past decision", async () => {
    const { parsed } = await review(`${VALUES}A proposal body.`);
    expect(parsed.memory_used).toEqual([]);
  });

  it("gives the same reading twice for the same proposal", async () => {
    const body = `${VALUES}Rent the room for £480 over twelve weeks.`;
    const a = await review(body);
    const b = await review(body);
    expect(a.parsed).toEqual(b.parsed);
  });

  it("flags money that is asserted without support, so the flag path is walkable", async () => {
    const { parsed } = await review(
      `${VALUES}We should spend £480 on a room. It will be better.`,
    );
    const high = parsed.risks.filter((r) => r.severity === "high");
    expect(high.length).toBeGreaterThan(0);
    // One value is pushed under the 0.30 floor, so a values flag is raised too.
    const scores = Object.values(parsed.values_alignment);
    expect(Math.min(...scores)).toBeLessThan(0.3);
  });

  it("scores a reversible commitment higher than an irreversible one", async () => {
    const trial = await review(
      `${VALUES}Trial the room for three weeks, then revisit.`,
    );
    const permanent = await review(
      `${VALUES}Sign a permanent lease and hire a caretaker.`,
    );
    expect(trial.parsed.reversibility).toBeGreaterThan(
      permanent.parsed.reversibility,
    );
  });

  it("scores a supported claim higher on evidence than a bare assertion", async () => {
    const supported = await review(
      `${VALUES}We lost two sessions because the hall was double-booked; the data is in the log.`,
    );
    const asserted = await review(`${VALUES}The hall is not good enough.`);
    expect(supported.parsed.evidence).toBeGreaterThan(asserted.parsed.evidence);
  });

  it("stays silent rather than inventing a reflection from one entry", async () => {
    const { data } = await provider.complete({
      input: "2026-09-01\nA single entry.\n---",
      schemaName: "record_reflection",
    });
    expect((data as { question: string }).question).toBe("");
  });

  it("refuses a schema it has no answer for, rather than guessing", async () => {
    await expect(
      provider.complete({ input: "x", schemaName: "record_nonsense" }),
    ).rejects.toThrow(/no response/);
  });
});
