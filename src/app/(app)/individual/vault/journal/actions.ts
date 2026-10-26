"use server";

import { revalidatePath } from "next/cache";

import { cleanLabels, fileEntry, isFolder, type Folder } from "@/lib/journal";
import { createClient } from "@/lib/supabase/server";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

function refresh(id?: string) {
  revalidatePath("/individual/vault", "layout");
  if (id) revalidatePath(`/individual/vault/journal/${id}`);
}

/**
 * Write a journal entry. It is filed as it is saved — a folder and a few
 * labels from what was written — and nothing waits to be examined.
 */
export async function saveJournal(body: string): Promise<Result<{ id: string; folder: Folder | null; labels: string[] }>> {
  const text = body.trim();
  if (!text) return { ok: false, error: "Nothing to save." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in again." };

  const filing = fileEntry(text);
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("entries")
    .insert({
      profile_id: user.id,
      mode: "journal",
      body: text,
      state: "examined",
      examined_at: now,
      folder: filing.folder,
      labels: filing.labels,
      filed_by: "auto",
      filed_at: now,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not save." };

  refresh();
  return { ok: true, id: data.id as string, ...filing };
}

/**
 * Change an entry. If the folder or labels were changed by hand, the filing
 * becomes the person's own and is never redone. If only the words changed
 * and the app filed it, the app files it again from the new words.
 */
export async function updateJournal(
  id: string,
  input: { body: string; folder: string | null; labels: string[]; filingTouched: boolean },
): Promise<Result<{ folder: Folder | null; labels: string[] }>> {
  const text = input.body.trim();
  if (!text) return { ok: false, error: "An entry needs some words. Delete it instead?" };
  if (input.folder !== null && !isFolder(input.folder)) return { ok: false, error: "No such folder." };

  const supabase = await createClient();
  const { data: current } = await supabase.from("entries").select("filed_by").eq("id", id).maybeSingle();
  if (!current) return { ok: false, error: "That entry is not here." };

  const now = new Date().toISOString();
  const mine = input.filingTouched || current.filed_by === "you";
  const filing = mine
    ? { folder: input.folder as Folder | null, labels: cleanLabels(input.labels) }
    : fileEntry(text);

  const { error } = await supabase
    .from("entries")
    .update({
      body: text,
      expanded_body: null,
      folder: filing.folder,
      labels: filing.labels,
      filed_by: mine ? "you" : "auto",
      filed_at: now,
      edited_at: now,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  refresh(id);
  return { ok: true, ...filing };
}

/** Delete an entry for good. */
export async function deleteJournal(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("entries").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}
