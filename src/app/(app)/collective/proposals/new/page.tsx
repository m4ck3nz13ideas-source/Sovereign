import Link from "next/link";

import { Page, PageTitle } from "@/components/ui";
import { addressOptions, requireAddress } from "@/lib/address";
import { SCOPES, reachableScopes } from "@/lib/collective";
import { createClient } from "@/lib/supabase/server";
import type { Proposal } from "@/lib/types";

import { ComposeProposal } from "./ComposeProposal";

export const metadata = { title: "New proposal · Sovereign" };

export default async function NewProposalPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const session = await requireAddress();
  const options = addressOptions(session);

  const reachable = reachableScopes(session.profile);
  const unset = SCOPES.filter((s) => !reachable.includes(s.value)).map((s) => s.label);
  const current =
    session.address.kind === "group"
      ? `group:${session.address.group.id}`
      : `scope:${session.address.scope}`;

  // Taking up a dormant proposal starts a NEW one from its words. It is not an
  // edit and it inherits nothing: the sharpening and the audit run again,
  // because a clearance from one moment is not a clearance now. RLS decides
  // whether this person could see the original at all.
  let taking: Proposal | null = null;
  if (from) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("proposals")
      .select("*")
      .eq("id", from)
      .maybeSingle();
    taking = (data as Proposal | null) ?? null;
  }

  return (
    <Page>
      <Link
        href="/collective/proposals"
        className="smallcaps mb-6 inline-block text-[11px] text-paper-faint hover:text-gold"
      >
        ← Proposals
      </Link>

      <PageTitle
        sub={
          taking
            ? `Taking up "${taking.title}". Nothing carries over but the words — it is read and audited again.`
            : "Private until it is ready, and until you submit it."
        }
      >
        {taking ? "Again" : "A proposal"}
      </PageTitle>

      <ComposeProposal
        addresses={options}
        defaultAddress={
          taking
            ? taking.group_id
              ? `group:${taking.group_id}`
              : `scope:${taking.scope}`
            : current
        }
        unsetScopes={unset}
        takingUp={
          taking
            ? {
                id: taking.id,
                title: taking.title,
                summary: taking.summary,
                intent: taking.intent,
                change: taking.change,
                constraints: taking.constraints,
                risks: taking.risks,
                alternatives: taking.alternatives,
                evidence: taking.evidence ?? "",
                category: taking.category ?? "",
                budget: taking.budget_amount ? String(taking.budget_amount) : "",
                termDays: taking.term_days ? String(taking.term_days) : "",
              }
            : null
        }
      />
    </Page>
  );
}
