import Link from "next/link";

import { Page, PageTitle } from "@/components/ui";
import { addressOptions, requireAddress } from "@/lib/address";
import { SCOPES, reachableScopes } from "@/lib/collective";

import { ComposeProposal } from "./ComposeProposal";

export const metadata = { title: "New proposal · Sovereign" };

export default async function NewProposalPage() {
  const session = await requireAddress();
  const options = addressOptions(session);

  const reachable = reachableScopes(session.profile);
  const unset = SCOPES.filter((s) => !reachable.includes(s.value)).map((s) => s.label);
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

      <PageTitle sub="Private until it is ready, and until you submit it.">
        A proposal
      </PageTitle>

      <ComposeProposal
        addresses={options}
        defaultAddress={current}
        unsetScopes={unset}
      />
    </Page>
  );
}
