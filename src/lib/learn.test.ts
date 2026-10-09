import { describe, expect, it } from "vitest";

import { COURSES, LESSONS, courseLessons, forYou, nextInCourse } from "./learn";
import { SPHERES } from "./spheres";
import { UNIVERSAL_LAWS } from "./universal-law";

const needs = { certainty: 0.4, variety: 0.5, significance: 0.6, connection: 0.3, growth: 0.9, contribution: 0.7 };

describe("learn", () => {
  it("has ids the database accepts, each once", () => {
    for (const l of LESSONS) expect(l.id).toMatch(/^[a-z0-9-]{1,64}$/);
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
  });

  it("covers every law, every Sphere, and every course", () => {
    expect(courseLessons("laws").map((l) => l.law)).toEqual(UNIVERSAL_LAWS.map((l) => l.id));
    expect(courseLessons("spheres").map((l) => l.sphere)).toEqual(SPHERES.map((s) => s.id));
    for (const c of COURSES) expect(courseLessons(c.id).length).toBeGreaterThan(0);
    for (const l of LESSONS) {
      expect(l.body.length).toBeGreaterThan(0);
      expect(l.ask.length).toBeGreaterThan(10);
    }
  });

  it("walks a course in order and stops at the end", () => {
    const start = courseLessons("start");
    expect(nextInCourse(start[0].id)?.id).toBe(start[1].id);
    expect(nextInCourse(start[start.length - 1].id)).toBeNull();
  });

  it("picks from the person's own results, skipping what is done", () => {
    const a = { needs, values_toward: ["Nature", "Honesty"], values_away: ["Failure"], beliefs: [{}], goals: [{}] };
    const picks = forYou(a, new Set());
    expect(picks[0].lesson.id).toBe("self-growth");
    expect(picks.map((p) => p.lesson.id)).toContain("self-beliefs");
    const after = forYou(a, new Set(["self-growth"]));
    expect(after.map((p) => p.lesson.id)).not.toContain("self-growth");
    const all = forYou(a, new Set(), 20).map((p) => p.lesson.id);
    expect(all).toContain("sphere-ecology");
    expect(all).toContain("law-stewardship-of-earth");
    expect(all).toContain("self-connection");
  });

  it("starts at the beginning without an assessment", () => {
    expect(forYou(null, new Set())[0].lesson.course).toBe("start");
  });
});
