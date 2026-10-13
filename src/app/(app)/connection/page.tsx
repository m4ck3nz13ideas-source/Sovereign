import Link from "next/link";
import { TabIntro } from "@/components/TabIntro";

import { TabActions } from "@/components/nav/TabActions";
import { Empty, Gutter, Rail, Row, Screen, SectionLabel, Tag, TopBar } from "@/components/ui";
import { ago } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Conversation, ThreadItem } from "@/lib/types";

import { GroupRow } from "./GroupRow";

export const metadata = { title: "Connection · Sovereign" };

/**
 * Connection — everyone and everything you are joined to, in one place.
 *
 * The second tab, by Mackenzie's direction (12 October). In the four
 * quadrants it is the We: relationships and shared meaning, where Individual
 * is the I and Collective is the systems those relationships build. Search,
 * in the centre, is where you land; this is where you find your people.
 *
 * Every chat lives here: one friend, a circle of friends (0052), each group
 * you are in, each proposal you wrote or back. A group's decisions stay in
 * Collective and a business's page in Market — this is the way in, not a
 * second copy. Nothing here is ranked, and nothing shows anybody how
 * connected anybody else is.
 */
type Chat = {
  key: string;
  href: string;
  title: string;
  preview: string;
  at: string | null;
  unread: number;
  many: boolean;
};

const PILL =
  "press shrink-0 rounded-pill bg-surface px-3.5 py-1.5 text-[0.8125rem] font-medium text-paper-dim";

export default async function ConnectionPage() {
  const { profile } = await requireSession();
  const supabase = await createClient();

  const [{ data: convos }, { data: threadRows }, { data: people }, { data: vendors }] = await Promise.all([
    supabase.rpc("my_conversations"),
    supabase.rpc("my_threads"),
    supabase.rpc("my_people"),
    supabase.from("vendors").select("id, name").eq("owner_id", profile.id).order("name"),
  ]);

  const threads = (threadRows ?? []) as ThreadItem[];
  const preview = (t: { last_body: string | null; last_author?: string | null }, mine?: boolean | null) =>
    t.last_body ? `${mine ? "You: " : t.last_author ? `${t.last_author}: ` : ""}${t.last_body}` : "Nothing said yet.";

  // One friend and circles of friends, together, newest first.
  const chats: Chat[] = [
    ...((convos ?? []) as Conversation[]).map((c) => ({
      key: `p:${c.profile_id}`,
      href: `/chats/${c.profile_id}`,
      title: c.display_name,
      preview: preview(c, c.last_was_mine),
      at: c.last_at,
      unread: c.unread ?? 0,
      many: false,
    })),
    ...threads
      .filter((t) => t.kind === "circle")
      .map((t) => ({
        key: `c:${t.ref_id}`,
        href: `/chats/t/${t.thread_id}`,
        title: t.title,
        preview: preview(t),
        at: t.last_at,
        unread: t.unread ?? 0,
        many: true,
      })),
  ].sort((a, b) => (b.at ?? "").localeCompare(a.at ?? "") || a.title.localeCompare(b.title));

  const groups = threads.filter((t) => t.kind === "group");
  const proposals = threads.filter((t) => t.kind === "proposal");
  const following = ((people ?? []) as { profile_id: string; display_name: string; tie: string }[]).filter(
    (p) => p.tie === "following",
  );
  const businesses = (vendors ?? []) as { id: string; name: string }[];
  const count = (xs: { unread: number }[]) => xs.reduce((n, x) => n + (x.unread ?? 0), 0);

  return (
    <>
      <TopBar title="Connection" action={<TabActions plus="/chats/new" plusLabel="New group chat" />}>
        <Rail>
          <a href="#chats" className={PILL}>Chats{count(chats) ? ` · ${count(chats)}` : ""}</a>
          <a href="#groups" className={PILL}>Groups{count(groups) ? ` · ${count(groups)}` : ""}</a>
          <a href="#proposals" className={PILL}>Proposals{count(proposals) ? ` · ${count(proposals)}` : ""}</a>
          <a href="#businesses" className={PILL}>Businesses</a>
          <a href="#following" className={PILL}>Following</a>
        </Rail>
      </TopBar>

      <Screen>
        <TabIntro space="connection" />
        <section id="chats" className="scroll-mt-28 pt-5">
          <Gutter>
            <SectionLabel right={<Link href="/chats/new" className="text-gold">new group</Link>}>Chats</SectionLabel>
          </Gutter>
          {chats.length ? (
            chats.map((c) => (
              <Row key={c.key} href={c.href}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[0.95rem] text-paper">
                    {c.title}
                    {c.many ? <span className="smallcaps ml-2 text-[10px] text-paper-faint">group</span> : null}
                  </span>
                  <span className="smallcaps shrink-0 text-[10px] text-paper-faint">
                    {c.unread ? <Tag tone="gold">{c.unread} new</Tag> : c.at ? ago(c.at) : null}
                  </span>
                </div>
                <p className="mt-1 truncate text-[0.875rem] text-paper-dim">{c.preview}</p>
              </Row>
            ))
          ) : (
            <Gutter>
              <Empty>No friends yet. A chat opens when you both agree.</Empty>
            </Gutter>
          )}
        </section>

        <section id="groups" className="scroll-mt-28 pt-7">
          <Gutter>
            <SectionLabel>Groups</SectionLabel>
          </Gutter>
          {groups.length ? (
            groups.map((g) => (
              <GroupRow key={g.ref_id} id={g.ref_id} name={g.title} preview={preview(g)} unread={g.unread ?? 0} />
            ))
          ) : (
            <Gutter>
              <Empty>No groups yet. Groups are by invitation.</Empty>
            </Gutter>
          )}
        </section>

        <section id="proposals" className="scroll-mt-28 pt-7">
          <Gutter>
            <SectionLabel>Proposals</SectionLabel>
          </Gutter>
          {proposals.length ? (
            proposals.map((p) => (
              <Row key={p.ref_id} href={`/chats/proposal/${p.ref_id}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[0.95rem] text-paper">{p.title}</span>
                  {p.unread ? <Tag tone="gold">{p.unread} new</Tag> : null}
                </div>
                <p className="mt-1 truncate text-[0.875rem] text-paper-dim">{preview(p)}</p>
              </Row>
            ))
          ) : (
            <Gutter>
              <Empty>Proposals you write or back get a chat here.</Empty>
            </Gutter>
          )}
        </section>

        <section id="businesses" className="scroll-mt-28 pt-7">
          <Gutter>
            <SectionLabel right={<Link href="/market/sell" className="text-gold">add</Link>}>Businesses</SectionLabel>
          </Gutter>
          {businesses.length ? (
            businesses.map((v) => (
              <Row key={v.id} href={`/market/v/${v.id}`}>
                <span className="text-[0.95rem] text-paper">{v.name}</span>
              </Row>
            ))
          ) : (
            <Gutter>
              <Empty>Businesses you run show here.</Empty>
            </Gutter>
          )}
        </section>

        <section id="following" className="scroll-mt-28 pt-7 pb-6">
          <Gutter>
            <SectionLabel right={<Link href="/collective/people" className="text-gold">find someone</Link>}>
              Following
            </SectionLabel>
          </Gutter>
          {following.length ? (
            following.map((p) => (
              <Row key={p.profile_id} href={`/collective/people/${p.profile_id}`}>
                <span className="text-[0.95rem] text-paper">{p.display_name}</span>
              </Row>
            ))
          ) : (
            <Gutter>
              <Empty>Nobody yet.</Empty>
            </Gutter>
          )}
        </section>
      </Screen>
    </>
  );
}

export const dynamic = "force-dynamic";
