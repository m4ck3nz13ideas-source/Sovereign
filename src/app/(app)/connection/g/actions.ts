"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

/**
 * A group's rundown: what it is for, what it is trying to do, the values it
 * holds. Stewards only — the update policy on `groups` says so, and this
 * function asks the same question first so the refusal has words.
 */
export async function saveGroupAbout(
  groupId: string,
  input: { purpose: string; goal: string; values: string[] },
) {
  const { groups } = await requireSession();
  const g = groups.find((x) => x.id === groupId);
  if (!g || (g.role !== "owner" && g.role !== "steward")) {
    return { ok: false as const, error: "Only the group's stewards can change this." };
  }
  const values = [...new Set(input.values.map((v) => v.trim()).filter(Boolean))].slice(0, 12);
  const supabase = await createClient();
  const { error } = await supabase
    .from("groups")
    .update({
      purpose: input.purpose.trim() || null,
      goal: input.goal.trim().slice(0, 600) || null,
      group_values: values,
    })
    .eq("id", groupId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/connection/g/${groupId}`);
  return { ok: true as const };
}
