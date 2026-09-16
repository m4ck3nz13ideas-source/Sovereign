"use server";

import { revalidatePath } from "next/cache";

import { setActiveGroup } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { GroupScope } from "@/lib/types";

export async function completeOnboarding(
  displayName: string,
  values: { name: string; definition: string }[],
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "You are not signed in." };

  const named = values.filter((v) => v.name.trim());

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName.trim() || "Unnamed",
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) return { ok: false as const, error: error.message };

  if (named.length) {
    await supabase.from("profile_values").insert(
      named.map((v, i) => ({
        profile_id: user.id,
        name: v.name.trim(),
        definition: v.definition.trim() || null,
        position: i,
      })),
    );
  }

  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function createGroup(name: string, purpose: string, scope: GroupScope) {
  const supabase = await createClient();

  if (!name.trim()) return { ok: false as const, error: "A group needs a name." };

  const { data, error } = await supabase.rpc("create_group", {
    p_name: name.trim(),
    p_purpose: purpose.trim() || null,
    p_scope: scope,
  });

  if (error) return { ok: false as const, error: error.message };

  await setActiveGroup(data as string);
  revalidatePath("/", "layout");
  return { ok: true as const, groupId: data as string };
}

export async function joinGroup(code: string) {
  const supabase = await createClient();

  if (!code.trim()) return { ok: false as const, error: "Paste the invite code." };

  const { data, error } = await supabase.rpc("redeem_invite", {
    p_code: code.trim(),
  });

  if (error) return { ok: false as const, error: error.message };

  await setActiveGroup(data as string);
  revalidatePath("/", "layout");
  return { ok: true as const, groupId: data as string };
}
