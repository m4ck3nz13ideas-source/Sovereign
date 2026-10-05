import { notFound } from "next/navigation";

import { Page, Prose, SectionLabel, Tag, TopBar } from "@/components/ui";
import { shortDate } from "@/lib/format";
import { safeUrl, type Offering, type Vendor } from "@/lib/marketplace";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { UNIVERSAL_LAWS } from "@/lib/universal-law";

import { ConcernForm } from "./ConcernForm";

export const metadata = { title: "Business · Sovereign" };

/**
 * A business, its evidence, and what it sells.
 *
 * The evidence is public because it is what was approved: a buyer should be
 * able to read exactly what the business claimed and judge it for
 * themselves. The AI's reading is not, because it is a working document
 * between the business and the reviewers.
 */
export default async function VendorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await requireSession();
  const supabase = await createClient();

  const { data: raw } = await supabase.from("vendors").select("*").eq("id", id).maybeSingle();
  if (!raw) notFound();
  const vendor = raw as Vendor;

  const [{ data: status }, { data: offeringsRaw }, { data: approvedRaw }] = await Promise.all([
    supabase.rpc("vendor_status", { p_vendor_id: id }),
    supabase.rpc("market_offerings", { p_kind: null, p_q: null }),
    supabase.rpc("market_vendors", { p_q: null }),
  ]);

  const offerings = ((offeringsRaw ?? []) as (Offering & { vendor_id: string })[]).filter(
    (o) => o.vendor_id === id,
  );
  const approvedAt = ((approvedRaw ?? []) as { id: string; approved_at: string | null }[]).find(
    (v) => v.id === id,
  )?.approved_at;
  const website = safeUrl(vendor.website);
  const mine = vendor.owner_id === userId;

  return (
    <>
      <TopBar title={vendor.name} back="/market?view=businesses" />
      <Page>
        <header className="mb-6">
          {status === "approved" ? (
            <Tag tone="calm">
              aligned with the Universal Laws{approvedAt ? ` · ${shortDate(approvedAt)}` : ""}
            </Tag>
          ) : (
            <Tag tone="gold">not currently approved</Tag>
          )}
          <h2 className="display mt-3 text-[1.5rem] text-paper">{vendor.name}</h2>
          <p className="mt-1 text-sm text-paper-faint">
            {vendor.location ? `${vendor.location} · ` : ""}
            {website ? (
              <a href={website} target="_blank" rel="noopener noreferrer" className="hover:text-paper">
                {website.replace(/^https:\/\//, "")} ↗
              </a>
            ) : null}
          </p>
        </header>

        <section className="mb-8">
          <SectionLabel>What they do</SectionLabel>
          <Prose>{vendor.description}</Prose>
        </section>

        <section className="mb-8">
          <SectionLabel>Their evidence</SectionLabel>
          <Prose>{vendor.evidence}</Prose>
        </section>

        <section className="mb-8">
          <SectionLabel>Products and services</SectionLabel>
          {offerings.length ? (
            <ul className="space-y-3">
              {offerings.map((o) => {
                const href = safeUrl(o.url);
                return (
                  <li key={o.id} className="rounded-card border border-line px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[0.95rem] text-paper">{o.name}</span>
                      <span className="text-sm text-paper">{o.price}</span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-paper-dim">{o.description}</p>
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-sm text-gold hover:underline"
                      >
                        Buy ↗
                      </a>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-paper-faint">Nothing listed right now.</p>
          )}
        </section>

        {!mine && status === "approved" ? (
          <section className="mb-8">
            <SectionLabel>Something not right?</SectionLabel>
            <p className="mb-3 text-sm leading-relaxed text-paper-faint">
              If you have seen this business act against a Universal Law, tell the reviewers. The
              business will not see who raised it.
            </p>
            <ConcernForm vendorId={id} laws={UNIVERSAL_LAWS.map((l) => ({ id: l.id, name: l.name }))} />
          </section>
        ) : null}
      </Page>
    </>
  );
}
