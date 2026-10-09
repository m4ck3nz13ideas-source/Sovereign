import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { SPHERES, sphereLine, suggestSpheres, validateSpheres } from "./spheres";

const sql = readFileSync(join(__dirname, "../../supabase/migrations/0043_spheres.sql"), "utf8");

describe("spheres", () => {
  it("matches the database's list exactly", () => {
    const sphereRows = [...sql.matchAll(/\('([a-z]+)',\s+(\d+), '([^']+)',\s+'([^']+)'\)/g)].map((m) => ({
      id: m[1],
      name: m[3],
      description: m[4],
    }));
    expect(sphereRows).toEqual(SPHERES.map((s) => ({ id: s.id, name: s.name, description: s.description })));

    const areaRows = [...sql.matchAll(/\('([a-z]+\.[a-z_]+)',\s*'([a-z]+)',\s*\d+, '([^']+)'\)/g)].map((m) => ({
      id: m[1],
      sphere: m[2],
      name: m[3],
    }));
    expect(areaRows).toEqual(SPHERES.flatMap((s) => s.areas.map((a) => ({ id: a.id, sphere: s.id, name: a.name }))));
  });

  it("validates the shape the database enforces", () => {
    expect(validateSpheres("infrastructure", "infrastructure.spaces", ["ecology", "economy"]).ok).toBe(true);
    expect(validateSpheres("", null, []).ok).toBe(false);
    expect(validateSpheres("health", "ecology.water", []).ok).toBe(false);
    expect(validateSpheres("health", null, ["ecology", "economy", "tech"]).ok).toBe(false);
    expect(validateSpheres("health", null, ["health"]).ok).toBe(false);
    expect(validateSpheres("health", null, ["tech", "tech"]).ok).toBe(false);
  });

  it("writes one line for people and the AI", () => {
    expect(sphereLine("infrastructure", "infrastructure.spaces", ["ecology", "economy"])).toBe(
      "Infrastructure · Public spaces · also Ecology, Economy",
    );
    expect(sphereLine(null)).toBeNull();
  });

  it("suggests from the words of a draft", () => {
    expect(suggestSpheres("Replace the hall boiler with a heat pump to cut carbon emissions")[0]).toBe("ecology");
    expect(suggestSpheres("Free breakfast at the primary school for every pupil")).toContain("education");
    expect(suggestSpheres("")).toEqual([]);
  });
});
