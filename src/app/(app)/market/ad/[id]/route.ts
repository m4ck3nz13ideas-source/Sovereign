import { NextResponse } from "next/server";

import { safeUrl } from "@/lib/marketplace";
import { createClient } from "@/lib/supabase/server";

/**
 * A click on the sponsored slot. The database records it (once per person per
 * campaign per day, never the advertiser's own, never past budget) and returns
 * where it goes; anything that is not https goes back to the marketplace.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("record_ad_click", { p_campaign_id: id });
  const target = safeUrl(data as string | null);
  return NextResponse.redirect(target ?? new URL("/market", request.url));
}
