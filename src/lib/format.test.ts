import { describe, expect, it } from "vitest";

import { ago, firstLine, lastNDays, money } from "./format";

describe("ago", () => {
  const at = (ms: number) => new Date(Date.now() - ms).toISOString();

  it("reads the way a person would say it", () => {
    expect(ago(at(30_000))).toBe("just now");
    expect(ago(at(5 * 60_000))).toBe("5 minutes ago");
    expect(ago(at(1 * 60_000))).toBe("1 minute ago");
    expect(ago(at(3 * 3_600_000))).toBe("3 hours ago");
    expect(ago(at(1 * 864e5))).toBe("yesterday");
    expect(ago(at(3 * 864e5))).toBe("3 days ago");
  });

  it("is what the banner copy depends on", () => {
    // "From three days ago: '…'. Ready to sit with this?"
    expect(`From ${ago(at(3 * 864e5))}`).toBe("From 3 days ago");
  });
});

describe("firstLine", () => {
  it("takes the first non-empty line", () => {
    expect(firstLine("\n\nThe real first line\nand more")).toBe(
      "The real first line",
    );
  });

  it("truncates with an ellipsis rather than cutting mid-render", () => {
    const long = "x".repeat(200);
    const out = firstLine(long, 20);
    expect(out).toHaveLength(20);
    expect(out.endsWith("…")).toBe(true);
  });

  it("leaves a short line alone", () => {
    expect(firstLine("Short.")).toBe("Short.");
  });
});

describe("lastNDays", () => {
  it("returns n days, oldest first, ending today", () => {
    const days = lastNDays(30);
    expect(days).toHaveLength(30);
    expect(days[29]).toBe(new Date().toISOString().slice(0, 10));
    expect([...days].sort()).toEqual(days);
  });
});

describe("money", () => {
  it("drops pence on whole amounts", () => {
    expect(money(480)).toBe("£480");
  });

  it("keeps them otherwise", () => {
    expect(money(480.5)).toBe("£480.50");
  });

  it("shows an em dash rather than £0 for nothing recorded", () => {
    expect(money(null)).toBe("—");
  });
});
