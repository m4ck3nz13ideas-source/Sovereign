import { createHmac } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Every AI artefact that decides something is written through `ai_write()`
 * (0040) with a signature only this server can make: HMAC-SHA256 over the kind
 * and the exact payload text, keyed by AI_SIGNING_SECRET. The database holds
 * the same secret and refuses anything unsigned, mis-signed or older than
 * fifteen minutes once its key is set.
 *
 * Without AI_SIGNING_SECRET the signature is simply omitted, which the
 * database accepts only while it has no key either — so the order to switch
 * this on is: Vercel first, then the database.
 *
 * Server-only. Never import this from a client component.
 */
export type AiWriteKind =
  | "proposal.review"
  | "law.audit"
  | "law.challenge"
  | "post.witness"
  | "proposal.conditions"
  | "proposal.conditions.challenge"
  | "marketplace.vetting";

export function signAiPayload(kind: AiWriteKind, data: Record<string, unknown>) {
  const payload = JSON.stringify({ ...data, issued_at: new Date().toISOString() });
  const secret = process.env.AI_SIGNING_SECRET?.trim();
  const sig = secret ? createHmac("sha256", secret).update(`${kind}\n${payload}`).digest("hex") : null;
  return { payload, sig };
}

export async function aiWrite(
  supabase: SupabaseClient,
  kind: AiWriteKind,
  data: Record<string, unknown>,
): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> {
  const { payload, sig } = signAiPayload(kind, data);
  const { data: out, error } = await supabase.rpc("ai_write", {
    p_kind: kind,
    p_payload: payload,
    p_sig: sig,
  });
  return { data: (out as Record<string, unknown> | null) ?? null, error };
}
