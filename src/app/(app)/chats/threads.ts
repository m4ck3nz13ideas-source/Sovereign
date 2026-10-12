"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Chats with more than two people (0052): circles of friends, a group's chat,
 * a proposal's chat. Same promise as a two-person chat — nothing said here
 * reaches a proposal, a decision, the ledger or SOV.
 */

function refresh(thread?: string) {
  if (thread) revalidatePath(`/chats/t/${thread}`);
  revalidatePath("/connection");
}

export async function sendThreadMessage(thread: string, body: string) {
  await requireSession();
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_thread_message", { p_thread: thread, p_body: body });
  if (error) return { ok: false as const, error: error.message };
  refresh(thread);
  return { ok: true as const };
}

/** Your own place in it. Nobody else can see it. */
export async function markThreadRead(thread: string) {
  await requireSession();
  const supabase = await createClient();
  await supabase.rpc("mark_thread_read", { p_thread: thread });
  revalidatePath("/connection");
  return { ok: true as const };
}

export async function unsayInThread(messageId: string, thread: string) {
  await requireSession();
  const supabase = await createClient();
  const { error } = await supabase.from("thread_messages").delete().eq("id", messageId);
  if (error) return { ok: false as const, error: error.message };
  refresh(thread);
  return { ok: true as const };
}

export async function createCircle(name: string, members: string[]) {
  await requireSession();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_circle", { p_name: name, p_members: members });
  if (error) return { ok: false as const, error: error.message };
  refresh();
  redirect(`/chats/t/${data as string}`);
}

export async function addToCircle(thread: string, profile: string) {
  await requireSession();
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_to_circle", { p_thread: thread, p_profile: profile });
  if (error) return { ok: false as const, error: error.message };
  refresh(thread);
  return { ok: true as const };
}

export async function leaveCircle(thread: string) {
  await requireSession();
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_circle", { p_thread: thread });
  if (error) return { ok: false as const, error: error.message };
  refresh();
  redirect("/connection");
}
