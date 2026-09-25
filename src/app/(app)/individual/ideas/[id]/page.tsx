import Link from "next/link";
import { notFound } from "next/navigation";

import { Page, SectionLabel, Tag } from "@/components/ui";
import { ago, STATUS_LABEL } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Concept, Entry } from "@/lib/types";

import { ConceptEditor } from "./ConceptEditor";

/** A reading and annotation view for one concept. */
export default async function ConceptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireSession();
  const supabase = await createClient();

  const { data: concept } = await supabase
    .from("concepts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!concept) notFound();

  const { data: links } = await supabase
    .from("concept_entries")
    .select("entries(*)")
    .eq("concept_id", id);

  const sources = (links ?? [])
    .map((l) => l.entries as unknown as Entry | null)
    .filter((e): e is Entry => Boolean(e))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const c = concept as Concept;

  return (
    <Page>
      <Link
        href="/individual/ideas"
        className="smallcaps mb-6 inline-block text-[11px] text-paper-faint hover:text-gold"
      >
        ← Pipeline
      </Link>

      <ConceptEditor concept={c} />

      {sources.length ? (
        <section className="mt-10">
          <SectionLabel right={`${sources.length}`}>
            Entries that fed this
          </SectionLabel>
          <ul className="space-y-2">
            {sources.map((e) => (
              <li
                key={e.id}
                className="rounded-card border border-line bg-surface-soft px-4 py-3"
              >
                <p className="text-[0.95rem] leading-snug text-paper-dim">{e.body}</p>
                <p className="smallcaps mt-1.5 text-[10px] text-paper-faint">
                  {ago(e.created_at)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="smallcaps mt-10 text-[10px] text-paper-faint">
        <Tag>{STATUS_LABEL[c.status] ?? c.status}</Tag>
        <span className="ml-2">
          started {ago(c.created_at)}
          {c.source_path ? ` · from ${c.source_path}` : ""}
        </span>
      </p>
    </Page>
  );
}
