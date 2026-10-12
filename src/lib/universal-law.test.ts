import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { UNIVERSAL_LAWS, lawAuditProblem } from "./universal-law";

const ids = UNIVERSAL_LAWS.map((l) => l.id as string);

describe("the ten Universal Laws", () => {
  it("are ten, each once", () => {
    expect(ids).toHaveLength(10);
    expect(new Set(ids).size).toBe(10);
  });

  // The database has to know what "all ten" means (0051). If a law id changes
  // here and not there, every audit is refused — loudly, which is the point.
  it("match universal_law_ids() in the database, in order", () => {
    const sql = readFileSync(
      join(__dirname, "../../supabase/migrations/0051_law_audit_integrity.sql"),
      "utf8",
    );
    const body = sql.match(/function universal_law_ids\(\)[\s\S]*?array\[([\s\S]*?)\]::text\[\]/);
    expect(body).not.toBeNull();
    const inSql = [...body![1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(inSql).toEqual(ids);
  });
});

describe("lawAuditProblem", () => {
  it("accepts exactly the ten", () => {
    expect(lawAuditProblem(ids)).toBeNull();
    expect(lawAuditProblem([...ids].reverse())).toBeNull();
  });

  it("refuses nine, eleven, a duplicate and an invented law", () => {
    expect(lawAuditProblem(ids.slice(0, 9))).toMatch(/did not cover/);
    expect(lawAuditProblem([...ids, ids[0]])).toMatch(/more than once/);
    expect(lawAuditProblem([...ids.slice(0, 9), ids[0]])).toMatch(/more than once/);
    expect(lawAuditProblem([...ids.slice(0, 9), "the_eleventh_law"])).toMatch(/do not exist/);
    expect(lawAuditProblem([])).toMatch(/did not cover/);
  });
});
