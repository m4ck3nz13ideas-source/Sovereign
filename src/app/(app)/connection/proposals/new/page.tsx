import Link from "next/link";

import { Page, PageTitle } from "@/components/ui";
import { addressOptions, requireAddress } from "@/lib/address";

import { ComposeProposal } from "./ComposeProposal";

export const metadata = { title: "New proposal · Sovereign" };

export default async function NewProposalPage() {
  const session = await requireAddress();
  const options = addressOptions(session);
  const current =
    session.address.kind === "group"
      ? `group:${session.address.group.id}`
      : `scope:${session.address.scope}`;

  return (
    <Page>
      <Link
        href="/connection/proposals"
        className="smallcaps mb-6 inline-block text-[11px] text-paper-faint hover:text-gold"
      >
        ← Proposals
      </Link>

      <PageTitle sub="Private until you submit it.">A proposal</PageTitle>

      <ComposeProposal addresses={options} defaultAddress={current} />
    </Page>
  );
}
