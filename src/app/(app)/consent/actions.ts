"use server";

import { createClient } from "@/lib/supabase/server";

/** Records both consents at the current wording. The database stamps the version. */
export async function giveConsent() {
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_consent", {
    p_purposes: ["special_category", "adult"],
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}
