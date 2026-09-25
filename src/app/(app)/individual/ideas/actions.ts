"use server";

import { revalidatePath } from "next/cache";

import { synthesisQuestion } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";
import type { ConceptStatus } from "@/lib/types";

/** Promote an idea entry into a concept of its own. */
export async function startConcept(
  entryId: string,
  title: string,
  discipline: string,
  body: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "You are not signed in." };

  if (!title.trim()) return { ok: false as const, error: "A concept needs a name." };

  const { data: concept, error } = await supabase
    .from("concepts")
    .insert({
      profile_id: user.id,
      title: title.trim(),
      discipline: discipline.trim() || null,
      body: body.trim(),
      status: "developing",
    })
    .select("id")
    .single();

  if (error) return { ok: false as const, error: error.message };

  await supabase.from("concept_entries").insert({
    concept_id: concept.id,
    entry_id: entryId,
  });

  await supabase
    .from("entries")
    .update({ state: "examined", examined_at: new Date().toISOString() })
    .eq("id", entryId);

  revalidatePath("/individual/ideas");
  return { ok: true as const, conceptId: concept.id };
}

/** Attach an idea to a concept already in development. */
export async function connectToConcept(entryId: string, conceptId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("concept_entries")
    .insert({ concept_id: conceptId, entry_id: entryId });

  if (error) return { ok: false as const, error: error.message };

  await supabase
    .from("entries")
    .update({ state: "examined", examined_at: new Date().toISOString() })
    .eq("id", entryId);

  await supabase
    .from("concepts")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conceptId);

  revalidatePath("/individual/ideas");
  return { ok: true as const };
}

export async function discardIdea(entryId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("entries")
    .update({ state: "discarded", examined_at: new Date().toISOString() })
    .eq("id", entryId);

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/individual/ideas");
  return { ok: true as const };
}

export async function saveConcept(
  conceptId: string,
  fields: { title?: string; discipline?: string; body?: string; status?: ConceptStatus },
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("concepts")
    .update({
      ...(fields.title !== undefined ? { title: fields.title.trim() } : {}),
      ...(fields.discipline !== undefined
        ? { discipline: fields.discipline.trim() || null }
        : {}),
      ...(fields.body !== undefined ? { body: fields.body } : {}),
      ...(fields.status !== undefined ? { status: fields.status } : {}),
    })
    .eq("id", conceptId);

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/individual/ideas");
  revalidatePath(`/individual/ideas/${conceptId}`);
  return { ok: true as const };
}

export async function askForSynthesis() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "You are not signed in." };

  const [{ data: ideas }, { data: concepts }] = await Promise.all([
    supabase
      .from("entries")
      .select("created_at, body")
      .eq("profile_id", user.id)
      .eq("mode", "idea")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("concepts")
      .select("title, discipline")
      .eq("profile_id", user.id)
      .limit(40),
  ]);

  if ((ideas?.length ?? 0) < 2) {
    return { ok: false as const, error: "Not enough ideas yet to find a thread." };
  }

  try {
    const { result, model, prompt } = await synthesisQuestion(ideas ?? [], concepts ?? []);

    if (!result.question.trim()) {
      return {
        ok: false as const,
        error: "Nothing is circling yet. Most weeks nothing is.",
      };
    }

    const { error } = await supabase.from("ai_prompts_surfaced").insert({
      profile_id: user.id,
      surface: "pipeline",
      question: result.question,
      rationale: [result.rationale, result.suggested_title && `Might be called: ${result.suggested_title}`, result.discipline]
        .filter(Boolean)
        .join(" · "),
      prompt_id: prompt.id,
      prompt_version: prompt.version,
      model,
    });

    if (error) return { ok: false as const, error: error.message };

    revalidatePath("/individual/ideas");
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "The synthesis could not be written.",
    };
  }
}

export async function dismissSynthesis(id: string) {
  const supabase = await createClient();
  await supabase
    .from("ai_prompts_surfaced")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/individual/ideas");
  return { ok: true as const };
}

/**
 * Import markdown notes.
 *
 * A file's first `# heading` becomes the title, the rest the body, and the
 * path is kept in source_path so a future sync adapter can match this concept
 * back to its file. Re-importing the same path updates rather than duplicates.
 *
 * This is the manual half of what docs/architecture.md calls the vault seam:
 * the data model is already file-shaped, so a sync adapter has somewhere to land.
 */
export async function importMarkdown(files: { path: string; content: string }[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "You are not signed in." };

  let created = 0;
  let updated = 0;

  for (const file of files) {
    const lines = file.content.split("\n");
    const headingIndex = lines.findIndex((l) => /^#\s+/.test(l));
    const title =
      headingIndex >= 0
        ? lines[headingIndex].replace(/^#\s+/, "").trim()
        : file.path.replace(/\.md$/i, "").split("/").pop() || "Untitled";
    const body =
      headingIndex >= 0
        ? lines.slice(headingIndex + 1).join("\n").trim()
        : file.content.trim();

    const { data: existing } = await supabase
      .from("concepts")
      .select("id")
      .eq("profile_id", user.id)
      .eq("source_path", file.path)
      .maybeSingle();

    if (existing) {
      await supabase.from("concepts").update({ title, body }).eq("id", existing.id);
      updated += 1;
    } else {
      await supabase.from("concepts").insert({
        profile_id: user.id,
        title,
        body,
        source_path: file.path,
        status: "developing",
      });
      created += 1;
    }
  }

  revalidatePath("/individual/ideas");
  return { ok: true as const, created, updated };
}
