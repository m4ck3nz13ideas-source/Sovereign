"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { isSphere } from "@/lib/spheres";
import { createClient } from "@/lib/supabase/server";

/** Follow or stop following a Sphere. Yours alone; nothing counts it (0043). */
export async function setSphereFollow(sphereId: string, follow: boolean) {
  await requireSession();
  if (!isSphere(sphereId)) return { ok: false as const, error: "Not a Sphere." };
  const supabase = await createClient();
  const { error } = follow
    ? await supabase.from("sphere_follows").upsert({ sphere_id: sphereId }, { onConflict: "profile_id,sphere_id", ignoreDuplicates: true })
    : await supabase.from("sphere_follows").delete().eq("sphere_id", sphereId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/collective/proposals");
  return { ok: true as const };
}
