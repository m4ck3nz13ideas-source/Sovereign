"use server";

import { revalidatePath } from "next/cache";

import { lesson } from "@/lib/learn";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Your note on a lesson, and whether you finished it. Yours alone (0044):
 * nothing collective reads it, it gates nothing, and it earns nothing.
 */
export async function saveLesson(id: string, reflection: string, done: boolean): Promise<Result> {
  const { userId } = await requireSession();
  if (!lesson(id)) return { ok: false, error: "No such lesson." };
  const text = reflection.trim();
  if (text.length > 2000) return { ok: false, error: "Shorter — two thousand characters at most." };
  const supabase = await createClient();
  const { error } = await supabase.from("lesson_progress").upsert(
    {
      profile_id: userId,
      lesson_id: id,
      reflection: text || null,
      completed_at: done ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id,lesson_id" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/individual/learn");
  revalidatePath(`/individual/learn/${id}`);
  return { ok: true };
}
