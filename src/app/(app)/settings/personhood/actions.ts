"use server";

import { revalidatePath } from "next/cache";

import { PersonhoodError, verifier } from "@/lib/personhood";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Turn a proof the person's own client produced into a fact in the database.
 *
 * The proof is verified on the server before anything is written. A client
 * that hands us a nullifier is making a claim; a verifier that confirms it is
 * the only reason to believe it.
 *
 * Nothing but the nullifier, the verifier's name and its own word for how
 * strong the check was gets stored. If a verifier ever starts returning more
 * than that, the adapter drops it — there is nowhere here to put it.
 */
export async function provePersonhood(proof: Record<string, unknown>) {
  await requireSession();

  const v = verifier();
  if (!v.live) {
    return {
      ok: false as const,
      error:
        "This instance has no verifier configured, so nobody can prove personhood here.",
    };
  }

  let person;
  try {
    person = await v.verify(proof);
  } catch (e) {
    return {
      ok: false as const,
      error:
        e instanceof PersonhoodError
          ? e.message
          : "The verifier could not be reached.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_personhood", {
    p_provider: v.name,
    p_nullifier: person.nullifier,
    p_level: person.level,
    p_method: "biometric",
    p_expires_at: person.expiresAt,
  });

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/settings/personhood");
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/**
 * Unlink your own, and only your own.
 *
 * The database has no path by which a steward, a group or anybody else can
 * take this away from somebody. Releasing it also frees the nullifier, so the
 * same human can verify a different account — which is what makes leaving
 * possible rather than theoretical.
 */
export async function releasePersonhood() {
  await requireSession();
  const supabase = await createClient();

  const { error } = await supabase.rpc("revoke_personhood");
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/settings/personhood");
  revalidatePath("/", "layout");
  return { ok: true as const };
}
