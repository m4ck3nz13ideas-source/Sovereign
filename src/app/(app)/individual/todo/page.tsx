import { Page } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

import { TodoList, type Todo } from "./TodoList";

export const metadata = { title: "To do · Sovereign" };

export default async function TodoPage() {
  const { userId } = await requireSession();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("todos")
    .select("id, body, done_at, created_at")
    .eq("profile_id", userId)
    .order("done_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <Page>
      {error ? (
        <p className="text-sm text-alarm">To-dos need migration 0035.</p>
      ) : (
        <TodoList items={(data ?? []) as Todo[]} />
      )}
    </Page>
  );
}
