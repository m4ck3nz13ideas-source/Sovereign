/**
 * The personhood seam.
 *
 * One question, asked of an outside verifier: is this a distinct living
 * person? Not who they are. Not what they are called. Not where they live.
 *
 * What comes back is a NULLIFIER — an opaque hash the verifier derives for
 * this application specifically. The same human produces the same hash here
 * every time, a different hash at any other application, and nothing anyone
 * holds turns it back into the human. That asymmetry is what lets Sovereign
 * enforce one person one voice without learning anything about the person,
 * and it is the only reason a biometric verifier is acceptable here at all.
 *
 * WHAT AN ADAPTER MUST NEVER DO
 *
 * Return, store, log or forward a name, a document, an image, a biometric
 * template, a provider account id, or anything else that identifies the
 * person. If a verifier's API hands those back, the adapter drops them before
 * returning. The database has nowhere to put them and that is deliberate.
 */

export interface PersonhoodVerifier {
  /** Recorded on the proof, so a member can see who vouched for the machinery. */
  readonly name: string;
  /** False when nothing is configured. The screens say so rather than pretending. */
  readonly live: boolean;

  /**
   * Check a proof the person's own client produced, and return the nullifier.
   *
   * The argument is opaque on purpose: what a verifier needs is its business,
   * and the application layer only ever passes it through.
   */
  verify(proof: Record<string, unknown>): Promise<VerifiedPerson>;

  /** How personhood is established here, in words a member can read. */
  describe(): string;
}

export interface VerifiedPerson {
  /** Opaque, stable for one human, not reversible into them. */
  nullifier: string;
  /** The verifier's own word for how strong this was. Stored verbatim. */
  level: string | null;
  /** Null when the proof does not expire. */
  expiresAt: string | null;
}

export class PersonhoodError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "PersonhoodError";
  }
}
