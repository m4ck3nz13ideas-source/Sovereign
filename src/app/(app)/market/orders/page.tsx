import { Empty, Page, Readers, SectionLabel, TopBar } from "@/components/ui";
import type { Order } from "@/lib/business";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

import { OrderRow } from "../_ops/OrderRow";

export const metadata = { title: "Your orders · Sovereign" };

/** Everything you have ordered or booked, and what each one is waiting on. */
export default async function MyOrdersPage() {
  const { userId } = await requireSession();
  const supabase = await createClient();

  const { data } = await supabase
    .from("vendor_orders")
    .select("*, vendors(name)")
    .eq("customer_id", userId)
    .order("updated_at", { ascending: false })
    .limit(200);
  const orders = (data ?? []) as (Order & { vendors: { name: string } | null })[];

  const open = orders.filter((o) => ["requested", "accepted", "delivered", "disputed"].includes(o.status));
  const closed = orders.filter((o) => !open.includes(o));

  return (
    <>
      <TopBar title="Your orders" back="/market" />
      <Page>
        <Readers className="mb-6 text-center">
          You and the business&rsquo;s team. A marketplace reviewer too, if you report a problem.
        </Readers>
        {!orders.length ? (
          <Empty>Nothing yet. Order or book from any business in Market.</Empty>
        ) : (
          <div className="space-y-8">
            {open.length ? (
              <section>
                <SectionLabel right={open.length}>Open</SectionLabel>
                <ul className="space-y-2">
                  {open.map((o) => (
                    <OrderRow key={o.id} order={o} vendorName={o.vendors?.name} />
                  ))}
                </ul>
              </section>
            ) : null}
            {closed.length ? (
              <section>
                <SectionLabel>Closed</SectionLabel>
                <ul className="space-y-2">
                  {closed.map((o) => (
                    <OrderRow key={o.id} order={o} vendorName={o.vendors?.name} />
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        )}
      </Page>
    </>
  );
}

export const dynamic = "force-dynamic";
