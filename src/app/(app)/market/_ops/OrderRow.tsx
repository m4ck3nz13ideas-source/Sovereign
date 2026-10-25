import Link from "next/link";

import { Tag } from "@/components/ui";
import { ORDER_STATUS, orderNoun, whenText, type Order } from "@/lib/business";
import { ago } from "@/lib/format";

/** One order in a list, for the business's desk and the customer's orders alike. */
export function OrderRow({ order: o, vendorName }: { order: Order; vendorName?: string }) {
  const s = ORDER_STATUS[o.status];
  return (
    <li>
      <Link
        href={`/market/orders/${o.id}`}
        className="press block rounded-card border border-line bg-surface-soft px-4 py-3 active:bg-surface"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="text-[0.95rem] text-paper">
            {o.quantity > 1 ? `${o.quantity} × ` : ""}
            {o.item_name}
          </span>
          <Tag tone={s.tone}>{s.label}</Tag>
        </div>
        <p className="mt-1 text-xs text-paper-faint">
          {vendorName ? `${vendorName} · ` : ""}
          {orderNoun(o.kind)} · {o.agreed_price ?? o.listed_price}
          {o.scheduled_for ? ` · ${whenText(o.scheduled_for)}` : o.wanted_at ? ` · asked for ${whenText(o.wanted_at)}` : ""}
          {" · "}
          {ago(o.updated_at)}
        </p>
      </Link>
    </li>
  );
}
