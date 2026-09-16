"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

async function me() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

export async function updateBio(display_name: string, bio: string) {
  const { supabase, userId } = await me();
  if (!userId) return { ok: false as const, error: "You are not signed in." };

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: display_name.trim() || "Unnamed", bio: bio.trim() || null })
    .eq("id", userId);

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/profile");
  return { ok: true as const };
}

/**
 * Faith and Purpose are revisable but never overwritten.
 *
 * Each save writes a revision as well as the current statement, so the page
 * can show how a belief has moved. The history is private even when the
 * current statement is shared — see the RLS policy on statement_revisions.
 */
export async function saveStatement(kind: "faith" | "purpose", statement: string) {
  const { supabase, userId } = await me();
  if (!userId) return { ok: false as const, error: "You are not signed in." };

  const text = statement.trim();
  if (!text) return { ok: false as const, error: "Nothing to save." };

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("profiles")
    .update(
      kind === "faith"
        ? { faith_statement: text, faith_updated_at: now }
        : { purpose: text, purpose_updated_at: now },
    )
    .eq("id", userId);

  if (error) return { ok: false as const, error: error.message };

  await supabase.from("statement_revisions").insert({
    profile_id: userId,
    kind,
    statement: text,
  });

  revalidatePath("/profile");
  return { ok: true as const };
}

export async function addValue(name: string, definition: string) {
  const { supabase, userId } = await me();
  if (!userId) return { ok: false as const, error: "You are not signed in." };
  if (!name.trim()) return { ok: false as const, error: "A value needs a name." };

  const { count } = await supabase
    .from("profile_values")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", userId);

  const { error } = await supabase.from("profile_values").insert({
    profile_id: userId,
    name: name.trim(),
    definition: definition.trim() || null,
    position: count ?? 0,
  });

  if (error) {
    return {
      ok: false as const,
      error: error.code === "23505" ? "That value is already listed." : error.message,
    };
  }

  revalidatePath("/profile");
  return { ok: true as const };
}

export async function updateValue(id: string, name: string, definition: string) {
  const { supabase } = await me();
  const { error } = await supabase
    .from("profile_values")
    .update({ name: name.trim(), definition: definition.trim() || null })
    .eq("id", id);

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/profile");
  return { ok: true as const };
}

export async function removeValue(id: string) {
  const { supabase } = await me();
  const { error } = await supabase.from("profile_values").delete().eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/profile");
  return { ok: true as const };
}

export async function reorderValue(id: string, position: number) {
  const { supabase } = await me();
  await supabase.from("profile_values").update({ position }).eq("id", id);
  revalidatePath("/profile");
  return { ok: true as const };
}

export async function addPassion(name: string, note: string) {
  const { supabase, userId } = await me();
  if (!userId) return { ok: false as const, error: "You are not signed in." };
  if (!name.trim()) return { ok: false as const, error: "A passion needs a name." };

  const { count } = await supabase
    .from("profile_passions")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", userId);

  const { error } = await supabase.from("profile_passions").insert({
    profile_id: userId,
    name: name.trim(),
    note: note.trim() || null,
    position: count ?? 0,
  });

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/profile");
  return { ok: true as const };
}

export async function removePassion(id: string) {
  const { supabase } = await me();
  const { error } = await supabase.from("profile_passions").delete().eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/profile");
  return { ok: true as const };
}

/** Disclosure is opt-in, one field at a time. Off is the default. */
export async function setSharing(
  field: "share_values" | "share_purpose" | "share_faith",
  value: boolean,
) {
  const { supabase, userId } = await me();
  if (!userId) return { ok: false as const, error: "You are not signed in." };

  const { error } = await supabase
    .from("profiles")
    .update({ [field]: value })
    .eq("id", userId);

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/profile");
  return { ok: true as const };
}

/** A faith entry, once sat with, is filed away from the top of Profile. */
export async function fileFaithEntry(entryId: string) {
  const { supabase } = await me();
  const { error } = await supabase
    .from("entries")
    .update({ state: "examined", examined_at: new Date().toISOString() })
    .eq("id", entryId);

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/profile");
  return { ok: true as const };
}
