import { Page, TopBar } from "@/components/ui";
import type { Campaign, Offering, Vendor, VendorStatus, Verification, Vetting } from "@/lib/marketplace";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { UNIVERSAL_LAWS } from "@/lib/universal-law";

import { SellerConsole } from "./SellerConsole";

export const metadata = { title: "Sell · Sovereign" };

/**
 * Selling: register a business, get it vetted, list what it sells, advertise.
 *
 * The order on this page is the order things have to happen in. Nothing
 * below the vetting works until the business is approved, and the page says
 * why rather than hiding the controls.
 */
export default async function SellPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string }>;
}) {
  const { start: rawStart } = await searchParams;
  const start = rawStart === "product" || rawStart === "service" ? rawStart : null;
  const { userId } = await requireSession();
  const supabase = await createClient();

  const { data: vendorRaw } = await supabase
    .from("vendors")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const vendor = vendorRaw as Vendor | null;

  if (!vendor) {
    return (
      <>
        <TopBar title="Sell here" back="/market" />
        <Page>
          <SellerConsole vendor={null} status={null} vetting={null} offerings={[]} campaigns={[]} laws={[]} start={start} verification={null} />
        </Page>
      </>
    );
  }

  const [{ data: status }, { data: vetRaw }, { data: offRaw }, { data: campRaw }, { data: clickRaw }] =
    await Promise.all([
      supabase.rpc("vendor_status", { p_vendor_id: vendor.id }),
      supabase
        .from("vendor_vettings")
        .select("*")
        .eq("vendor_id", vendor.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("offerings").select("*").eq("vendor_id", vendor.id).order("created_at", { ascending: false }),
      supabase.from("ad_campaigns").select("*").eq("vendor_id", vendor.id).order("created_at", { ascending: false }),
      supabase.from("ad_clicks").select("campaign_id, cost_pence"),
    ]);

  const spend = new Map<string, { clicks: number; pence: number }>();
  for (const c of (clickRaw ?? []) as { campaign_id: string; cost_pence: number }[]) {
    const s = spend.get(c.campaign_id) ?? { clicks: 0, pence: 0 };
    s.clicks += c.cost_pence > 0 ? 1 : 0;
    s.pence += c.cost_pence;
    spend.set(c.campaign_id, s);
  }

  const [{ data: site }, { data: companyRows }] = await Promise.all([
    supabase.rpc("vendor_domain_verified", { p_vendor_id: vendor.id }),
    supabase.rpc("vendor_company", { p_vendor_id: vendor.id }),
  ]);
  const company = ((companyRows ?? []) as { verified: boolean; detail: string }[])[0] ?? null;
  const verification: Verification = { website: !!site, company };

  const campaigns = ((campRaw ?? []) as Campaign[]).map((c) => ({
    ...c,
    clicks: spend.get(c.id)?.clicks ?? 0,
    spent_pence: spend.get(c.id)?.pence ?? 0,
  }));

  return (
    <>
      <TopBar title={vendor.name} back="/market" />
      <Page>
        <SellerConsole
          vendor={vendor}
          status={(status ?? "unvetted") as VendorStatus}
          vetting={vetRaw as Vetting | null}
          offerings={(offRaw ?? []) as Offering[]}
          campaigns={campaigns}
          laws={UNIVERSAL_LAWS.map((l) => ({ id: l.id, name: l.name }))}
          start={start}
          verification={verification}
        />
      </Page>
    </>
  );
}
