import { describe, expect, it } from "vitest";

import { cleanLabels, fileEntry, folderName, isFolder } from "./journal";

describe("journal filing", () => {
  it("files by the strongest area", () => {
    expect(fileEntry("Couldn't sleep again, so tired and stressed before the interview at work").folder).toBe("Health");
    expect(fileEntry("Called mum and my sister about the family dinner").folder).toBe("Relationships");
    expect(fileEntry("Paid the rent, the bills are piling up and I need to start saving").folder).toBe("Money");
    expect(fileEntry("The pitch to the investor went well, the business might launch in spring").folder).toBe("Work");
    expect(fileEntry("Grateful today. Prayed this morning and thought about my purpose").folder).toBe("Purpose");
  });

  it("labels at most three, strongest first", () => {
    const f = fileEntry("Slept badly. Tired. Sleep is wrecked. Argued with my brother, then went to the gym");
    expect(f.labels[0]).toBe("sleep");
    expect(f.labels.length).toBeLessThanOrEqual(3);
    expect(f.labels).toContain("family");
  });

  it("leaves an entry with nothing to go on in Other", () => {
    expect(fileEntry("Hmm.")).toEqual({ folder: null, labels: [] });
    expect(folderName(null)).toBe("Other");
  });

  it("matches the start of a word, not the middle", () => {
    expect(fileEntry("The ballroom was grand").labels).not.toContain("conflict");
    expect(fileEntry("I am illustrating a story").labels).not.toContain("body");
  });

  it("cleans labels", () => {
    expect(cleanLabels(["#Sleep", " sleep ", "Big   Plans", ""])).toEqual(["sleep", "big plans"]);
    expect(cleanLabels(Array.from({ length: 12 }, (_, i) => `l${i}`))).toHaveLength(8);
    expect(isFolder("Work")).toBe(true);
    expect(isFolder("Other")).toBe(false);
  });
});
