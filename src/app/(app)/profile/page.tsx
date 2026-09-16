import Link from "next/link";

import { Divider, Empty, Page, SectionLabel, Tag } from "@/components/ui";
import { ago, firstLine, shortDate } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type {
  Entry,
  Post,
  ProfilePassion,
  ProfileValue,
  StatementRevision,
} from "@/lib/types";

import { BioEditor } from "./BioEditor";
import { FaithBanner } from "./FaithBanner";
import { PassionsPanel } from "./PassionsPanel";
import { StatementPanel } from "./StatementPanel";
import { ValuesPanel } from "./ValuesPanel";

export const metadata = { title: "Profile · Sovereign" };

/**
 * Profile — the living record of who you are, what you believe, and what you
 * are building toward.
 *
 * "It should feel like opening a personal document, not a social media
 * profile. Spare, considered, and weighted."
 *
 * Faith banners from Launch sit at the top, with the same gentle-pull logic as
 * the banners elsewhere.
 */
export default async function ProfilePage() {
  const { profile, group } = await requireSession();
  const supabase = await createClient();

  const [
    { data: faithEntries },
    { data: values },
    { data: passions },
    { data: revisions },
    { data: posts },
  ] = await Promise.all([
    supabase
      .from("entries")
      .select("*")
      .eq("profile_id", profile.id)
      .eq("mode", "faith")
      .eq("state", "unexamined")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("profile_values")
      .select("*")
      .eq("profile_id", profile.id)
      .order("position", { ascending: true }),
    supabase
      .from("profile_passions")
      .select("*")
      .eq("profile_id", profile.id)
      .order("position", { ascending: true }),
    supabase
      .from("statement_revisions")
      .select("*")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("posts")
      .select("*")
      .eq("author_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const allRevisions = (revisions ?? []) as StatementRevision[];

  return (
    <Page>
      {/* Faith banners — a quiet pull toward reflection, not a notification. */}
      {faithEntries?.length ? (
        <section className="mb-8 space-y-2">
          {(faithEntries as Entry[]).map((e) => (
            <FaithBanner
              key={e.id}
              id={e.id}
              preview={firstLine(e.body)}
              body={e.body}
              when={ago(e.created_at)}
            />
          ))}
        </section>
      ) : null}

      <BioEditor
        displayName={profile.display_name}
        bio={profile.bio}
        email={null}
      />

      <Divider />

      <div className="space-y-3">
        <ValuesPanel
          values={(values ?? []) as ProfileValue[]}
          shared={profile.share_values}
        />

        <StatementPanel
          kind="faith"
          title="Faith and Belief"
          hint="revisable"
          placeholder="Not a creed. A personal articulation, in your own words, of what you hold to be true."
          statement={profile.faith_statement}
          updatedAt={profile.faith_updated_at}
          shared={profile.share_faith}
          revisions={allRevisions.filter((r) => r.kind === "faith")}
        />

        <StatementPanel
          kind="purpose"
          title="Purpose"
          hint="rarely"
          placeholder="A single sentence, or a short paragraph, stating what this life is for."
          statement={profile.purpose}
          updatedAt={profile.purpose_updated_at}
          shared={profile.share_purpose}
          revisions={allRevisions.filter((r) => r.kind === "purpose")}
        />

        <PassionsPanel passions={(passions ?? []) as ProfilePassion[]} />
      </div>

      <Divider />

      <section>
        <SectionLabel right={group ? <Link href="/connection/impact" className="hover:text-gold">the record</Link> : undefined}>
          Recent contributions
        </SectionLabel>

        {posts?.length ? (
          <ul className="space-y-2">
            {(posts as Post[]).map((p) => (
              <li
                key={p.id}
                className="rounded-card border border-line bg-surface-soft px-4 py-3"
              >
                <p className="text-[0.95rem] leading-snug text-paper-dim">
                  {firstLine(p.body, 140)}
                </p>
                <p className="smallcaps mt-1.5 text-[10px] text-paper-faint">
                  {shortDate(p.created_at)}
                  {p.source_tag ? ` · ${p.source_tag}` : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>
            A record rather than a feed. What you post from Connection appears
            here.
          </Empty>
        )}
      </section>

      <div className="mt-10 flex flex-wrap items-center gap-2">
        <Tag>{group ? group.name : "no group yet"}</Tag>
        <Link
          href="/settings"
          className="smallcaps text-[11px] text-paper-faint hover:text-gold"
        >
          Settings
        </Link>
      </div>
    </Page>
  );
}
