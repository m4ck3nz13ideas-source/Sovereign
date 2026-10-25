import Link from "next/link";
import { notFound } from "next/navigation";

import { Empty, Page, PillLink, Rail, Readers, SectionLabel, Tag, TopBar } from "@/components/ui";
import {
  type Order,
  type Review,
  type ReviewSummary,
  type TeamMember,
  type TeamRole,
} from "@/lib/business";
import { ago, firstLine } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

import { ReviewBars, ReviewList } from "../../_ops/Reviews";
import { OrderRow } from "../../_ops/OrderRow";
import { TeamPanel } from "../../_ops/Team";

export const metadata = { title: "Business desk · Sovereign" };

type Tab = "orders" | "messages" | "team" | "reviews";
const TABS: { key: Tab; label: string }[] = [
  { key: "orders", label: "Orders" },
  { key: "messages", label: "Messages" },
  { key: "reviews", label: "Reviews" },
  { key: "team", label: "Team" },
];

/**
 * The desk: where a business's team runs it day to day (0062, rule 55).
 * Orders and bookings to answer, customers' messages, reviews to reply to,
 * and the team. What the business claims, its vetting and its ads stay on
 * the owner's Sell page, because they are what a reviewer signed off and what
 * the business spends.
 */
export default async function DeskPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, { tab: rawTab }] = await Promise.all([params, searchParams]);
  const tab: Tab = TABS.some((t) => t.key === rawTab) ? (rawTab as Tab) : "orders";
  const { userId } = await requireSession();
  const supabase = await createClient();

  const [{ data: role }, { data: vendor }, { data: status }] = await Promise.all([
    supabase.rpc("vendor_team_role", { p_vendor_id: id }),
    supabase.from("vendors").select("id, name").eq("id", id).maybeSingle(),
    supabase.rpc("vendor_status", { p_vendor_id: id }),
  ]);
  if (!role || !vendor) notFound();
  const me = role as TeamRole;
  const name = (vendor as { name: string }).name;

  return (
    <>
      <TopBar title={name} back="/connection?show=businesses">
        <Rail>
          {TABS.map((t) => (
            <PillLink key={t.key} href={`/market/b/${id}?tab=${t.key}`} active={tab === t.key}>
              {t.label}
            </PillLink>
          ))}
        </Rail>
      </TopBar>
      <Page>
        <div className="mb-5 flex flex-wrap items-center justify-center gap-3 text-sm">
          <Tag tone={status === "approved" ? "calm" : "gold"}>
            {status === "approved" ? "approved · in Market" : "not in Market right now"}
          </Tag>
          <Link href={`/market/v/${id}`} className="text-gold hover:underline">
            Public page
          </Link>
          {me === "owner" ? (
            <Link href="/market/sell" className="text-gold hover:underline">
              Claims, vetting and ads
            </Link>
          ) : null}
        </div>
        <Readers className="mb-6 text-center">
          Everyone on this business&rsquo;s team sees its orders and messages. Customers see their own.
          A marketplace reviewer sees an order only once a problem has been reported on it.
        </Readers>

        {tab === "orders" ? <Orders vendorId={id} /> : null}
        {tab === "messages" ? <Messages vendorId={id} /> : null}
        {tab === "reviews" ? <Reviews vendorId={id} canReply={me !== "staff"} /> : null}
        {tab === "team" ? <Team vendorId={id} me={userId} owner={me === "owner"} /> : null}
      </Page>
    </>
  );
}

async function Orders({ vendorId }: { vendorId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vendor_orders")
    .select("*")
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false })
    .limit(200);
  const orders = (data ?? []) as Order[];
  if (!orders.length) return <Empty>No orders yet. When a customer orders or books, it lands here.</Empty>;

  const groups: { label: string; items: Order[] }[] = [
    { label: "To answer", items: orders.filter((o) => o.status === "requested") },
    { label: "Problems", items: orders.filter((o) => o.status === "disputed") },
    { label: "In progress", items: orders.filter((o) => o.status === "accepted" || o.status === "delivered") },
    {
      label: "Closed",
      items: orders.filter((o) => ["completed", "cancelled", "declined"].includes(o.status)).slice(0, 50),
    },
  ];
  return (
    <div className="space-y-8">
      {groups
        .filter((g) => g.items.length)
        .map((g) => (
          <section key={g.label}>
            <SectionLabel right={g.items.length}>{g.label}</SectionLabel>
            <ul className="space-y-2">
              {g.items.map((o) => (
                <OrderRow key={o.id} order={o} />
              ))}
            </ul>
          </section>
        ))}
    </div>
  );
}

async function Messages({ vendorId }: { vendorId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vendor_conversations")
    .select("id, customer_id, last_at")
    .eq("vendor_id", vendorId)
    .order("last_at", { ascending: false })
    .limit(200);
  const convos = (data ?? []) as { id: string; customer_id: string; last_at: string }[];
  if (!convos.length) return <Empty>No messages yet. Customers write from your public page.</Empty>;

  const rows = await Promise.all(
    convos.map(async (c) => {
      const [{ data: info }, { data: unread }, { data: last }] = await Promise.all([
        supabase.rpc("vendor_conversation_info", { p_conversation_id: c.id }),
        supabase.rpc("vendor_conversation_unread", { p_conversation_id: c.id }),
        supabase
          .from("vendor_messages")
          .select("body, from_business")
          .eq("conversation_id", c.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      const i = ((info ?? []) as { customer_name: string }[])[0];
      const l = last as { body: string; from_business: boolean } | null;
      return { ...c, name: i?.customer_name ?? "Customer", unread: (unread as number) ?? 0, last: l };
    }),
  );

  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.id}>
          <Link
            href={`/market/m/${r.id}`}
            className="press flex items-start justify-between gap-3 rounded-card border border-line bg-surface-soft px-4 py-3 active:bg-surface"
          >
            <span className="min-w-0">
              <span className="block text-[0.95rem] text-paper">{r.name}</span>
              <span className="mt-0.5 block truncate text-sm text-paper-dim">
                {r.last ? `${r.last.from_business ? "You: " : ""}${firstLine(r.last.body, 80)}` : "Nothing said yet."}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-xs text-paper-faint">{ago(r.last_at)}</span>
              {r.unread ? (
                <span className="mt-1 inline-block rounded-pill bg-gold px-2 text-xs font-semibold text-ink">{r.unread}</span>
              ) : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function Reviews({ vendorId, canReply }: { vendorId: string; canReply: boolean }) {
  const supabase = await createClient();
  const [{ data: rows }, { data: sum }] = await Promise.all([
    supabase.rpc("vendor_reviews_page", { p_vendor_id: vendorId }),
    supabase.rpc("vendor_review_summary", { p_vendor_id: vendorId }),
  ]);
  const summary = ((sum ?? []) as ReviewSummary[])[0];
  return (
    <div>
      {summary ? <ReviewBars summary={summary} /> : null}
      <ReviewList reviews={(rows ?? []) as Review[]} canReply={canReply} reviewer={false} />
      <p className="mt-4 text-center text-xs text-paper-faint">
        Only customers whose order completed can review. Owners and managers may reply once; nobody on
        the team can remove a review.
      </p>
    </div>
  );
}

async function Team({ vendorId, me, owner }: { vendorId: string; me: string; owner: boolean }) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("vendor_team", { p_vendor_id: vendorId });
  return <TeamPanel vendorId={vendorId} members={(data ?? []) as TeamMember[]} me={me} owner={owner} />;
}

export const dynamic = "force-dynamic";
