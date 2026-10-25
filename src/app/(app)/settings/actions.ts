"use server";

import { revalidatePath } from "next/cache";

import { setActiveGroup } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { setTheme, type Theme } from "@/lib/theme";

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

/** Light, dark, or follow the device. Stored in a cookie, read in the root layout. */
export async function chooseTheme(theme: Theme) {
  await setTheme(theme);
  revalidatePath("/", "layout");
  return { ok: true as const };
}
