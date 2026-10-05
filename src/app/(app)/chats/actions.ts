"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Private conversation between two friends.
 *
 * Nothing here reaches a proposal, a decision or the ledger, and nothing here
 * is evidence of anything. Two people talking privately about a proposal is
 * how people have always decided things; what the system holds is what they
 * then did in the open, attributed.
 */

export async function sendMessage(to: string, body: string) {
  await requireSession();
  const supabase = await createClient();

  const { error } = await supabase.rpc("send_message", { p_to: to, p_body: body });
  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/chats/${to}`);
  revalidatePath("/chats");
  return { ok: true as const };
}

/** Your own place in the conversation. The other person cannot see it. */
export async function markRead(other: string) {
  await requireSession();
  const supabase = await createClient();

  const { error } = await supabase.rpc("mark_conversation_read", { p_other: other });
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/chats");
  return { ok: true as const };
}

/**
 * Unsay your own.
 *
 * Removes it for both, and they may already have read it. A private
 * conversation is not a public record, so there is no integrity argument for
 * holding somebody to a sentence they regret saying to one person.
 */
export async function unsay(messageId: string, other: string) {
  await requireSession();
  const supabase = await createClient();

  const { error } = await supabase.from("messages").delete().eq("id", messageId);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/chats/${other}`);
  return { ok: true as const };
}
