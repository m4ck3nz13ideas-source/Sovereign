"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type MarkKind = "person" | "circle" | "group" | "proposal" | "business";

/**
 * Pin or mute something in your Connection list. Yours alone: the row is
 * readable by nobody but you (0055).
 */
export async function setMark(
  kind: MarkKind,
  refId: string,
  change: { pinned?: boolean; muted?: boolean },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Sign in first." };

  const { data: existing } = await supabase
    .from("connection_marks")
    .select("pinned, muted")
    .eq("profile_id", user.id)
    .eq("kind", kind)
    .eq("ref_id", refId)
    .maybeSingle();

  const next = {
    pinned: change.pinned ?? existing?.pinned ?? false,
    muted: change.muted ?? existing?.muted ?? false,
  };

  const { error } =
    !next.pinned && !next.muted
      ? await supabase
          .from("connection_marks")
          .delete()
          .eq("profile_id", user.id)
          .eq("kind", kind)
          .eq("ref_id", refId)
      : await supabase.from("connection_marks").upsert({
          profile_id: user.id,
          kind,
          ref_id: refId,
          ...next,
          updated_at: new Date().toISOString(),
        });

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/connection");
  return { ok: true as const };
}
