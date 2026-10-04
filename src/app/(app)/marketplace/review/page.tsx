import { notFound } from "next/navigation";

import { Page, TopBar } from "@/components/ui";
import type { Vendor, Vetting } from "@/lib/marketplace";
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

  const [{ data: queueRaw }, { data: concernRaw }, { data: suspRaw }] = await Promise.all([
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
  ]);

  // A vetting of words the business has since changed cannot be signed; the
  // database refuses it, so do not offer it.
  const queue = [] as (Vetting & { vendors: Vendor })[];
  for (const v of (queueRaw ?? []) as (Vetting & { vendors: Vendor })[]) {
    const { data: status } = await supabase.rpc("vendor_status", { p_vendor_id: v.vendor_id });
    if (status === "awaiting_sign_off") queue.push(v);
  }

  return (
    <>
      <TopBar title="Review queue" back="/marketplace" />
      <Page>
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
