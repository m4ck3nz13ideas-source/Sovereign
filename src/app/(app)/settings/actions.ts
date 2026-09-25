"use server";

import { revalidatePath } from "next/cache";

import { setActiveGroup } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

/**
 * The decision rule.
 *
 * Exposed and editable because these numbers are guesses until a group has run
 * real decisions through them. Tuning them against what actually happened is
 * the main thing this version is for — see docs/roadmap.md.
 */
export async function updateThresholds(
  groupId: string,
  alignment: number,
  participation: number,
  valuesFloor: number,
) {
  const supabase = await createClient();

  for (const [label, n] of [
    ["alignment", alignment],
    ["participation", participation],
    ["values floor", valuesFloor],
  ] as const) {
    if (Number.isNaN(n) || n < 0 || n > 1) {
      return { ok: false as const, error: `The ${label} threshold has to be between 0 and 1.` };
    }
  }

  const { error } = await supabase
    .from("groups")
    .update({
      threshold_alignment: alignment,
      threshold_participation: participation,
      threshold_values_floor: valuesFloor,
    })
    .eq("id", groupId);

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/settings");
  revalidatePath("/home", "layout");
  return { ok: true as const };
}

export async function updateGroupDetails(groupId: string, name: string, purpose: string) {
  const supabase = await createClient();

  if (!name.trim()) return { ok: false as const, error: "A group needs a name." };

  const { error } = await supabase
    .from("groups")
    .update({ name: name.trim(), purpose: purpose.trim() || null })
    .eq("id", groupId);

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function makeInvite(groupId: string, uses: number, days: number) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("create_invite", {
    p_group_id: groupId,
    p_max_uses: uses,
    p_days: days,
  });

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/settings");
  return { ok: true as const, code: data as string };
}

export async function switchGroup(groupId: string) {
  await setActiveGroup(groupId);
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  return { ok: true as const };
}
