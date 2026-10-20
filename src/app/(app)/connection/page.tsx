import Link from "next/link";
import QRCode from "qrcode";

import { TabIntro } from "@/components/TabIntro";
import { TabActions } from "@/components/nav/TabActions";
import { Gutter, Screen, TopBar } from "@/components/ui";
import { isOpen } from "@/lib/collective";
import { env } from "@/lib/env";
import { shortDate, STATUS_LABEL } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Conversation, FriendshipRequest, ProposalStatus, ThreadItem } from "@/lib/types";

import { Inbox, isFilter, markKey, type InboxItem, type Marks } from "./Inbox";
import { PeoplePanel } from "./people/PeoplePanel";
import { PlusMenu } from "./PlusMenu";
import { ShareHandle } from "./ShareHandle";

export const metadata = { title: "Connection · Sovereign" };

/**
 * Connection — everyone and everything you are joined to, in one place.
 *
 * The second tab, by Mackenzie's direction (12 October). In the four
 * quadrants it is the We: relationships and shared meaning, where Individual
 * is the I and Collective is the systems those relationships build.
 *
 * Since 20 October it is one inbox rather than five sections: friends,
 * circles, groups, proposals and businesses together, newest first, with
 * filters, a search over your own list, pin and mute (0055), and a line on
 * each row saying what is happening there. People — finding someone by
 * handle, requests, friends, who you follow — is one of those filters. A group's
 * decisions stay in Collective and a business's page in Market; this is the
 * way in, not a second copy. Nothing here is ranked, and nothing shows anybody
 * how connected anybody else is.
 */

const BUSINESS_STATUS: Record<string, string> = {
  approved: "Approved · listed in Market",
  awaiting_sign_off: "Reviewed · waiting for sign-off",
  unvetted: "Not reviewed yet",
  changed: "Changed since approval · needs review",
  refused_by_ai: "Refused at review",
  refused: "Refused",
  suspended: "Suspended",
};

