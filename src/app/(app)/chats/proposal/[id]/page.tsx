import { redirect } from "next/navigation";

import { Empty, Gutter, Screen } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

/** A proposal's chat: its author and everyone backing it. */
export default async function ProposalChat({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSession();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("thread_for_proposal", { p_proposal: id });
  if (!error && data) redirect(`/chats/t/${data as string}`);
  return (
    <Screen>
      <Gutter className="pt-6">
        <Empty>This chat is for the author and the people backing it. Back it to join.</Empty>
      </Gutter>
    </Screen>
  );
}

export const dynamic = "force-dynamic";
