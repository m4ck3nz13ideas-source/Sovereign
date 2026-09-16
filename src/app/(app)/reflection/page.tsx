import { Empty, Page, PageTitle, SectionLabel } from "@/components/ui";
import { ago, daysAgoIso, firstLine } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Entry, SurfacedPrompt } from "@/lib/types";

import { EntryBanner } from "./EntryBanner";
import { PatternTracker } from "./PatternTracker";
import { PromptCard } from "./PromptCard";

export const metadata = { title: "Reflection · Sovereign" };

/**
 * Reflection — where raw entries land, get examined, and become patterns.
 *
 * Three sections, top to bottom: what is unexamined, the rhythm of the last
 * thirty days, and one question drawn from the entries.
 */
export default async function ReflectionPage() {
  const { profile } = await requireSession();
  const supabase = await createClient();

  const thirtyDaysAgo = daysAgoIso(30);

  const [{ data: unexamined }, { data: recent }, { data: prompts }] = await Promise.all([
    supabase
      .from("entries")
      .select("*")
      .eq("profile_id", profile.id)
      .eq("state", "unexamined")
      .eq("mode", "journal")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("entries")
      .select("mode, created_at")
      .eq("profile_id", profile.id)
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: true }),
    supabase
      .from("ai_prompts_surfaced")
      .select("*")
      .eq("profile_id", profile.id)
      .eq("surface", "reflection")
      .is("dismissed_at", null)
      .is("responded_at", null)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const entries = (unexamined ?? []) as Entry[];
  const prompt = (prompts ?? [])[0] as SurfacedPrompt | undefined;

  return (
    <Page>
      <PageTitle sub="Where what you wrote gets sat with.">Reflection</PageTitle>

      <section className="mb-10">
        <SectionLabel right={entries.length ? `${entries.length}` : undefined}>
          Unexamined
        </SectionLabel>

        {entries.length ? (
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li key={entry.id}>
                <EntryBanner
                  id={entry.id}
                  preview={firstLine(entry.body)}
                  body={entry.body}
                  when={ago(entry.created_at)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <Empty>
            Nothing is waiting. What you write in Launch under Journal arrives
            here.
          </Empty>
        )}
      </section>

      <section className="mb-10">
        <SectionLabel right="last 30 days">Patterns</SectionLabel>
        <PatternTracker entries={recent ?? []} />
      </section>

      <section>
        <SectionLabel>Prompts from your entries</SectionLabel>
        <PromptCard prompt={prompt ?? null} hasEntries={entries.length > 0} />
      </section>
    </Page>
  );
}
