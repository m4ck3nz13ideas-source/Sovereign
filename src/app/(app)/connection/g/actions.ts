"use server";

import { revalidatePath } from "next/cache";

import { charterChangeProblem, type CharterChange } from "@/lib/charters";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

const isSteward = (role: string | undefined) => role === "owner" || role === "steward";

/**
 * Write the charter directly — for a founding group only (0057). From three
 * members the database refuses this and the charter page offers a proposal
 * instead; asking first here only gives the refusal words.
 */
export async function saveCharter(groupId: string, change: CharterChange) {
  const { groups } = await requireSession();
  const g = groups.find((x) => x.id === groupId);
  if (!g || !isSteward(g.role)) {
    return { ok: false as const, error: "Only the group's stewards can write its charter." };
  }
  const why = charterChangeProblem(change);
  if (why) return { ok: false as const, error: why };

  const supabase = await createClient();
  const { error } = await supabase
    .from("groups")
    .update({
      ...("purpose" in change ? { purpose: change.purpose?.trim() || null } : {}),
      ...("goal" in change ? { goal: change.goal?.trim().slice(0, 600) || null } : {}),
      ...("group_values" in change ? { group_values: change.group_values } : {}),
      ...("inviters" in change ? { inviters: change.inviters } : {}),
      ...("proposers" in change ? { proposers: change.proposers } : {}),
      ...("ai_context" in change ? { ai_context: change.ai_context?.trim().slice(0, 1200) || null } : {}),
    })
    .eq("id", groupId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/connection/g/${groupId}`, "layout");
  return { ok: true as const };
}

/** A name is not part of the charter: stewards can rename at any size. */
export async function renameGroup(groupId: string, name: string) {
  const { groups } = await requireSession();
  const g = groups.find((x) => x.id === groupId);
  if (!g || !isSteward(g.role)) return { ok: false as const, error: "Only a steward can rename the group." };
  if (!name.trim()) return { ok: false as const, error: "A group needs a name." };
  const supabase = await createClient();
  const { error } = await supabase.from("groups").update({ name: name.trim() }).eq("id", groupId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** An invite code. Stewards, or any member where the charter says so. */
export async function makeInvite(groupId: string, uses: number, days: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_invite", {
    p_group_id: groupId,
    p_max_uses: uses,
    p_days: days,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/connection/g/${groupId}/manage`);
  return { ok: true as const, code: data as string };
}
