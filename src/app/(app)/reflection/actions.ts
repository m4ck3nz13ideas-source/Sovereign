"use server";

import { revalidatePath } from "next/cache";

import { reflectionQuestion } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";

/** File an entry as examined. It leaves the pull list and stays in the record. */
export async function fileEntry(entryId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("entries")
    .update({ state: "examined", examined_at: new Date().toISOString() })
    .eq("id", entryId);

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/reflection");
  return { ok: true as const };
}

/** Expand an entry: a longer writing space, pre-populated, filed when saved. */
export async function expandEntry(entryId: string, expanded: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("entries")
    .update({
      expanded_body: expanded.trim(),
      state: "examined",
      examined_at: new Date().toISOString(),
    })
    .eq("id", entryId);

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/reflection");
  return { ok: true as const };
}

/**
 * Ask for a reflection question drawn from recent unexamined journal entries.
 *
 * Runs on demand rather than on a schedule: a question that arrives because
 * you asked for it is an invitation, and one that arrives on its own is a
 * notification. This product is built for the first kind.
 */
export async function askForPrompt() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "You are not signed in." };

  const { data: entries } = await supabase
    .from("entries")
    .select("created_at, body")
    .eq("profile_id", user.id)
    .eq("mode", "journal")
    .eq("state", "unexamined")
    .order("created_at", { ascending: false })
    .limit(12);

  if (!entries?.length) {
    return { ok: false as const, error: "There is nothing unexamined to read." };
  }

  try {
    const { result, model, prompt } = await reflectionQuestion(entries);

    if (!result.question.trim()) {
      return {
        ok: false as const,
        error:
          "Nothing recurring in these entries yet. That is a normal answer, not a failure.",
      };
    }

    const { error } = await supabase.from("ai_prompts_surfaced").insert({
      profile_id: user.id,
      surface: "reflection",
      question: result.question,
      rationale: result.rationale,
      prompt_id: prompt.id,
      prompt_version: prompt.version,
      model,
    });

    if (error) return { ok: false as const, error: error.message };

    revalidatePath("/reflection");
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "The reflection could not be written.",
    };
  }
}

export async function dismissPrompt(id: string) {
  const supabase = await createClient();
  await supabase
    .from("ai_prompts_surfaced")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/reflection");
  return { ok: true as const };
}
