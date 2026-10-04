import { Gutter, LinkButton, Readers, Screen, TopBar } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { AttachableProposal } from "@/lib/types";

import { OfferForm } from "./OfferForm";

export const metadata = { title: "Offer something · Marketplace · Sovereign" };

/**
 * Offering something means attaching it to one of your own proposals.
 *
 * Only proposals that could still carry it are offered: yours, submitted,
 * nobody has responded yet, not an amendment to Universal Law, and not already
 * carrying something. The database checks all of that again — this list is a
 * courtesy, `lock_attachable_proposal()` is the rule.
 */
export default async function OfferPage({
  searchParams,
}: {
  searchParams: Promise<{ proposal?: string }>;
}) {
  const { proposal } = await searchParams;
  await requireSession();
  const supabase = await createClient();

  const { data } = await supabase.rpc("my_attachable_proposals", { p_listing_id: null });
  const proposals = (data ?? []) as AttachableProposal[];

  return (
    <Screen>
      <TopBar title="Offer something" back="/marketplace" />
      <Gutter>
        <p className="mt-4 text-[0.9375rem] leading-relaxed text-paper-dim">
          What you offer goes in front of the people a proposal of yours is
          addressed to, and is listed for them if it passes. It is fixed once
          attached — they will be deciding on these words — except how to reach
          you, which you can change later.
        </p>
        <Readers className="mt-2 mb-6">
          Everyone the proposal you choose is addressed to.
        </Readers>

        {proposals.length ? (
          <OfferForm
            proposals={proposals}
            initial={proposals.some((p) => p.id === proposal) ? proposal! : proposals[0].id}
          />
        ) : (
          <div className="rounded-card border border-dashed border-line px-5 py-8 text-center">
            <p className="text-[0.9375rem] leading-relaxed text-paper-faint">
              You have no proposal that could carry it. A listing rides on a
              proposal of yours that has been submitted and that nobody has
              responded to yet. Write one to the people you want to trade with —
              say what you are offering and why it belongs there — then come
              back and attach it.
            </p>
            <div className="mt-4">
              <LinkButton href="/collective/proposals/new" tone="gold">
                Write a proposal
              </LinkButton>
            </div>
          </div>
        )}
      </Gutter>
    </Screen>
  );
}
