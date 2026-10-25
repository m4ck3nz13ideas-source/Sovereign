import Link from "next/link";

import { Empty, Page, Readers, TopBar } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

import { VendorChat, type VendorMessage } from "../../_ops/VendorChat";

export const metadata = { title: "Messages · Sovereign" };

/**
 * One customer and one business. The customer sees the business; the team
 * sees the customer, and each other's replies, because any of them may answer.
 */
export default async function VendorConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await requireSession();
  const supabase = await createClient();

  const [{ data: infoRows }, { data: rows }] = await Promise.all([
    supabase.rpc("vendor_conversation_info", { p_conversation_id: id }),
    supabase.rpc("vendor_messages_page", { p_conversation_id: id, p_limit: 200 }),
  ]);
  const info = (
    (infoRows ?? []) as {
      vendor_id: string;
      vendor_name: string;
      customer_id: string;
      customer_name: string;
      as_team: boolean;
    }[]
  )[0];

  if (!info) {
    return (
      <>
        <TopBar title="Messages" back="/connection?show=businesses" />
        <Page>
          <Empty>This conversation is not one you are in.</Empty>
        </Page>
      </>
    );
  }

  const title = info.as_team ? info.customer_name : info.vendor_name;

  return (
    <>
      <TopBar title={title} back={info.as_team ? `/market/b/${info.vendor_id}?tab=messages` : "/connection?show=businesses"} />
      <Page className="space-y-5">
        <div className="text-center">
          {info.as_team ? (
            <p className="text-sm text-paper-faint">
              A customer of{" "}
              <Link href={`/market/b/${info.vendor_id}`} className="text-gold hover:underline">
                {info.vendor_name}
              </Link>
            </p>
          ) : (
            <Link href={`/market/v/${info.vendor_id}`} className="text-sm text-gold hover:underline">
              {info.vendor_name}&rsquo;s page →
            </Link>
          )}
          <Readers className="mt-2">
            {info.as_team ? info.customer_name : "You"} and everyone on {info.vendor_name}&rsquo;s team. Nothing
            said here reaches a proposal, a decision or the ledger.
          </Readers>
        </div>
        <VendorChat
          conversationId={id}
          messages={(rows ?? []) as VendorMessage[]}
          me={userId}
          asTeam={info.as_team}
          vendorName={info.vendor_name}
        />
      </Page>
    </>
  );
}

export const dynamic = "force-dynamic";
