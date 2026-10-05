"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

export async function addTodo(body: string): Promise<Result> {
  const text = body.trim();
  if (!text) return { ok: false, error: "Write something." };
  const supabase = await createClient();
  const { error } = await supabase.from("todos").insert({ body: text.slice(0, 500) });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/individual/todo");
  return { ok: true };
}

export async function toggleTodo(id: string, done: boolean): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("todos")
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/individual/todo");
  return { ok: true };
}

export async function deleteTodo(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("todos").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/individual/todo");
  return { ok: true };
}
