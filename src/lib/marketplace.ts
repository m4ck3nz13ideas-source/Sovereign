import type { GroupScope, ListingKind, ListingState } from "./types";

/**
 * Pure helpers for the marketplace screens (rule 37).
 *
 * The limits below mirror the check constraints in 0030 so a form can say
 * what is wrong before the round trip. The database's copies are the ones that
 * decide; if these drift, the database still refuses and its message is shown.
 */

export const LISTING_LIMITS = {
  name: { min: 2, max: 120 },
  description: { min: 40, max: 2000 },
  terms: { min: 10, max: 600 },
  contact: { max: 280 },
  reason: { min: 20, max: 600 },
} as const;

export const KIND_LABEL: Record<ListingKind, string> = {
  product: "Product",
  service: "Service",
  business: "Business",
};

export const KIND_PLURAL: Record<ListingKind, string> = {
  product: "Products",
  service: "Services",
  business: "Businesses",
};

/**
 * What each state means, said plainly. A listing has no status column — these
 * are read off the proposals — so each line says which proposal did what.
 */
export const STATE_LABEL: Record<ListingState, string> = {
  pending: "Waiting on its proposal",
  listed: "Listed",
  declined: "Not admitted",
  withdrawn: "Withdrawn",
  revoked: "Taken down",
};

export const STATE_LINE: Record<ListingState, string> = {
  pending:
    "Attached to a proposal that has not closed yet. It is listed if that proposal passes, and not before.",
  listed:
    "The proposal that carried it passed. It stays listed until it is withdrawn or a proposal to take it down passes.",
  declined:
    "The proposal that carried it did not pass, or was withdrawn. To try again, write a new proposal.",
  withdrawn: "The person offering it withdrew it, and said why.",
  revoked: "A proposal to take it down was put to the same people who admitted it, and passed.",
};

export function stateTone(state: ListingState): "neutral" | "gold" | "alarm" | "calm" {
  if (state === "listed") return "calm";
  if (state === "pending") return "gold";
  if (state === "revoked") return "alarm";
  return "neutral";
}

export function isListingKind(value: unknown): value is ListingKind {
  return value === "product" || value === "service" || value === "business";
}

/** Where a listing was admitted: a group's name, or a place at a scale. */
export function whereLabel(
  row: { group_id: string | null; scope: GroupScope; place: string | null },
  groupNames: Map<string, string>,
): string {
  if (row.group_id) return groupNames.get(row.group_id) ?? "A group";
  if (row.scope === "global") return "Everyone";
  return row.place ? `${row.place} · ${row.scope}` : row.scope;
}

export interface OfferDraft {
  proposalId: string;
  kind: string;
  name: string;
  description: string;
  terms: string;
  contact: string;
}

/** The first thing wrong with a draft, in the voice of the rest of the app. */
export function offerProblem(d: OfferDraft): string | null {
  if (!d.proposalId) return "Choose the proposal that will carry it.";
  if (!isListingKind(d.kind)) return "Say whether it is a product, a service or a business.";

  const name = d.name.trim();
  if (name.length < LISTING_LIMITS.name.min) return "Give it a name.";
  if (name.length > LISTING_LIMITS.name.max) return "The name is a name — 120 characters at most.";

  const description = d.description.trim();
  if (description.length < LISTING_LIMITS.description.min) {
    return "Describe it well enough that somebody could decide whether to admit it — forty characters at least.";
  }
  if (description.length > LISTING_LIMITS.description.max) {
    return "The description runs past 2,000 characters.";
  }

  const terms = d.terms.trim();
  if (terms.length < LISTING_LIMITS.terms.min) {
    return "Say what it costs and on what terms, in your own words — ten characters at least.";
  }
  if (terms.length > LISTING_LIMITS.terms.max) return "The terms run past 600 characters.";

  if (d.contact.trim().length > LISTING_LIMITS.contact.max) {
    return "The contact runs past 280 characters.";
  }
  return null;
}

export function reasonProblem(reason: string): string | null {
  const r = reason.trim();
  if (r.length < LISTING_LIMITS.reason.min) return "Say why in at least twenty characters.";
  if (r.length > LISTING_LIMITS.reason.max) return "The reason runs past 600 characters.";
  return null;
}
