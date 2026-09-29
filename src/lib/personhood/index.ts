import "server-only";

import { env } from "@/lib/env";

import type { PersonhoodVerifier } from "./provider";
import { NoVerifier, WorldIdVerifier } from "./worldid";

export { PersonhoodError } from "./provider";
export type { PersonhoodVerifier, VerifiedPerson } from "./provider";

let instance: PersonhoodVerifier | null = null;

/**
 * The configured verifier, or the one that refuses.
 *
 * Swapping World ID for something else is one branch here and nothing else in
 * the application changes: the database stores a provider name and an opaque
 * hash, and neither means anything to it.
 */
export function verifier(): PersonhoodVerifier {
  if (!instance) {
    const { worldIdAppId, worldIdAction } = env;
    instance = worldIdAppId
      ? new WorldIdVerifier(worldIdAppId, worldIdAction)
      : new NoVerifier();
  }
  return instance;
}

export function personhoodIsLive(): boolean {
  return verifier().live;
}
