import { describe, expect, it } from "vitest";

import { SAFEGUARDS, SPACES } from "./capabilities";
import { GLOSSARY, SPACE_TERMS } from "./glossary";

const all = [...SPACES.flatMap((s) => s.can), ...SAFEGUARDS];

describe("capabilities", () => {
  it("lists the five spaces in tab order", () => {
    expect(SPACES.map((s) => s.id)).toEqual(["individual", "connection", "search", "market", "collective"]);
  });

  it("says what is missing for everything in testing, and only there", () => {
    for (const c of all) {
      if (c.status === "testing") expect(c.note, c.title).toBeTruthy();
      else expect(c.note, c.title).toBeUndefined();
    }
  });

  it("gives every space a purpose and one first action inside the app", () => {
    for (const s of SPACES) {
      expect(s.purpose.length).toBeGreaterThan(20);
      expect(s.firstAction.length).toBeGreaterThan(10);
      expect(s.href.startsWith("/")).toBe(true);
      expect(s.href.startsWith("/explore")).toBe(false);
    }
  });

  it("never describes the record as a blockchain or trustless", () => {
    for (const c of all) {
      const words = `${c.title} ${c.detail}`.toLowerCase();
      if (/blockchain|trustless|decentrali/.test(words)) {
        // Only allowed when saying what it is NOT.
        expect(words, c.title).toMatch(/not (a )?(blockchain|trustless|decentrali)/);
      }
    }
  });

  it("explains every word a tab's first-run note uses", () => {
    for (const terms of Object.values(SPACE_TERMS)) {
      for (const t of terms) expect(GLOSSARY[t], t).toBeTruthy();
    }
  });
});
