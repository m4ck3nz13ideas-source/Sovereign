import Link from "next/link";

import { SectionLabel, Tag } from "@/components/ui";
import { KIND_LABEL } from "@/lib/marketplace";
import { createClient } from "@/lib/supabase/server";
import type { Listing, ListingRevocation } from "@/lib/types";

/**
 * What a proposal carries into the marketplace, if anything (rule 37).
 *
 * This sits with the proposal's own text, above the AI layer, because it is
 * part of what is being decided: resonating with a proposal that carries a
 * listing is admitting that listing. A member who only learned that from the
 * Marketplace afterwards would have voted on something they were not shown.
 */
export async function Carried({
  proposalId,
  isAuthor,
  attachable,
}: {
  proposalId: string;
  isAuthor: boolean;
  /** Submitted, nobody has responded yet, not an amendment. */
  attachable: boolean;
}) {
  const supabase = await createClient();

  const [{ data: listingRow, error }, { data: revocationRow }] = await Promise.all([
    supabase.from("listings").select("*").eq("proposal_id", proposalId).maybeSingle(),
    supabase
      .from("listing_revocations")
      .select("*, listings(id, name, kind)")
      .eq("proposal_id", proposalId)
      .maybeSingle(),
  ]);

  // 0030 not applied: nothing to show and nothing to offer.
  if (error) return null;

  const listing = listingRow as Listing | null;
  const revocation = revocationRow as unknown as
    | (ListingRevocation & { listings: { id: string; name: string; kind: Listing["kind"] } | null })
    | null;

  if (listing) {
    return (
      <section className="mb-10">
        <SectionLabel right={<Tag>{KIND_LABEL[listing.kind]}</Tag>}>
          Carries a listing
        </SectionLabel>
        <div className="rounded-card border border-line bg-surface-soft px-4 py-3">
          <Link
            href={`/marketplace/${listing.id}`}
            className="text-[1.0625rem] text-paper hover:text-gold"
          >
            {listing.name}
          </Link>
          <p className="mt-1 text-sm leading-relaxed text-paper-dim">{listing.description}</p>
          <p className="mt-2 text-sm text-paper-dim">
            <span className="text-paper-faint">Terms: </span>
            {listing.terms}
          </p>
        </div>
        <p className="mt-2 text-[0.8125rem] leading-relaxed text-paper-faint">
          If this proposal passes, this is listed in the Marketplace for
          everyone it is addressed to. Resonating with the proposal is deciding
          that too.
        </p>
      </section>
    );
  }

  if (revocation) {
    return (
      <section className="mb-10">
        <SectionLabel>Would take a listing down</SectionLabel>
        <div className="rounded-card border border-line bg-surface-soft px-4 py-3">
          {revocation.listings ? (
            <Link
              href={`/marketplace/${revocation.listings.id}`}
              className="text-[1.0625rem] text-paper hover:text-gold"
            >
              {revocation.listings.name}
            </Link>
          ) : null}
          <p className="mt-1 text-sm leading-relaxed text-paper-dim">{revocation.reason}</p>
        </div>
        <p className="mt-2 text-[0.8125rem] leading-relaxed text-paper-faint">
          If this proposal passes, that listing comes down. If it does not, the
          listing stays, and this stays on its record.
        </p>
      </section>
    );
  }

  if (isAuthor && attachable) {
    return (
      <section className="mb-10">
        <SectionLabel>Marketplace</SectionLabel>
        <p className="text-sm leading-relaxed text-paper-dim">
          If this proposal is about something you are offering, you can attach
          it now, before anybody responds, and it is listed if this passes.{" "}
          <Link
            href={`/marketplace/offer?proposal=${proposalId}`}
            className="text-gold hover:underline"
          >
            Attach a listing
          </Link>
        </p>
      </section>
    );
  }

  return null;
}
