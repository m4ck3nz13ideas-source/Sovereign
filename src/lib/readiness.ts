/**
 * The readiness bar, and the hash that binds a reading to one exact text.
 *
 * Both of these have a twin in Postgres — `readiness_threshold()` and
 * `proposal_body_hash()` — and the database's copy is the one that decides.
 * These exist so the compose screen can say what is about to happen rather
 * than discovering it in an error message.
 */

/**
 * Not 0.618. That number is about when agreement has been reached, and this is
 * not agreement — it is whether a thing has been thought through. A quality bar
 * sits above the point at which people would go along with something.
 */
export const READINESS_THRESHOLD = 0.7;

/** sha256 of the trimmed text, hex. Matches `proposal_body_hash()` exactly. */
export async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text.trim());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const SECTION_LABELS: Record<string, string> = {
  intent: "What this is solving",
  change: "What would change",
  constraints: "What it takes",
  risks: "What could go wrong",
  alternatives: "What else was considered",
  evidence: "Evidence",
};
