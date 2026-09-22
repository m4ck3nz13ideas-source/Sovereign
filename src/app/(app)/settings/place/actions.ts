"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Save where this person is.
 *
 * Stored exactly as written — matching happens on a normalised key in the
 * database, so people should see back the words they typed rather than a
 * cleaned-up version of them.
 */
export async function savePlaces(input: {
  place_local: string;
  place_regional: string;
  place_national: string;
  place_continental: string;
}) {
  const { userId } = await requireSession();
  const supabase = await createClient();

  const clean = (s: string) => {
    const t = s.trim();
    return t === "" ? null : t;
  };

  const { error } = await supabase
    .from("profiles")
    .update({
      place_local: clean(input.place_local),
      place_regional: clean(input.place_regional),
      place_national: clean(input.place_national),
      place_continental: clean(input.place_continental),
      place_set_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/settings/place");
  revalidatePath("/connection", "layout");
  return { ok: true as const };
}
