import Link from "next/link";
import { notFound } from "next/navigation";

import { Page, Readers, SectionLabel, Tag, TopBar } from "@/components/ui";
import {
  canReview,
  ORDER_REPLY_DAYS,
  ORDER_STATUS,
  orderActions,
  orderNoun,
  whenText,
  type Order,
  type OrderStatus,
} from "@/lib/business";
import { ago } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

import { OrderActions } from "../../_ops/OrderActions";
import { MessageButton } from "../../_ops/OrderForm";
import { ReviewForm } from "../../_ops/Reviews";

export const metadata = { title: "Order · Sovereign" };

const MOVE: Record<OrderStatus, string> = {
  requested: "asked for it",
  accepted: "accepted",
  declined: "declined",
  cancelled: "cancelled",
  delivered: "marked it done",
  completed: "closed it as completed",
  disputed: "reported a problem",
};

/**
 * One order or booking, as both sides see it: what was asked for, what the
 * business agreed to, every move with who made it and why, and the next step
 * for whoever is looking. The customer's confirmation is what completes it.
 */
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await requireSession();
  const supabase = await createClient();

  const { data: raw } = await supabase.from("vendor_orders").select("*, vendors(name)").eq("id", id).maybeSingle();
  if (!raw) notFound();
  const order = raw as Order & { vendors: { name: string } | null };
  const vendorName = order.vendors?.name ?? "The business";

  const [{ data: role }, { data: reviewer }, { data: timeline }, { data: reviewed }] = await Promise.all([
    supabase.rpc("vendor_team_role", { p_vendor_id: order.vendor_id }),
    supabase.rpc("is_marketplace_reviewer"),
    supabase.rpc("order_timeline", { p_order_id: id }),
    supabase.from("vendor_reviews").select("id").eq("order_id", id).maybeSingle(),
  ]);

  const customer = order.customer_id === userId;
  const team = !!role;
  const actions = orderActions(order, { customer, team, reviewer: !!reviewer });
  const noun = orderNoun(order.kind);
  const s = ORDER_STATUS[order.status];

  // The conversation about it: the customer's own, or (on the team) theirs with this customer.
  let convoId: string | null = null;
  if (team) {
    const { data } = await supabase
      .from("vendor_conversations")
      .select("id")
      .eq("vendor_id", order.vendor_id)
      .eq("customer_id", order.customer_id)
      .maybeSingle();
    convoId = (data as { id: string } | null)?.id ?? null;
  }

  const events = (timeline ?? []) as {
    to_status: OrderStatus;
    note: string | null;
    actor_name: string;
    side: "customer" | "business" | "reviewer";
    created_at: string;
  }[];

  return (
    <>
      <TopBar title={noun === "booking" ? "Booking" : "Order"} back={team ? `/market/b/${order.vendor_id}` : "/market/orders"} />
      <Page>
        <header className="mb-6 text-center">
          <Tag tone={s.tone}>{s.label}</Tag>
          <h2 className="display mt-3 text-[1.5rem] text-paper">
            {order.quantity > 1 ? `${order.quantity} × ` : ""}
            {order.item_name}
          </h2>
          <p className="mt-1 text-sm text-paper-faint">
            <Link href={`/market/v/${order.vendor_id}`} className="hover:text-paper">
              {vendorName}
            </Link>
            {" · "}
            {noun} asked for {ago(order.created_at)}
          </p>
          <Readers className="mt-2">
            The customer and {vendorName}&rsquo;s team.
            {order.disputed_at ? " A marketplace reviewer too, since a problem was reported." : ""}
          </Readers>
        </header>

        <section className="mb-8">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-paper-faint">Listed at</dt>
            <dd className="text-paper">{order.listed_price}</dd>
            {order.agreed_price ? (
              <>
                <dt className="text-paper-faint">Agreed</dt>
                <dd className="text-paper">{order.agreed_price}</dd>
              </>
            ) : null}
            {order.wanted_at ? (
              <>
                <dt className="text-paper-faint">Asked for</dt>
                <dd className="text-paper">{whenText(order.wanted_at)}</dd>
              </>
            ) : null}
            {order.scheduled_for ? (
              <>
                <dt className="text-paper-faint">Booked for</dt>
                <dd className="text-paper">{whenText(order.scheduled_for)}</dd>
              </>
            ) : null}
            {order.request ? (
              <>
                <dt className="text-paper-faint">Note</dt>
                <dd className="whitespace-pre-wrap text-paper-dim">{order.request}</dd>
              </>
            ) : null}
          </dl>
          <p className="mt-3 text-xs text-paper-faint">
            Payment is agreed and made between you and the business for now. Held payment, released when the
            customer confirms, comes later.
          </p>
        </section>

        {actions.length ? (
          <section className="mb-8">
            <SectionLabel>Next</SectionLabel>
            {order.status === "delivered" && customer ? (
              <p className="mb-3 text-center text-sm text-paper-dim">
                {vendorName} has marked this done. Confirm it, or report a problem, within {ORDER_REPLY_DAYS} days.
              </p>
            ) : null}
            <OrderActions
              orderId={order.id}
              kind={order.kind}
              actions={actions}
              listedPrice={order.listed_price}
              wantedAt={order.wanted_at}
            />
          </section>
        ) : null}

        {customer && canReview(order, !!reviewed) ? (
          <section className="mb-8">
            <SectionLabel>Review {vendorName}</SectionLabel>
            <ReviewForm orderId={order.id} vendorName={vendorName} />
          </section>
        ) : null}

        <section className="mb-8">
          <SectionLabel>What has happened</SectionLabel>
          <ol className="space-y-3 border-l border-line pl-4">
            {events.map((e, i) => (
              <li key={i}>
                <p className="text-sm text-paper">
                  {e.side === "business" ? `${vendorName} · ${e.actor_name}` : e.actor_name}{" "}
                  {e.to_status === "completed" && e.side === "customer" ? "confirmed it was done" : MOVE[e.to_status]}
                </p>
                {e.note ? <p className="mt-0.5 text-sm whitespace-pre-wrap text-paper-dim">{e.note}</p> : null}
                <p className="mt-0.5 text-xs text-paper-faint">{ago(e.created_at)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="flex justify-center">
          {customer ? (
            <MessageButton vendorId={order.vendor_id} label={`Message ${vendorName}`} />
          ) : convoId ? (
            <Link href={`/market/m/${convoId}`} className="text-sm text-gold hover:underline">
              Messages with this customer →
            </Link>
          ) : null}
        </section>
      </Page>
    </>
  );
}

export const dynamic = "force-dynamic";
