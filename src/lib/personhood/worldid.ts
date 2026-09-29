import "server-only";

import { PersonhoodError, type PersonhoodVerifier, type VerifiedPerson } from "./provider";

/**
 * World ID.
 *
 * The person's own client produces a zero-knowledge proof that they are a
 * unique human who has been seen once by an orb, or who holds a verified
 * device. This adapter asks World ID's API whether that proof is good, and
 * keeps exactly one field of the answer: the nullifier hash.
 *
 * The proof is verified server-side rather than trusted from the browser,
 * because a proof accepted on the client's say-so is not a proof of anything.
 *
 * WHICH API THIS TARGETS: the Developer Portal's v2 verify endpoint, which is
 * the one that takes a nullifier hash, a merkle root and a proof for a named
 * action. World ID 4 proofs go through a different request shape, and this has
 * not been run against a live app — so before an instance turns a verifier on,
 * check this against the portal's current reference and expect to change the
 * body below. The seam is the part that is settled; the endpoint is not.
 *
 * The nullifier is scoped to the action id below. Change the action and every
 * existing proof stops matching — which is why it is configuration rather than
 * a literal, and why changing it is a decision rather than a tweak.
 */
export class WorldIdVerifier implements PersonhoodVerifier {
  readonly name = "worldid";
  readonly live = true;

  constructor(
    private readonly appId: string,
    private readonly action: string,
  ) {}

  async verify(proof: Record<string, unknown>): Promise<VerifiedPerson> {
    const body = {
      nullifier_hash: proof.nullifier_hash,
      merkle_root: proof.merkle_root,
      proof: proof.proof,
      verification_level: proof.verification_level,
      action: this.action,
    };

    let res: Response;
    try {
      res = await fetch(`https://developer.worldcoin.org/api/v2/verify/${this.appId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (cause) {
      throw new PersonhoodError("Could not reach the verifier.", cause);
    }

    if (!res.ok) {
      // The body carries a reason — a reused proof, a stale merkle root, a
      // mismatched action. It is shown as-is rather than flattened into
      // "verification failed", because the person can usually act on it.
      const detail = await res.text().catch(() => "");
      throw new PersonhoodError(
        `The verifier did not accept that proof${detail ? `: ${detail.slice(0, 300)}` : "."}`,
      );
    }

    const data = (await res.json()) as {
      nullifier_hash?: string;
      verification_level?: string;
    };

    // Belt and braces: the nullifier we store is the one the verifier
    // confirmed, never the one the client claimed.
    const nullifier = data.nullifier_hash ?? (proof.nullifier_hash as string | undefined);
    if (!nullifier || nullifier.length < 16) {
      throw new PersonhoodError("The verifier returned no nullifier.");
    }

    return {
      nullifier,
      level: data.verification_level ?? (proof.verification_level as string) ?? null,
      // World ID proofs do not expire. A verifier whose do returns a date here
      // and the database stops counting it on its own.
      expiresAt: null,
    };
  }

  describe() {
    return "World ID. Your own device proves to the verifier that you are a unique human — once, in person, at an orb, or with a verified device. What reaches Sovereign is a single opaque hash: the same one for you every time, different at every other application, and not reversible into you. No name, no document, no image, no account.";
  }
}

/**
 * What runs when no verifier is configured.
 *
 * It refuses, and says so. The tempting alternative — an offline adapter that
 * returns a plausible nullifier so the loop can be walked without a key, the
 * way the AI layer's mock does — would be wrong here and the difference is
 * worth naming. A mock review is labelled as a guess and changes nothing about
 * who may vote. A mock personhood proof IS the thing being proved. There is no
 * honest offline version of "a verifier has seen this human".
 */
export class NoVerifier implements PersonhoodVerifier {
  readonly name = "none";
  readonly live = false;

  async verify(): Promise<VerifiedPerson> {
    throw new PersonhoodError(
      "This instance has no verifier configured, so nobody can prove personhood here — including the person who set it up.",
    );
  }

  describe() {
    return "No verifier is configured. Nobody on this instance can prove they are one person, so resonance at national scale and above is closed to everyone. Reading, writing proposals, asking questions and raising concerns are unaffected, and so is everything at local and regional scale.";
  }
}
