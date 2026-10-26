import Link from "next/link";
import { notFound } from "next/navigation";

import { Gutter, Screen } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

import { EntryEditor } from "./EntryEditor";

export const metadata = { title: "Journal entry · Sovereign" };

/** One journal entry: read it, change it, refile it or delete it. */
export default async function JournalEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await requireSession();
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("entries")
    .select("id, body, expanded_body, folder, labels, filed_by, created_at, edited_at")
    .eq("id", id)
    .eq("profile_id", userId)
    .maybeSingle();
  if (!data) notFound();

  const body = data.expanded_body ? `${data.body}\n\n${data.expanded_body}` : (data.body as string);
  const when = new Date(data.created_at as string).toLocaleString("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Screen>
      <Gutter className="pt-4">
        <Link href="/individual/vault/journal" className="text-sm text-paper-dim hover:text-paper">
          ← Journal
        </Link>
        <p className="smallcaps mt-4 text-[11px] text-paper-faint">
          {when}
          {data.edited_at ? " · edited" : ""}
          {data.filed_by === "you" ? " · filed by you" : " · filed for you"}
        </p>
        <EntryEditor
          id={data.id as string}
          body={body}
          folder={(data.folder as string | null) ?? null}
          labels={(data.labels as string[]) ?? []}
        />
      </Gutter>
    </Screen>
  );
}
