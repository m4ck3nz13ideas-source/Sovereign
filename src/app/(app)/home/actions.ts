"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

/** Like or unlike. The count is public; the feed order never reads it. */
export async function toggleLike(postId: string, liked: boolean): Promise<Result> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Sign in again." };

  const { error } = liked
    ? await supabase.from("post_likes").delete().eq("post_id", postId).eq("profile_id", auth.user.id)
    : await supabase.from("post_likes").insert({ post_id: postId, profile_id: auth.user.id });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/home");
  return { ok: true };
}

export async function loadThread(postId: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("post_thread", { p_post_id: postId });
  return (data ?? []) as {
    id: string;
    author_name: string;
    author_handle: string | null;
    body: string;
    created_at: string;
  }[];
}

export async function addComment(postId: string, body: string): Promise<Result> {
  const text = body.trim();
  if (!text) return { ok: false, error: "Say something first." };
  if (text.length > 2000) return { ok: false, error: "Keep it under 2,000 characters." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Sign in again." };
  const { error } = await supabase
    .from("post_comments")
    .insert({ post_id: postId, author_id: auth.user.id, body: text });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/home");
  return { ok: true };
}
