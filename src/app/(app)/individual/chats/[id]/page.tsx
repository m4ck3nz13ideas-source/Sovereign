import Link from "next/link";

import { Gutter, Screen } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Message } from "@/lib/types";

import { Thread } from "./Thread";

export const metadata = { title: "Chat · Sovereign" };

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireSession();
  const supabase = await createClient();

  const [{ data: rows }, { data: friends }, { data: profile }] = await Promise.all([
    supabase.rpc("conversation_with", { p_other: id, p_limit: 200 }),
    supabase.rpc("is_friend", { p_profile_id: id }),
    supabase.from("public_profiles").select("display_name").eq("id", id).maybeSingle(),
  ]);

  // Oldest first on screen; the function returns newest first so a long
  // conversation does not have to be read in full to be trimmed.
  const messages = ((rows ?? []) as Message[]).slice().reverse();
  const name = (profile as { display_name: string } | null)?.display_name ?? "them";

  return (
    <Screen>
      <Gutter className="space-y-5 pt-6">
        <div>
          <Link
            href="/individual/chats"
            className="smallcaps text-[11px] text-paper-faint hover:text-gold"
          >
            ← Chats
          </Link>
          <h2 className="display mt-2 text-[1.5rem] text-paper">{name}</h2>
        </div>

        <Thread
          other={id}
          name={name}
          messages={messages}
          stillFriends={Boolean(friends)}
        />
      </Gutter>
    </Screen>
  );
}

export const dynamic = "force-dynamic";
