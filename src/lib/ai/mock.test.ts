import { describe, expect, it } from "vitest";

import { MockProvider } from "./mock";
import { debateSchema, reviewSchema, sharpenSchema } from "./schemas";

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

/* ---------------------------------------------------------------------------
   The offline sharpener — the one gate that actually stops a submission.
--------------------------------------------------------------------------- */

function sharpenInput(sections: Record<string, string>): string {
  const order = ["intent", "change", "constraints", "risks", "alternatives", "evidence"];
  return (
    `WHO THIS WOULD BE PUT TO\nscale: local — Hackney\n\nTHE DRAFT\ntitle: A thing\nin one line: One line.\nbudget: none stated\nterm: none stated\n\n` +
    order
      .map((k) => `${k}:\n${sections[k]?.trim() || (k === "evidence" ? "(none given — this section is optional)" : "(empty)")}`)
      .join("\n\n") +
    `\n\nReturn exactly six section readings, using the section names given above.`
  );
}

async function sharpen(sections: Record<string, string>) {
  const { data, model } = await provider.complete({
    input: sharpenInput(sections),
    schemaName: "record_sharpening",
  });
  return { parsed: sharpenSchema.parse(data), model };
}

const THOUGHT_THROUGH = {
  intent:
    "The alley behind the terrace is used as a cut-through and somebody is nearly hit most weeks. It is worst at school run.",
  change:
    "Two bollards at the north end, so it stays walkable and stops being a road. Fitted before the end of March by the person named below.",
  constraints:
    "About £240 for the bollards and 6 hours of fitting time. It depends on the council not objecting.",
  risks:
    "The council may refuse, and the cut-through may simply move to the next street. If either happens by June, this has not worked.",
  alternatives:
    "Doing nothing was considered: the problem recurs weekly, so it was rejected. Signage alone is ignored elsewhere on the estate.",
  evidence: "Three near-misses logged by the school crossing patrol since January.",
};

describe("the offline sharpener", () => {
  it("passes a draft that answers all six sections", async () => {
    const { parsed } = await sharpen(THOUGHT_THROUGH);
    expect(parsed.sections).toHaveLength(6);
    expect(parsed.readiness).toBeGreaterThanOrEqual(0.7);
  });

  it("refuses an empty draft outright", async () => {
    const { parsed } = await sharpen({});
    expect(parsed.readiness).toBeLessThan(0.7);
    expect(parsed.sections.filter((s) => s.ready)).toHaveLength(1); // evidence only
  });

  it("refuses a draft with no risks, and names why", async () => {
    const { parsed } = await sharpen({ ...THOUGHT_THROUGH, risks: "None." });
    expect(parsed.readiness).toBeLessThan(0.7);
    const risks = parsed.sections.find((s) => s.section === "risks");
    expect(risks?.ready).toBe(false);
    expect(risks?.questions.length).toBeGreaterThan(0);
  });

  it("refuses costs with no numbers in them", async () => {
    const { parsed } = await sharpen({
      ...THOUGHT_THROUGH,
      constraints: "It would not cost very much, and somebody could probably fit them.",
    });
    expect(parsed.sections.find((s) => s.section === "constraints")?.ready).toBe(false);
    expect(parsed.readiness).toBeLessThan(0.7);
  });

  it("refuses a change written in vague verbs", async () => {
    const { parsed } = await sharpen({
      ...THOUGHT_THROUGH,
      change: "We would improve the situation in the alley and explore what else could support residents there.",
    });
    expect(parsed.sections.find((s) => s.section === "change")?.ready).toBe(false);
  });

  it("says plainly that no model read it", async () => {
    const { parsed, model } = await sharpen(THOUGHT_THROUGH);
    expect(model).toBe("mock");
    expect(parsed.verdict).toMatch(/no model read/i);
  });

  it("reads the same draft the same way twice", async () => {
    const a = await sharpen(THOUGHT_THROUGH);
    const b = await sharpen(THOUGHT_THROUGH);
    expect(a.parsed).toEqual(b.parsed);
  });
});

/* ---------------------------------------------------------------------------
   The offline debate summariser — abstains on the arguments, not on the shape.
--------------------------------------------------------------------------- */

function threadInput(
  blocks: { kind: string; author: string; body: string; answered?: string }[],
): string {
  return (
    `THE PROPOSAL\ntitle: A thing\nin one line: One line.\n\nwhat it is solving:\nx\n\nwhat would change:\ny\n\nTHE THREAD, in order\n` +
    blocks
      .map((b) =>
        [
          `[${b.kind}] ${b.author} — 12 Mar`,
          b.body,
          b.answered ? `ANSWERED by Someone: ${b.answered}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      )
      .join("\n\n---\n\n") +
    `\n\nYou cannot see anyone's resonance and are not being asked to guess it.`
  );
}

async function debate(blocks: Parameters<typeof threadInput>[0]) {
  const { data, model } = await provider.complete({
    input: threadInput(blocks),
    schemaName: "record_debate_summary",
  });
  return { parsed: debateSchema.parse(data), model };
}

describe("the offline debate summariser", () => {
  it("refuses to put words in anybody's mouth", async () => {
    const { parsed } = await debate([
      { kind: "concern", author: "Ben", body: "Too expensive for what it is." },
      { kind: "reply", author: "Ann", body: "It lasts ten years though." },
    ]);
    expect(parsed.arguments_for).toEqual([]);
    expect(parsed.arguments_against).toEqual([]);
    expect(parsed.reading).toMatch(/no model read/i);
  });

  it("carries unanswered questions through verbatim", async () => {
    const { parsed } = await debate([
      { kind: "question", author: "Ben", body: "Who stores it, and where?" },
      { kind: "question", author: "Cara", body: "What happens in year two?", answered: "We revisit it." },
    ]);
    expect(parsed.unresolved).toHaveLength(1);
    expect(parsed.unresolved[0]).toContain("Who stores it");
  });

  it("reads a thread where people reply to each other as converging", async () => {
    const { parsed } = await debate([
      { kind: "concern", author: "Ben", body: "Too expensive." },
      { kind: "reply", author: "Ann", body: "It lasts ten years." },
      { kind: "reply", author: "Ben", body: "Fair, that changes it." },
    ]);
    expect(parsed.polarization).toBe("converging");
  });

  it("reads positions stated at each other with no replies as splitting", async () => {
    const { parsed } = await debate([
      { kind: "concern", author: "Ben", body: "This is the wrong priority." },
      { kind: "concern", author: "Cara", body: "It is the only priority." },
      { kind: "alternative", author: "Dan", body: "Do the other thing instead." },
      { kind: "concern", author: "Ben", body: "Still the wrong priority." },
    ]);
    expect(parsed.polarization).toBe("splitting");
    expect(parsed.reading).toMatch(/structural guess/i);
  });

  it("does not call a short thread splitting", async () => {
    const { parsed } = await debate([
      { kind: "concern", author: "Ben", body: "Too expensive." },
    ]);
    expect(parsed.polarization).toBe("mixed");
  });

  it("reads the same thread the same way twice", async () => {
    const blocks = [
      { kind: "question", author: "Ben", body: "Who stores it?" },
      { kind: "reply", author: "Ann", body: "The shed." },
    ];
    expect((await debate(blocks)).parsed).toEqual((await debate(blocks)).parsed);
  });
});
