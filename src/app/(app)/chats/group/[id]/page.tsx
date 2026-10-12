import { redirect } from "next/navigation";

import { Empty, Gutter, Screen } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

/** A group's chat: opened (made, the first time) by a member, then shown. */
export default async function GroupChat({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSession();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("thread_for_group", { p_group: id });
  if (!error && data) redirect(`/chats/t/${data as string}`);
  return (
    <Screen>
      <Gutter className="pt-6">
        <Empty>This chat is for the group&rsquo;s members.</Empty>
      </Gutter>
    </Screen>
  );
}

export const dynamic = "force-dynamic";
