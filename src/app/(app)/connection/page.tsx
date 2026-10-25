import Link from "next/link";
import QRCode from "qrcode";

import { TabIntro } from "@/components/TabIntro";
import { TabActions } from "@/components/nav/TabActions";
import { Gutter, Screen, TopBar } from "@/components/ui";
import { InviteCard } from "@/app/(app)/market/_ops/Team";
import type { Desk } from "@/lib/business";
import { isOpen } from "@/lib/collective";
import { env } from "@/lib/env";
import { shortDate, STATUS_LABEL } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Conversation, FriendshipRequest, ProposalStatus, ThreadItem } from "@/lib/types";

import { isFilter, markKey } from "./filters";
import { Inbox, type InboxItem, type Marks } from "./Inbox";
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

  const [
    { data: convos },
    { data: threadRows },
    { data: deskRows },
    { data: asks },
    { data: markRows },
    { data: chatRows },
    { data: inviteRows },
  ] = await Promise.all([
    supabase.rpc("my_conversations"),
    supabase.rpc("my_threads"),
    supabase.rpc("my_vendor_desks"),
    supabase.rpc("friendship_requests"),
    supabase.from("connection_marks").select("kind, ref_id, pinned, muted"),
    supabase.rpc("my_vendor_chats"),
    supabase.rpc("my_vendor_invites"),
  ]);

  const friends = (convos ?? []) as Conversation[];
  const threads = (threadRows ?? []) as ThreadItem[];
  // Businesses you run or work for (0062): each opens its desk.
  const businesses = (deskRows ?? []) as Desk[];
  // Businesses you have written to as a customer.
  const vendorChats = (chatRows ?? []) as {
    conversation_id: string;
    vendor_id: string;
    vendor_name: string;
    last_body: string | null;
    last_from_business: boolean | null;
    last_at: string;
    unread: number;
  }[];
  const invites = (inviteRows ?? []) as {
    vendor_id: string;
    vendor_name: string;
    role: string;
    invited_by: string;
  }[];
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
        const { data } = await supabase.rpc("vendor_status", { p_vendor_id: b.vendor_id });
        return [b.vendor_id, (data as string | null) ?? null] as const;
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
      const s = standing.get(b.vendor_id) ?? null;
      return {
        key: `business:${b.vendor_id}`,
        kind: "business" as const,
        refId: b.vendor_id,
        href: `/market/b/${b.vendor_id}`,
        title: b.vendor_name,
        preview: deskLine(b) ?? (s ? (BUSINESS_STATUS[s] ?? s) : "Your business"),
        at: b.last_at,
        unread: b.to_answer + b.problems + b.unread,
        avatar: null,
        detail: `${b.role === "owner" ? "You own it" : `You are ${b.role}`}${s ? ` · ${BUSINESS_STATUS[s] ?? s}` : ""}`,
        stage: null,
        chatHref: null,
      };
    }),
    ...vendorChats.map((c) => ({
      key: `business:${c.conversation_id}`,
      kind: "business" as const,
      refId: c.conversation_id,
      href: `/market/m/${c.conversation_id}`,
      title: c.vendor_name,
      preview: c.last_body ? `${c.last_from_business ? "" : "You: "}${c.last_body}` : "Nothing said yet.",
      at: c.last_at,
      unread: c.unread ?? 0,
      avatar: null,
      detail: null,
      stage: null,
      chatHref: null,
    })),
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
        action={<TabActions space="connection" plus="/chats/new" plusLabel="New" plusSlot={<PlusMenu />} />}
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

        {invites.length && (show === "all" || show === "businesses") ? (
          <Gutter className="space-y-2 pt-3">
            {invites.map((i) => (
              <InviteCard
                key={i.vendor_id}
                vendorId={i.vendor_id}
                vendorName={i.vendor_name}
                role={i.role}
                invitedBy={i.invited_by}
              />
            ))}
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

/** "2 to answer · 1 problem · 3 unread" — what the desk is waiting on, or nothing. */
function deskLine(b: Desk): string | null {
  const parts = [
    b.to_answer ? `${b.to_answer} to answer` : null,
    b.problems ? `${b.problems} ${b.problems === 1 ? "problem" : "problems"}` : null,
    b.unread ? `${b.unread} unread` : null,
    b.in_progress ? `${b.in_progress} in progress` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
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
