import Link from "next/link";

import { Empty, Gutter, Screen, SectionLabel, Tag } from "@/components/ui";
import { addressOptions, requireAddress } from "@/lib/address";
import { ago } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { ScaleSelector } from "@/components/nav/ScaleSelector";

export const metadata = { title: "Debate · Sovereign" };

/**
 * Debate — every live argument at this scale, in one place.
 *
 *   Screen 3: "Unlike social media, debate here focuses on improving
 *   proposals."
 *
 * The contributions themselves live on each proposal, where they belong. What
 * this screen does is make them findable: a thread three people are working on
 * is invisible if you have to open eleven proposals to notice it.
 */
export default async function DebatePage() {
  const session = await requireAddress();
  const { address } = session;
  const supabase = await createClient();

  const base = supabase
    .from("proposals")
    .select("id, title, summary, status, deliberation_comments(id, kind, answered_at, created_at)")
    .in("status", ["in_review", "in_deliberation", "voting"]);

  const { data } =
    address.kind === "group"
      ? await base.eq("group_id", address.group.id).limit(40)
      : await base.is("group_id", null).eq("scope", address.scope).limit(40);

  const rows = (data ?? []) as unknown as {
    id: string;
    title: string;
    summary: string;
    deliberation_comments: {
      id: string;
      kind: string;
      answered_at: string | null;
      created_at: string;
    }[];
  }[];

  const live = rows
    .map((p) => {
      const cs = p.deliberation_comments ?? [];
      const open = cs.filter(
        (c) => ["question", "concern"].includes(c.kind) && !c.answered_at,
      ).length;
      const last = cs.reduce<string | null>(
        (a, c) => (!a || c.created_at > a ? c.created_at : a),
        null,
      );
      return { ...p, count: cs.length, open, last };
    })
    .filter((p) => p.count > 0)
    .sort((a, b) => (b.last ?? "").localeCompare(a.last ?? ""));

  return (
    <Screen>
      <ScaleSelector
        options={addressOptions(session)}
        current={
          address.kind === "group"
            ? `group:${address.group.id}`
            : `scope:${address.scope}`
        }
      />

      <Gutter className="pt-2">
        <SectionLabel>Being argued now</SectionLabel>
      </Gutter>

      {live.length ? (
        <ul>
          {live.map((p) => (
            <li key={p.id}>
              <Link
                href={`/collective/proposals/${p.id}`}
                className="press block border-b border-line-soft px-5 py-4 active:bg-surface-soft"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="display text-[1.0625rem] leading-snug text-paper">
                    {p.title}
                  </h3>
                  {p.open ? (
                    <Tag tone="gold">{p.open} unanswered</Tag>
                  ) : (
                    <Tag>answered</Tag>
                  )}
                </div>
                <p className="mt-1 text-[0.9375rem] leading-relaxed text-paper-dim">
                  {p.summary}
                </p>
                <p className="mt-2 text-[0.8125rem] text-paper-faint">
                  {p.count} {p.count === 1 ? "contribution" : "contributions"}
                  {p.last ? ` · last ${ago(p.last)}` : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Gutter>
          <Empty>
            Nothing is being argued here. A question on an open proposal is the
            place to start one — somebody has to answer it in writing, and it
            stays on the record unanswered if nobody does.
          </Empty>
        </Gutter>
      )}
    </Screen>
  );
}

export const dynamic = "force-dynamic";
