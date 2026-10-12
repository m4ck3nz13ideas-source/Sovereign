import { Empty, Gutter, Screen } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Conversation } from "@/lib/types";

import { NewCircle } from "./NewCircle";

export const metadata = { title: "New group chat · Sovereign" };

/** A chat with several friends at once. Everyone in it must be your friend. */
export default async function NewCirclePage() {
  await requireSession();
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_conversations");
  const friends = ((data ?? []) as Conversation[]).map((f) => ({ id: f.profile_id, name: f.display_name }));

  return (
    <Screen>
      <Gutter className="space-y-5 pt-6">
        <h2 className="display text-[1.5rem] text-paper">New group chat</h2>
        {friends.length ? (
          <NewCircle friends={friends} />
        ) : (
          <Empty>Add a friend first. A group chat is for people who have both agreed.</Empty>
        )}
      </Gutter>
    </Screen>
  );
}

export const dynamic = "force-dynamic";
