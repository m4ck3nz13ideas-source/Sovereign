import Link from "next/link";

import { Empty, Gutter, Readers, Screen } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Conversation, ThreadInfo, ThreadMessage } from "@/lib/types";

import { CircleMembers } from "./CircleMembers";
import { ThreadView } from "./ThreadView";

export const metadata = { title: "Chat · Sovereign" };

const WHO: Record<ThreadInfo["kind"], string> = {
  circle: "The friends in this circle.",
  group: "Everyone in this group, as long as they are in it.",
  proposal: "The author and everyone backing it.",
};

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireSession();
  const supabase = await createClient();

  const [{ data: infoRows }, { data: rows }] = await Promise.all([
    supabase.rpc("thread_info", { p_thread: id }),
    supabase.rpc("thread_messages_page", { p_thread: id, p_limit: 200 }),
  ]);
  const info = ((infoRows ?? []) as ThreadInfo[])[0];

  if (!info) {
    return (
      <Screen>
        <Gutter className="pt-6">
          <Empty>This chat is not one you are in.</Empty>
        </Gutter>
      </Screen>
    );
  }

  const messages = ((rows ?? []) as ThreadMessage[]).slice().reverse();

  let members: { id: string; name: string }[] = [];
  let addable: { id: string; name: string }[] = [];
  if (info.kind === "circle") {
    const [{ data: memberRows }, { data: friendRows }] = await Promise.all([
      supabase.from("thread_members").select("profile_id").eq("thread_id", id),
      supabase.rpc("my_conversations"),
    ]);
    const ids = ((memberRows ?? []) as { profile_id: string }[]).map((m) => m.profile_id);
    const { data: names } = ids.length
      ? await supabase.from("public_profiles").select("id, display_name").in("id", ids)
      : { data: [] };
    members = ((names ?? []) as { id: string; display_name: string }[]).map((p) => ({
      id: p.id,
      name: p.id === profile.id ? "You" : p.display_name,
    }));
    addable = ((friendRows ?? []) as Conversation[])
      .filter((f) => !ids.includes(f.profile_id))
      .map((f) => ({ id: f.profile_id, name: f.display_name }));
  }

  const elsewhere =
    info.kind === "proposal" && info.ref_id
      ? { href: `/collective/proposals/${info.ref_id}`, label: "the proposal →" }
      : null;

  return (
    <Screen>
      <Gutter className="space-y-5 pt-6">
        <div>
          <Link href="/connection" className="smallcaps text-[11px] text-paper-faint hover:text-gold">
            ← Connection
          </Link>
          <h2 className="display mt-2 text-[1.5rem] text-paper">{info.title}</h2>
          <p className="smallcaps mt-1 text-[10px] text-paper-faint">
            {info.members} {info.members === 1 ? "person" : "people"}
            {elsewhere ? (
              <>
                {" · "}
                <Link href={elsewhere.href} className="text-gold">
                  {elsewhere.label}
                </Link>
              </>
            ) : null}
          </p>
          <Readers className="mt-1">
            {WHO[info.kind]} Nothing said here reaches a proposal, a decision or the ledger.
          </Readers>
        </div>

        {info.kind === "circle" ? <CircleMembers thread={id} members={members} addable={addable} /> : null}

        <ThreadView thread={id} messages={messages} />
      </Gutter>
    </Screen>
  );
}

export const dynamic = "force-dynamic";
