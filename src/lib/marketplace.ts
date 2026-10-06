/**
 * The marketplace, as the screens see it. The rules are in 0030 and rule 35:
 * a business is in when the AI's reading of the Universal Laws found no
 * violation and a reviewer signed it off, for the words it stands on now.
 * Advertising buys a labelled slot, never approval.
 */

export type OfferingKind = "product" | "service";

export type VendorStatus =
  | "unvetted"
  | "awaiting_sign_off"
  | "approved"
  | "refused"
  | "refused_by_ai"
  | "changed"
  | "suspended";

export interface Vendor {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  evidence: string;
  website: string;
  location: string | null;
  company_number: string | null;
  verify_token: string;
  created_at: string;
  updated_at: string;
}

export interface Verification {
  website: boolean;
  company: { verified: boolean; detail: string } | null;
}

export interface Offering {
  id: string;
  vendor_id: string;
  kind: OfferingKind;
  name: string;
  description: string;
  price: string;
  url: string;
  created_at: string;
  withdrawn_at: string | null;
  removed_at: string | null;
  remove_note: string | null;
}

export interface MarketOffering {
  id: string;
  kind: OfferingKind;
  name: string;
  description: string;
  price: string;
  url: string;
  vendor_id: string;
  vendor_name: string;
  created_at: string;
}

export interface Vetting {
  id: string;
  vendor_id: string;
  readings: { law_id: string; verdict: "aligned" | "tension" | "violation"; reasoning: string }[];
  violations: number;
  tensions: number;
  model: string;
  created_at: string;
  decision: "approved" | "refused" | null;
  sign_note: string | null;
  signed_at: string | null;
}

export interface Campaign {
  id: string;
  vendor_id: string;
  offering_id: string | null;
  headline: string;
  body: string;
  bid_pence: number;
  budget_pence: number;
  paused: boolean;
  created_at: string;
}

export interface Ad {
  campaign_id: string;
  vendor_id: string;
  vendor_name: string;
  offering_id: string | null;
  headline: string;
  body: string;
  /** 0 to 1: how well this business fits the viewer's own values and the laws. */
  fit: number;
  /** Which of the viewer's own values it matched. Never shown to the business. */
  matched: string[];
}

export const STATUS_COPY: Record<VendorStatus, { label: string; tone: "neutral" | "gold" | "alarm" | "calm"; next: string }> = {
  unvetted: {
    label: "not yet vetted",
    tone: "neutral",
    next: "Ask for vetting when your description and evidence are complete.",
  },
  awaiting_sign_off: {
    label: "awaiting sign-off",
    tone: "gold",
    next: "The AI found no violation. A reviewer will check your evidence and sign it off.",
  },
  approved: {
    label: "approved",
    tone: "calm",
    next: "You are in the marketplace. Editing your business will need a fresh vetting.",
  },
  refused: {
    label: "refused by a reviewer",
    tone: "alarm",
    next: "Read the reviewer's note, change what it asks, and ask for vetting again.",
  },
  refused_by_ai: {
    label: "a law was violated",
    tone: "alarm",
    next: "Read the reading below. If the business has changed, update it and ask again.",
  },
  changed: {
    label: "changed since approval",
    tone: "gold",
    next: "You edited your business, so it is out of the marketplace until it is read again.",
  },
  suspended: {
    label: "suspended",
    tone: "alarm",
    next: "A reviewer has suspended your business while a concern is looked into.",
  },
};

export function pounds(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

export function isOfferingKind(v: unknown): v is OfferingKind {
  return v === "product" || v === "service";
}

/** Only https links leave the app. */
export function safeUrl(u: string | null | undefined): string | null {
  return u && /^https:\/\/\S+$/.test(u) ? u : null;
}
