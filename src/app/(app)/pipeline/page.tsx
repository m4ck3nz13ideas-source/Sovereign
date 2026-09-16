import Link from "next/link";

import { Empty, Page, PageTitle, SectionLabel, Tag } from "@/components/ui";
import { ago, STATUS_LABEL } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Concept, Entry, SurfacedPrompt } from "@/lib/types";

import { IdeaCard } from "./IdeaCard";
import { ImportNotes } from "./ImportNotes";
import { SynthesisCard } from "./SynthesisCard";

export const metadata = { title: "Pipeline · Sovereign" };

/**
 * Pipeline — where ideas land from Launch, and where concepts are developed.
 *
 * Top: the inbox of unprocessed ideas, each with Expand / Connect / Discard.
 * Middle: concepts currently in development.
 * Bottom: a discipline-facing synthesis prompt.
 */
export default async function PipelinePage() {
  const { profile } = await requireSession();
  const supabase = await createClient();

  const [{ data: inbox }, { data: concepts }, { data: prompts }] = await Promise.all([
    supabase
      .from("entries")
      .select("*")
      .eq("profile_id", profile.id)
      .eq("mode", "idea")
      .eq("state", "unexamined")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("concepts")
      .select("*")
      .eq("profile_id", profile.id)
      .neq("status", "dormant")
      .order("updated_at", { ascending: false })
      .limit(40),
    supabase
      .from("ai_prompts_surfaced")
      .select("*")
      .eq("profile_id", profile.id)
      .eq("surface", "pipeline")
      .is("dismissed_at", null)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const ideas = (inbox ?? []) as Entry[];
  const active = (concepts ?? []) as Concept[];
  const prompt = (prompts ?? [])[0] as SurfacedPrompt | undefined;

  return (
    <Page>
      <PageTitle sub="Where ideas are triaged and concepts are built.">
        Pipeline
      </PageTitle>

      <section className="mb-10">
        <SectionLabel right={ideas.length ? `${ideas.length}` : undefined}>
          Inbox
        </SectionLabel>

        {ideas.length ? (
          <ul className="space-y-2">
            {ideas.map((entry) => (
              <li key={entry.id}>
                <IdeaCard
                  entry={{ id: entry.id, body: entry.body, created_at: entry.created_at }}
                  when={ago(entry.created_at)}
                  concepts={active.map((c) => ({ id: c.id, title: c.title }))}
                />
              </li>
            ))}
          </ul>
        ) : (
          <Empty>
            The inbox is clear. What you write in Launch under Idea arrives here.
          </Empty>
        )}
      </section>

      <section className="mb-10">
        <SectionLabel right={<ImportNotes />}>Active concepts</SectionLabel>

        {active.length ? (
          <ul className="space-y-2">
            {active.map((concept) => (
              <li key={concept.id}>
                <Link
                  href={`/pipeline/${concept.id}`}
                  className="block rounded-card border border-line bg-surface-soft p-4 transition-colors hover:border-gold-dim"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-serif text-lg leading-snug text-paper">
                      {concept.title}
                    </h3>
                    <Tag>{STATUS_LABEL[concept.status] ?? concept.status}</Tag>
                  </div>
                  <p className="smallcaps mt-2 text-[10px] text-paper-faint">
                    {[concept.discipline ?? "unfiled", ago(concept.updated_at)].join(" · ")}
                    {concept.source_path ? ` · ${concept.source_path}` : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>
            No concepts yet. One begins when you expand an idea from the inbox,
            or import notes you have already written.
          </Empty>
        )}
      </section>

      <section>
        <SectionLabel>Synthesis prompts</SectionLabel>
        <SynthesisCard prompt={prompt ?? null} ideaCount={ideas.length} />
      </section>
    </Page>
  );
}