export default async function ConnectionPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string; handle?: string }>;
}) {
  const { show: rawShow, handle: lookFor } = await searchParams;
  const show = isFilter(rawShow) ? rawShow : lookFor ? "people" : "all";
  const { profile, groups: myGroups } = await requireSession();
  const supabase = await createClient();

  const [{ data: convos }, { data: threadRows }, { data: vendors }, { data: asks }, { data: markRows }] =
    await Promise.all([
      supabase.rpc("my_conversations"),
      supabase.rpc("my_threads"),
      supabase.from("vendors").select("id, name, location").eq("owner_id", profile.id).order("name"),
      supabase.rpc("friendship_requests"),
      supabase.from("connection_marks").select("kind, ref_id, pinned, muted"),
    ]);

  const friends = (convos ?? []) as Conversation[];
  const threads = (threadRows ?? []) as ThreadItem[];
  const businesses = (vendors ?? []) as { id: string; name: string; location: string | null }[];
  const waiting = ((asks ?? []) as FriendshipRequest[]).filter((r) => r.direction === "they asked");

  const groupIds = myGroups.map((g) => g.id);
  const proposalIds = threads.filter((t) => t.kind === "proposal").map((t) => t.ref_id);

  // What is happening in each group, the stage of each proposal chat, a face
  // for each friend and the standing of each business — read alongside.
  const [{ data: openRows }, { data: stageRows }, { data: faces }, statuses] = await Promise.all([
    groupIds.length
      ? supabase
          .from("proposals")
          .select("group_id, status, closes_at")
          .in("group_id", groupIds)
          .in("status", ["in_review", "in_deliberation", "voting"])
      : Promise.resolve({ data: [] }),
    proposalIds.length
      ? supabase.from("proposals").select("id, status").in("id", proposalIds)
      : Promise.resolve({ data: [] }),
    friends.length
      ? supabase.from("public_profiles").select("id, avatar_url").in("id", friends.map((c) => c.profile_id))
      : Promise.resolve({ data: [] }),
    Promise.all(
      businesses.map(async (b) => {
        const { data } = await supabase.rpc("vendor_status", { p_vendor_id: b.id });
        return [b.id, (data as string | null) ?? null] as const;
      }),
    ),
  ]);

  const open = (openRows ?? []) as { group_id: string; status: ProposalStatus; closes_at: string | null }[];
  const stages = new Map(((stageRows ?? []) as { id: string; status: ProposalStatus }[]).map((p) => [p.id, p.status]));
  const avatars = new Map(((faces ?? []) as { id: string; avatar_url: string | null }[]).map((f) => [f.id, f.avatar_url]));
  const standing = new Map(statuses);

  const preview = (t: { last_body: string | null; last_author?: string | null }, mine?: boolean | null) =>
    t.last_body ? `${mine ? "You: " : t.last_author ? `${t.last_author}: ` : ""}${t.last_body}` : "Nothing said yet.";

  const items: InboxItem[] = [
    ...friends.map((c) => ({
      key: `person:${c.profile_id}`,
      kind: "person" as const,
      refId: c.profile_id,
      href: `/chats/${c.profile_id}`,
      title: c.display_name,
      preview: preview(c, c.last_was_mine),
      at: c.last_at,
      unread: c.unread ?? 0,
      avatar: avatars.get(c.profile_id) ?? null,
      detail: null,
      stage: null,
      chatHref: null,
    })),
    ...threads.map((t): InboxItem => {
      const base = {
        key: `${t.kind}:${t.ref_id}`,
        refId: t.ref_id,
        title: t.title,
        preview: preview(t),
        at: t.last_at,
        unread: t.unread ?? 0,
        avatar: null,
        detail: null,
        stage: null,
        chatHref: null,
      };
      if (t.kind === "circle") return { ...base, kind: "circle", href: `/chats/t/${t.thread_id}` };
      if (t.kind === "group") {
        return {
          ...base,
          kind: "group",
          href: `/connection/g/${t.ref_id}`,
          chatHref: `/chats/group/${t.ref_id}`,
          detail: groupActivity(open.filter((p) => p.group_id === t.ref_id)),
        };
      }
      const status = stages.get(t.ref_id) ?? null;
      return {
        ...base,
        kind: "proposal",
        href: `/chats/proposal/${t.ref_id}`,
        stage: status
          ? {
              label: STATUS_LABEL[status] ?? status,
              live: status === "in_review" || isOpen(status),
              href: `/collective/proposals/${t.ref_id}`,
            }
          : null,
      };
    }),
    ...businesses.map((b) => {
      const s = standing.get(b.id) ?? null;
      return {
        key: `business:${b.id}`,
        kind: "business" as const,
        refId: b.id,
        href: `/market/v/${b.id}`,
        title: b.name,
        preview: s ? (BUSINESS_STATUS[s] ?? s) : "Your business",
        at: null,
        unread: 0,
        avatar: null,
        detail: b.location,
        stage: null,
        chatHref: null,
      };
    }),
  ];

  const marks: Marks = Object.fromEntries(
    ((markRows ?? []) as { kind: string; ref_id: string; pinned: boolean; muted: boolean }[]).map((m) => [
      markKey(m.kind, m.ref_id),
      { pinned: m.pinned, muted: m.muted },
    ]),
  );

  const handle = profile.handle ?? null;
  const link = handle ? `${env.canonicalUrl}/connection?show=people&handle=${encodeURIComponent(handle)}` : null;
  const qr = link
    ? await QRCode.toString(link, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } })
    : null;

  return (
    <>
      <TopBar
        title="Connection"
        action={<TabActions plus="/chats/new" plusLabel="New" plusSlot={<PlusMenu />} />}
      />


      <Screen>
        <TabIntro space="connection" />

        {waiting.length && show !== "people" ? (
          <Gutter className="pt-3">
            <Link
              href="/connection?show=people"
              className="press flex items-center justify-between gap-3 rounded-card border border-gold-dim bg-gold-wash px-4 py-3"
            >
              <span className="text-[0.9375rem] text-paper">
                {waiting.length === 1
                  ? `${waiting[0].display_name} wants to connect`
                  : `${waiting.length} people want to connect`}
              </span>
              <span className="smallcaps shrink-0 text-[11px] text-gold">Review →</span>
            </Link>
          </Gutter>
        ) : null}

        <Inbox
          items={items}
          marks={marks}
          show={show}
          waiting={waiting.length}
          people={<PeoplePanel handle={(lookFor ?? "").replace(/^@/, "").slice(0, 40)} />}
        />

        {friends.length < 3 ? (
          <Gutter className="pt-8">
            <ShareHandle handle={handle} link={link} qr={qr} />
          </Gutter>
        ) : null}
      </Screen>
    </>
  );
}

/** "3 proposals open · one closes Friday" — or nothing, when nothing is. */
function groupActivity(open: { closes_at: string | null }[]): string | null {
  if (!open.length) return null;
  const count = open.length === 1 ? "1 proposal open" : `${open.length} proposals open`;
  const now = Date.now();
  const next = open
    .map((p) => (p.closes_at ? new Date(p.closes_at).getTime() : null))
    .filter((t): t is number => t !== null && t > now)
    .sort((a, b) => a - b)[0];
  if (!next) return count;
  const days = (next - now) / 86_400_000;
  const when =
    days < 1
      ? "today"
      : days < 7
        ? new Date(next).toLocaleDateString("en-GB", { weekday: "long", timeZone: "Europe/London" })
        : shortDate(new Date(next).toISOString());
  return `${count} · ${open.length === 1 ? "closes" : "one closes"} ${when}`;
}

export const dynamic = "force-dynamic";
