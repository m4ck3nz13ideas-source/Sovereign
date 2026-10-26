import "server-only";

import { fileEntry } from "@/lib/journal";
import { createClient } from "@/lib/supabase/server";

/**
 * Journal entries written before filing existed, or through Launch, have no
 * filed_at. Opening the Journal files up to fifty of them, so the folders are
 * right the first time they are seen. Entries the person filed are skipped.
 */
export async function fileWaiting(userId: string): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("entries")
    .select("id, body, expanded_body")
    .eq("profile_id", userId)
    .eq("mode", "journal")
    .eq("filed_by", "auto")
    .is("filed_at", null)
    .limit(50);
  const rows = (data ?? []) as { id: string; body: string; expanded_body: string | null }[];
  if (!rows.length) return;

  const now = new Date().toISOString();
  await Promise.all(
    rows.map((r) => {
      const filing = fileEntry(r.expanded_body ? `${r.body}\n${r.expanded_body}` : r.body);
      return supabase
        .from("entries")
        .update({ ...filing, filed_at: now })
        .eq("id", r.id);
    }),
  );
}
