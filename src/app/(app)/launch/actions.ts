"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { EntryMode } from "@/lib/types";

/**
 * Launch writes an entry and nothing else.
 *
 * Where it lands is a property of its mode, read at the far end rather than
 * decided here: journal → Reflection, faith → Profile, idea → Pipeline,
 * output → Connection. One table, four destinations, no routing state.
 */
export async function createEntry(mode: EntryMode, body: string) {
  const text = body.trim();
  if (!text) return { ok: false as const, error: "Nothing to send." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false as const, error: "You are not signed in." };

  const { error } = await supabase.from("entries").insert({
    profile_id: user.id,
    mode,
    body: text,
  });

  if (error) return { ok: false as const, error: error.message };

  // Refresh wherever this entry just landed, so its banner is there when
  // the person arrives.
  revalidatePath("/reflection");
  revalidatePath("/pipeline");
  revalidatePath("/connection");
  revalidatePath("/profile");

  return { ok: true as const };
}
