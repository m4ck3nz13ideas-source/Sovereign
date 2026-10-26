import { describe, expect, it } from "vitest";

import { findPlaces, placeOf, PLACES } from "./places";

describe("places", () => {
  it("has no duplicate paths", () => {
    const paths = PLACES.map((p) => p.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("finds where things are", () => {
    expect(findPlaces("where do I delete my account")[0].path).toBe("/settings/data");
    expect(findPlaces("how do I add a friend")[0].path).toBe("/connection?show=people");
    expect(findPlaces("I want to make a proposal")[0].path).toBe("/collective/proposals/new");
    expect(findPlaces("where's my journal")[0].path).toBe("/individual/vault/journal");
    expect(findPlaces("what's my SOV balance")[0].path).toBe("/individual/sov");
  });

  it("finds nothing for small talk", () => {
    expect(findPlaces("how are you today")).toEqual([]);
  });

  it("knows which place a page is in", () => {
    expect(placeOf("/collective/proposals/abc")?.name).toBe("Proposals");
    expect(placeOf("/settings/data")?.name).toBe("Your data");
    expect(placeOf("/nowhere")).toBeNull();
  });
});
