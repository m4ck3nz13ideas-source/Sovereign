import { describe, expect, it } from "vitest";

import {
  isListingKind,
  offerProblem,
  reasonProblem,
  stateTone,
  whereLabel,
} from "./marketplace";

const good = {
  proposalId: "p1",
  kind: "product",
  name: "Saturday bread",
  description: "Sourdough and rye, baked on the row every Saturday morning.",
  terms: "Three pounds a loaf, cash or swap.",
  contact: "",
};

describe("offerProblem", () => {
  it("accepts a complete draft", () => {
    expect(offerProblem(good)).toBeNull();
  });

  it("needs a proposal to carry it — there is no other way in", () => {
    expect(offerProblem({ ...good, proposalId: "" })).toMatch(/proposal/);
  });

  it("refuses a kind the database does not know", () => {
    expect(offerProblem({ ...good, kind: "advert" })).toMatch(/product, a service or a business/);
  });

  it("mirrors the description floor in 0030", () => {
    expect(offerProblem({ ...good, description: "Bread." })).toMatch(/forty/);
    expect(offerProblem({ ...good, description: "x".repeat(2001) })).toMatch(/2,000/);
  });

  it("mirrors the terms floor in 0030", () => {
    expect(offerProblem({ ...good, terms: "£3" })).toMatch(/ten characters/);
  });

  it("measures after trimming, as the database does", () => {
    expect(offerProblem({ ...good, name: "  a  " })).toMatch(/name/);
  });
});

describe("reasonProblem", () => {
  it("asks for twenty characters", () => {
    expect(reasonProblem("Stopped.")).toMatch(/twenty/);
    expect(reasonProblem("The bread has not been baked for a month.")).toBeNull();
  });
});

describe("whereLabel", () => {
  const names = new Map([["g1", "Market Row"]]);

  it("names the group", () => {
    expect(whereLabel({ group_id: "g1", scope: "local", place: null }, names)).toBe("Market Row");
  });

  it("names the place and scale", () => {
    expect(whereLabel({ group_id: null, scope: "local", place: "Hackney" }, names)).toBe(
      "Hackney · local",
    );
  });

  it("says everyone for global", () => {
    expect(whereLabel({ group_id: null, scope: "global", place: null }, names)).toBe("Everyone");
  });
});

describe("states", () => {
  it("only a listed listing is green", () => {
    expect(stateTone("listed")).toBe("calm");
    expect(stateTone("pending")).toBe("gold");
    expect(stateTone("declined")).toBe("neutral");
  });

  it("knows the three kinds and nothing else", () => {
    expect(isListingKind("service")).toBe(true);
    expect(isListingKind("sponsored")).toBe(false);
  });
});
