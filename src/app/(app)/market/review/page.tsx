import Link from "next/link";
import { notFound } from "next/navigation";

import { Page, SectionLabel, TopBar } from "@/components/ui";
import { shortDate } from "@/lib/format";
import type { Vendor, Verification, Vetting } from "@/lib/marketplace";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { UNIVERSAL_LAWS } from "@/lib/universal-law";

import { ReviewConsole } from "./ReviewConsole";

export const metadata = { title: "Review · Sovereign" };

/**
 * The reviewers' queue: readings to sign off, concerns to answer, suspensions
 * to lift. Reviewers are added from the SQL editor by the project owner; there
 * is no way to become one from inside the app.
 *
 * Nothing on this page shows what a business spends on advertising. A
 * reviewer deciding whether a business aligns with the laws has no reason to
 * know, and every reason not to.
 */
export default async function ReviewPage() {
  await requireSession();
  const supabase = await createClient();
  const { data: reviewer } = await supabase.rpc("is_marketplace_reviewer");
  if (!reviewer) notFound();

  const [{ data: queueRaw }, { data: concernRaw }, { data: suspRaw }, { data: disputeRaw }] = await Promise.all([
    supabase
      .from("vendor_vettings")
      .select("*, vendors(*)")
      .is("decision", null)
      .eq("violations", 0)
      .order("created_at", { ascending: true }),
    supabase
      .from("vendor_concerns")
      .select("*, vendors(name)")
      .is("closed_at", null)
      .order("created_at", { ascending: true }),
    supabase
      .from("vendor_suspensions")
      .select("*, vendors(name)")
      .is("lifted_at", null)
      .order("created_at", { ascending: true }),
    // Orders with a problem reported (0062). A reviewer sees no other order.
    supabase
      .from("vendor_orders")
      .select("id, item_name, disputed_at, vendors(name)")
      .eq("status", "disputed")
      .order("disputed_at", { ascending: true }),
  ]);
  const disputes = (disputeRaw ?? []) as unknown as {
    id: string;
    item_name: string;
    disputed_at: string;
    vendors: { name: string } | null;
  }[];

  // A vetting of words the business has since changed cannot be signed; the
  // database refuses it, so do not offer it.
  const queue = [] as (Vetting & { vendors: Vendor; verification: Verification })[];
  for (const v of (queueRaw ?? []) as (Vetting & { vendors: Vendor })[]) {
    const { data: status } = await supabase.rpc("vendor_status", { p_vendor_id: v.vendor_id });
    if (status !== "awaiting_sign_off") continue;
    const [{ data: site }, { data: company }] = await Promise.all([
      supabase.rpc("vendor_domain_verified", { p_vendor_id: v.vendor_id }),
      supabase.rpc("vendor_company", { p_vendor_id: v.vendor_id }),
    ]);
    queue.push({
      ...v,
      verification: {
        website: !!site,
        company: ((company ?? []) as { verified: boolean; detail: string }[])[0] ?? null,
      },
    });
  }

  return (
    <>
      <TopBar title="Review queue" back="/market" />
      <Page>
        {disputes.length ? (
          <section className="mb-8">
            <SectionLabel right={disputes.length}>Problems with orders</SectionLabel>
            <ul className="space-y-2">
              {disputes.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/market/orders/${d.id}`}
                    className="press block rounded-card border border-alarm/40 bg-surface-soft px-4 py-3 active:bg-surface"
                  >
                    <span className="text-[0.95rem] text-paper">{d.item_name}</span>
                    <span className="mt-0.5 block text-xs text-paper-faint">
                      {d.vendors?.name ?? "A business"} · reported {shortDate(d.disputed_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <ReviewConsole
          queue={queue}
          concerns={
            (concernRaw ?? []) as {
              id: string;
              vendor_id: string;
              law_id: string;
              reason: string;
              created_at: string;
              vendors: { name: string } | null;
            }[]
          }
          suspensions={
            (suspRaw ?? []) as { vendor_id: string; reason: string; vendors: { name: string } | null }[]
          }
          laws={UNIVERSAL_LAWS.map((l) => ({ id: l.id, name: l.name }))}
        />
      </Page>
    </>
  );
}
