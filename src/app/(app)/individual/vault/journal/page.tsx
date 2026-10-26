import Link from "next/link";

import { Empty, Gutter, inputClass, PillLink, Rail, Readers, Screen } from "@/components/ui";
import { firstLine } from "@/lib/format";
import { FOLDERS, folderName, isFolder } from "@/lib/journal";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

import { Composer } from "./Composer";
import { fileWaiting } from "./fileWaiting";

export const metadata = { title: "Journal · Sovereign" };
export const dynamic = "force-dynamic";

type Row = {
  id: string;
  body: string;
  expanded_body: string | null;
  folder: string | null;
  labels: string[];
  created_at: string;
};

/**
 * Vault › Journal. Write at the top; everything you have written below,
 * filed into the five areas and labelled, newest first. Tap a folder, a label
 * or search to narrow it; tap an entry to read, change or refile it.
 */
export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string; label?: string; q?: string }>;
}) {
  const { userId } = await requireSession();
  const sp = await searchParams;
  const folder = sp.folder === "Other" ? "Other" : isFolder(sp.folder) ? sp.folder : null;
  const label = sp.label?.trim().toLowerCase() || null;
  const q = sp.q?.trim().slice(0, 80) || "";

  await fileWaiting(userId);
  const supabase = await createClient();

  let list = supabase
    .from("entries")
    .select("id, body, expanded_body, folder, labels, created_at")
    .eq("profile_id", userId)
    .eq("mode", "journal")
    .order("created_at", { ascending: false })
    .limit(100);
  if (folder === "Other") list = list.is("folder", null);
  else if (folder) list = list.eq("folder", folder);
  if (label) list = list.contains("labels", [label]);
  if (q) {
    const term = `"%${q.replace(/[%_,()"\\]/g, " ")}%"`;
    list = list.or(`body.ilike.${term},expanded_body.ilike.${term}`);
  }

  const [{ data: rows }, { data: all }] = await Promise.all([
    list,
    supabase.from("entries").select("folder, labels").eq("profile_id", userId).eq("mode", "journal"),
  ]);

  const entries = (rows ?? []) as Row[];
  const everything = (all ?? []) as { folder: string | null; labels: string[] }[];

  const folderCount = new Map<string, number>();
  for (const e of everything) folderCount.set(folderName(e.folder), (folderCount.get(folderName(e.folder)) ?? 0) + 1);

  // Labels to filter by: the ones used in the folder being looked at.
  const labelCount = new Map<string, number>();
  for (const e of everything) {
    if (folder && folderName(e.folder) !== folder) continue;
    for (const l of e.labels ?? []) labelCount.set(l, (labelCount.get(l) ?? 0) + 1);
  }
  const topLabels = [...labelCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);

  const href = (next: { folder?: string | null; label?: string | null; q?: string }) => {
    const p = new URLSearchParams();
    const f = next.folder === undefined ? folder : next.folder;
    const l = next.label === undefined ? label : next.label;
    const s = next.q === undefined ? q : next.q;
    if (f) p.set("folder", f);
    if (l) p.set("label", l);
    if (s) p.set("q", s);
    const qs = p.toString();
    return `/individual/vault/journal${qs ? `?${qs}` : ""}`;
  };

  const days = groupByDay(entries);

  return (
    <Screen>
      <Gutter className="pt-4">
        <div className="mb-3 flex items-baseline justify-between">
          <Link href="/individual/vault" className="text-sm text-paper-dim hover:text-paper">
            ← Vault
          </Link>
          <Readers>Only you. No group, friend or steward has a way in.</Readers>
        </div>
        <Composer />
      </Gutter>

      <div className="mt-4">
        <Rail>
          <PillLink href={href({ folder: null, label: null })} active={!folder}>
            All {everything.length ? <span className="ml-1 opacity-60">{everything.length}</span> : null}
          </PillLink>
          {[...FOLDERS, "Other"].map((f) =>
            folderCount.get(f) || folder === f ? (
              <PillLink key={f} href={href({ folder: f, label: null })} active={folder === f}>
                {f} <span className="ml-1 opacity-60">{folderCount.get(f) ?? 0}</span>
              </PillLink>
            ) : null,
          )}
        </Rail>
      </div>

      <Gutter className="space-y-4 pt-2">
        <form action="/individual/vault/journal" className="flex gap-2">
          {folder ? <input type="hidden" name="folder" value={folder} /> : null}
          {label ? <input type="hidden" name="label" value={label} /> : null}
          <input name="q" defaultValue={q} placeholder="Search your journal" aria-label="Search your journal" className={`${inputClass} py-2 text-[0.9375rem]`} />
        </form>

        {topLabels.length ? (
          <div className="flex flex-wrap gap-1.5">
            {topLabels.map(([l, n]) => (
              <Link
                key={l}
                href={href({ label: label === l ? null : l })}
                className={`press rounded-pill border px-2.5 py-1 text-[0.8125rem] ${
                  label === l ? "border-gold text-gold" : "border-line text-paper-dim"
                }`}
              >
                #{l} <span className="opacity-60">{n}</span>
              </Link>
            ))}
          </div>
        ) : null}

        {days.length ? (
          days.map(([day, list]) => (
            <section key={day}>
              <p className="smallcaps mb-1 text-[11px] text-paper-faint">{day}</p>
              <ul>
                {list.map((e) => (
                  <li key={e.id}>
                    <Link href={`/individual/vault/journal/${e.id}`} className="press block border-b border-line-soft py-3">
                      <p className="line-clamp-2 text-[0.95rem] leading-snug text-paper">
                        {firstLine(e.expanded_body || e.body, 160)}
                      </p>
                      <p className="mt-1 text-[0.75rem] text-paper-faint">
                        {time(e.created_at)} · {folderName(e.folder)}
                        {e.labels?.length ? ` · ${e.labels.map((l) => `#${l}`).join(" ")}` : ""}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        ) : (
          <Empty>
            {q || label || folder ? "Nothing here matches." : "Your journal is empty. Write the first one above."}
          </Empty>
        )}
      </Gutter>
    </Screen>
  );
}

const TZ = "Europe/London";

function groupByDay(rows: Row[]): [string, Row[]][] {
  const out = new Map<string, Row[]>();
  for (const r of rows) {
    const key = new Date(r.created_at).toLocaleDateString("en-GB", {
      timeZone: TZ,
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    out.set(key, [...(out.get(key) ?? []), r]);
  }
  return [...out.entries()];
}

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
}
