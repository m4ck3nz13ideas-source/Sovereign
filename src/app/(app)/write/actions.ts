"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { fileEntry } from "@/lib/journal";
import type { EntryMode } from "@/lib/types";

/**
 * Launch writes an entry and nothing else.
 *
 * Where it lands is a property of its mode, read at the far end rather than
 * decided here: journal → Vault › Journal, faith → Profile, idea → Pipeline,
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

  // A journal entry files itself as it is written (0063); nothing waits.
  const now = new Date().toISOString();
  const filed =
    mode === "journal"
      ? { ...fileEntry(text), filed_by: "auto", filed_at: now, state: "examined", examined_at: now }
      : {};

  const { error } = await supabase.from("entries").insert({
    profile_id: user.id,
    mode,
    body: text,
    ...filed,
  });

  if (error) return { ok: false as const, error: error.message };

  // Refresh wherever this entry just landed, so its banner is there when
  // the person arrives.
  revalidatePath("/individual/vault", "layout");
  revalidatePath("/individual/ideas");
  revalidatePath("/home");
  revalidatePath("/individual/profile");

  return { ok: true as const };
}
