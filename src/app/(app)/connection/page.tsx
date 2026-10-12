import { TabActions } from "@/components/nav/TabActions";
import { Empty, Gutter, Rail, Row, Screen, SectionLabel, Tag, TopBar } from "@/components/ui";
import { ago } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Conversation } from "@/lib/types";

import { GroupRow } from "./GroupRow";

export const metadata = { title: "Connection · Sovereign" };

/**
 * Connection — everyone and everything you are joined to, in one place.
 *
 * The second tab, by Mackenzie's direction (12 October). In the four
 * quadrants it is the We: relationships and shared meaning, where Individual
 * is the I and Collective is the systems those relationships build. Search,
 * in the centre, is where you land; this is where you go to find your people.
 *
 * It holds the ways in, not the things themselves: a group's decisions stay in
 * Collective, a business's page stays in Market, a proposal stays where it is
 * read and decided. Nothing here is ranked, and nothing shows anybody how
 * connected anybody else is.
 */
export default async function ConnectionPage() {
  const session = await requireSession();
  const { profile, groups } = session;
  const supabase = await createClient();

  const [{ data: convos }, { data: people }, { data: authored }, { data: pledged }, { data: vendors }] =
    await Promise.all([
      supabase.rpc("my_conversations"),
      supabase.rpc("my_people"),
      supabase
        .from("proposals")
        .select("id, title, status, submitted_at")
        .eq("author_id", profile.id)
        .order("submitted_at", { ascending: false })
        .limit(20),
      supabase
        .from("commitments")
        .select("proposal_id, proposals(id, title, status)")
        .eq("profile_id", profile.id)
        .is("withdrawn_at", null)
        .limit(40),
      supabase.from("vendors").select("id, name").eq("owner_id", profile.id).order("name"),
    ]);

  const chats = (convos ?? []) as Conversation[];
  const following = ((people ?? []) as { profile_id: string; display_name: string; tie: string }[]).filter(
    (p) => p.tie === "following",
  );

  // Proposals you are part of: the ones you wrote, then the ones you have put
  // something behind. One row each, whichever way you are in.
  type P = { id: string; title: string; status: string };
  const mine = new Map<string, P & { how: string }>();
  for (const p of (authored ?? []) as P[]) mine.set(p.id, { ...p, how: "yours" });
  for (const c of (pledged ?? []) as unknown as { proposals: P | null }[]) {
    if (c.proposals && !mine.has(c.proposals.id)) mine.set(c.proposals.id, { ...c.proposals, how: "backing" });
  }
  const proposals = [...mine.values()];
  const businesses = (vendors ?? []) as { id: string; name: string }[];
  const unread = chats.reduce((n, c) => n + (c.unread ?? 0), 0);

  return (
    <>
      <TopBar
        title="Connection"
        action={<TabActions plus="/collective/people" plusLabel="Find someone" />}
      >
        <Rail>
          <a href="#chats" className="press shrink-0 rounded-pill bg-surface px-3.5 py-1.5 text-[0.8125rem] font-medium text-paper-dim">
            Chats{unread ? ` · ${unread}` : ""}
          </a>
          <a href="#groups" className="press shrink-0 rounded-pill bg-surface px-3.5 py-1.5 text-[0.8125rem] font-medium text-paper-dim">
            Groups
          </a>
          <a href="#proposals" className="press shrink-0 rounded-pill bg-surface px-3.5 py-1.5 text-[0.8125rem] font-medium text-paper-dim">
            Proposals
          </a>
          <a href="#businesses" className="press shrink-0 rounded-pill bg-surface px-3.5 py-1.5 text-[0.8125rem] font-medium text-paper-dim">
            Businesses
          </a>
          <a href="#following" className="press shrink-0 rounded-pill bg-surface px-3.5 py-1.5 text-[0.8125rem] font-medium text-paper-dim">
            Following
          </a>
        </Rail>
      </TopBar>

      <Screen>
        {/* ---------------------------------------------------------- CHATS */}
        <section id="chats" className="scroll-mt-28 pt-5">
          <Gutter>
            <SectionLabel>Chats</SectionLabel>
          </Gutter>
          {chats.length ? (
            chats.map((t) => (
              <Row key={t.profile_id} href={`/chats/${t.profile_id}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[0.95rem] text-paper">{t.display_name}</span>
                  <span className="smallcaps text-[10px] text-paper-faint">
                    {t.unread ? <Tag tone="gold">{t.unread} new</Tag> : t.last_at ? ago(t.last_at) : null}
                  </span>
                </div>
                <p className="mt-1 truncate text-[0.875rem] text-paper-dim">
                  {t.last_body ? `${t.last_was_mine ? "You: " : ""}${t.last_body}` : "Nothing said yet."}
                </p>
              </Row>
            ))
          ) : (
            <Gutter>
              <Empty>No friends yet. A chat opens when you both agree.</Empty>
            </Gutter>
          )}
        </section>

        {/* --------------------------------------------------------- GROUPS */}
        <section id="groups" className="scroll-mt-28 pt-7">
          <Gutter>
            <SectionLabel>Groups</SectionLabel>
          </Gutter>
          {groups.length ? (
            groups.map((g) => <GroupRow key={g.id} id={g.id} name={g.name} role={g.role} />)
          ) : (
            <Gutter>
              <Empty>No groups yet. Groups are by invitation.</Empty>
            </Gutter>
          )}
        </section>

        {/* ------------------------------------------------------ PROPOSALS */}
        <section id="proposals" className="scroll-mt-28 pt-7">
          <Gutter>
            <SectionLabel>Proposals</SectionLabel>
          </Gutter>
          {proposals.length ? (
            proposals.map((p) => (
              <Row key={p.id} href={`/collective/proposals/${p.id}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[0.95rem] text-paper">{p.title}</span>
                  <span className="smallcaps shrink-0 text-[10px] text-paper-faint">
                    {p.how} · {p.status.replace(/_/g, " ")}
                  </span>
                </div>
              </Row>
            ))
          ) : (
            <Gutter>
              <Empty>Proposals you write or back show here.</Empty>
            </Gutter>
          )}
        </section>

        {/* ----------------------------------------------------- BUSINESSES */}
        <section id="businesses" className="scroll-mt-28 pt-7">
          <Gutter>
            <SectionLabel>Businesses</SectionLabel>
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

        {/* ------------------------------------------------------ FOLLOWING */}
        <section id="following" className="scroll-mt-28 pt-7 pb-6">
          <Gutter>
            <SectionLabel>Following</SectionLabel>
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
