"use server";

import { revalidatePath } from "next/cache";

import { isSphere } from "@/lib/spheres";
import { createClient } from "@/lib/supabase/server";

/** Rate one Sphere 1–5, or clear it (null). Yours alone (0047, rule 43). */
export async function rateSphere(sphereId: string, rating: number | null) {
  if (!isSphere(sphereId)) return { ok: false as const, error: "No such Sphere." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Sign in again." };

  const { error } =
    rating === null
      ? await supabase.from("sphere_priorities").delete().eq("profile_id", user.id).eq("sphere_id", sphereId)
      : Number.isInteger(rating) && rating >= 1 && rating <= 5
        ? await supabase
            .from("sphere_priorities")
            .upsert({ profile_id: user.id, sphere_id: sphereId, rating, updated_at: new Date().toISOString() })
        : { error: { message: "A rating is 1 to 5." } };
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/home");
  revalidatePath("/individual/self");
  return { ok: true as const };
}
