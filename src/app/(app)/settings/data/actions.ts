"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Leave for good (rule 42). The database does the erasing and checks the
 * words again; this only signs the browser out afterwards, because the
 * account it was signed in to no longer exists.
 */
export async function eraseAccount(confirm: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("erase_my_account", { p_confirm: confirm.trim().toLowerCase() });
  if (error) return { ok: false as const, error: error.message };
  await supabase.auth.signOut();
  return { ok: true as const };
}
