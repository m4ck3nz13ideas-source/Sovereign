"use server";

import { revalidatePath } from "next/cache";

import { offerProblem, reasonProblem, type OfferDraft } from "@/lib/marketplace";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

/**
 * The marketplace's actions (rule 37). Four, and each is one of 0030's
 * functions — `listings` and `listing_revocations` have no write policy at all.
 *
 * There is deliberately no action that lists something, approves something,
 * or takes something down. Those happen when a proposal closes: the group
 * decides, through the same loop as everything else. If an `approveListing`
 * or a `setListingStatus` ever turns up in this file, somebody has rebuilt the
 * steward's tick this feature exists to avoid.
 */

export async function offerListing(draft: OfferDraft) {
  const problem = offerProblem(draft);
  if (problem) return { ok: false as const, error: problem };

  await requireSession();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("offer_listing", {
    p_proposal_id: draft.proposalId,
    p_kind: draft.kind,
    p_name: draft.name.trim(),
    p_description: draft.description.trim(),
    p_terms: draft.terms.trim(),
    p_contact: draft.contact.trim() || null,
  });

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/marketplace");
  revalidatePath(`/collective/proposals/${draft.proposalId}`);
  return { ok: true as const, id: data as string };
}

/** The seller's contact is not part of what was decided, so it can change. */
export async function setListingContact(listingId: string, contact: string) {
  if (contact.trim().length > 280) {
    return { ok: false as const, error: "The contact runs past 280 characters." };
  }

  await requireSession();
  const supabase = await createClient();

  const { error } = await supabase.rpc("set_listing_contact", {
    p_listing_id: listingId,
    p_contact: contact.trim(),
  });

  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/marketplace/${listingId}`);
  revalidatePath("/marketplace");
  return { ok: true as const };
}

export async function withdrawListing(listingId: string, reason: string) {
  const problem = reasonProblem(reason);
  if (problem) return { ok: false as const, error: problem };

  await requireSession();
  const supabase = await createClient();

  const { error } = await supabase.rpc("withdraw_listing", {
    p_listing_id: listingId,
    p_reason: reason.trim(),
  });

  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/marketplace/${listingId}`);
  revalidatePath("/marketplace");
  return { ok: true as const };
}

/**
 * Raising a revocation. It rides on one of your own proposals, addressed to
 * the same group, scale and place as the one that admitted the listing — the
 * database refuses anything else, because a revocation that could be taken to
 * a friendlier audience is venue-shopping.
 */
export async function attachRevocation(input: {
  listingId: string;
  proposalId: string;
  reason: string;
}) {
  if (!input.proposalId) {
    return { ok: false as const, error: "Choose the proposal that will carry it." };
  }
  const problem = reasonProblem(input.reason);
  if (problem) return { ok: false as const, error: problem };

  await requireSession();
  const supabase = await createClient();

  const { error } = await supabase.rpc("attach_revocation", {
    p_listing_id: input.listingId,
    p_proposal_id: input.proposalId,
    p_reason: input.reason.trim(),
  });

  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/marketplace/${input.listingId}`);
  revalidatePath(`/collective/proposals/${input.proposalId}`);
  return { ok: true as const };
}
