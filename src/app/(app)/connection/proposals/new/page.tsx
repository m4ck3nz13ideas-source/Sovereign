import Link from "next/link";

import { Page, PageTitle } from "@/components/ui";
import { requireGroup } from "@/lib/session";

import { ComposeProposal } from "./ComposeProposal";

export const metadata = { title: "New proposal · Sovereign" };

export default async function NewProposalPage() {
  const { group } = await requireGroup();

  return (
    <Page>
      <Link
        href="/connection/proposals"
        className="smallcaps mb-6 inline-block text-[11px] text-paper-faint hover:text-gold"
      >
        ← Proposals
      </Link>

      <PageTitle sub={`To ${group.name}. Private until you submit it.`}>
        A proposal
      </PageTitle>

      <ComposeProposal defaultScope={group.scope} />
    </Page>
  );
}
