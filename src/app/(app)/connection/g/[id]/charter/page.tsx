import Link from "next/link";

import { ComposeProposal } from "@/app/(app)/collective/proposals/new/ComposeProposal";
import { Empty, Page, PageTitle, Readers } from "@/components/ui";
import { addressOptions, requireAddress } from "@/lib/address";
import { charterChangeLines, charterOf, unpackChange } from "@/lib/charters";
import { SCOPES, reachableScopes } from "@/lib/collective";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Change the charter · Sovereign" };

/**
 * Proposing a change to a group's charter (0057).
 *
 * Its own door, like amending a law: the change was chosen on the group's
 * Manage page and arrives here in the URL, and behind the door it is the
 * ordinary composer with the ordinary gate. The change is checked again on
 * the server against the charter as it stands, and written into the body.
 */
export default async function CharterProposalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ c?: string }>;
}) {
  const [{ id }, { c }] = await Promise.all([params, searchParams]);
  const session = await requireAddress();
  const mine = session.groups.find((g) => g.id === id);
  const change = unpackChange(c);

  const back = (
    <Link
      href={`/connection/g/${id}/manage#charter`}
      className="smallcaps mb-6 inline-block text-[11px] text-paper-faint hover:text-gold"
    >
      ← Charter
    </Link>
  );

  if (!mine || !change) {
    return (
      <Page>
        {back}
        <Empty>
          {mine
            ? "Choose what to change on the group's charter first."
            : "Only a group's members can propose changing its charter."}
        </Empty>
      </Page>
    );
  }

  const supabase = await createClient();
  const { data: g } = await supabase.from("groups").select("*").eq("id", id).maybeSingle();
  const lines = charterChangeLines(charterOf(g ?? mine), change);
  const reachable = reachableScopes(session.profile);
  const unset = SCOPES.filter((s) => !reachable.includes(s.value)).map((s) => s.label);

  return (
    <Page>
      {back}
      <PageTitle sub="Read against the laws, released, and decided like any proposal. It takes effect the moment it passes.">
        Change the charter
      </PageTitle>
      <Readers className="-mt-2 mb-6">
        Nobody while you write — the draft stays in this browser. Once you submit, everyone in {mine.name}.
      </Readers>
      <ComposeProposal
        addresses={addressOptions(session)}
        defaultAddress={`group:${id}`}
        unsetScopes={unset}
        takingUp={null}
        charter={{ groupId: id, groupName: mine.name, change, lines }}
      />
    </Page>
  );
}
