"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

/**
 * The lexicon's actions: raise a word, and write what you take it to mean.
 *
 * There is deliberately no third one. Nothing here edits a word, deletes a
 * reading, marks a reading as the right one, or records that two people agree.
 * If a function for any of those turns up in this file, the feature has become
 * a glossary and the one thing it existed to show — that the group has not in
 * fact settled what it means — has been tidied away.
 */

export async function raiseTerm(groupId: string, term: string) {
  const word = term.trim();

  if (word.length < 2) {
    return { ok: false as const, error: "A word, at least two characters of one." };
  }
  if (word.length > 60) {
    return {
      ok: false as const,
      error: "That is a sentence. Raise the word the sentence turns on.",
    };
  }

  await requireSession();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("raise_term", {
    p_group_id: groupId,
    p_term: word,
  });

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/collective/lexicon");
  // If somebody had already raised it, this is their word's id rather than a
  // new one, and landing on the page where their reading already is is the
  // useful outcome rather than a collision to report.
  return { ok: true as const, id: data as string };
}

export async function writeReading(termId: string, body: string) {
  const text = body.trim();

  if (text.length < 20) {
    return {
      ok: false as const,
      error:
        "Say it concretely enough that somebody could tell whether they disagree — twenty characters at least.",
    };
  }
  if (text.length > 600) {
    return { ok: false as const, error: "Shorter. What you mean, not the argument for it." };
  }

  await requireSession();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("write_reading", {
    p_term_id: termId,
    p_body: text,
  });

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/collective/lexicon");
  revalidatePath(`/collective/lexicon/${termId}`);
  // The revision number, which is 1 the first time. Anything above 1 means the
  // earlier wording is still on the record, and the screen says so.
  return { ok: true as const, revision: data as number };
}
