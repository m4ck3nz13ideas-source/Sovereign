import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { signAiPayload } from "./sign";

describe("signAiPayload", () => {
  const before = process.env.AI_SIGNING_SECRET;
  afterEach(() => {
    process.env.AI_SIGNING_SECRET = before;
  });

  it("omits the signature when no secret is set", () => {
    delete process.env.AI_SIGNING_SECRET;
    const { sig, payload } = signAiPayload("post.witness", { a: 1 });
    expect(sig).toBeNull();
    expect(JSON.parse(payload).issued_at).toBeTypeOf("string");
  });

  it("signs kind and exact payload, matching the database's formula", () => {
    process.env.AI_SIGNING_SECRET = "x".repeat(40);
    const { sig, payload } = signAiPayload("law.audit", { proposal_id: "p" });
    const expected = createHmac("sha256", "x".repeat(40)).update(`law.audit\n${payload}`).digest("hex");
    expect(sig).toBe(expected);
  });

  it("a signature for one kind is not the signature for another", () => {
    process.env.AI_SIGNING_SECRET = "y".repeat(40);
    const a = signAiPayload("law.audit", { same: true });
    const b = signAiPayload("post.witness", { same: true });
    expect(a.sig).not.toBe(b.sig);
  });
});
