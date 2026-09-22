import type {
  GroupScope,
  Proposal,
  ProposalReview,
  ProposalStatus,
  ReviewRisk,
} from "@/lib/types";
import { CLOSED_STATUSES } from "@/lib/types";

/**
 * Small pure helpers shared between the collective screens.
 *
 * Kept out of actions.ts because a "use server" module may only export async
 * functions — everything in it becomes a callable server endpoint.
 */

/** Narrow the jsonb columns Postgres hands back as `unknown`. */
export function asReview(row: Record<string, unknown>): ProposalReview {
  return {
    ...(row as unknown as ProposalReview),
    values_alignment: (row.values_alignment ?? {}) as Record<string, number>,
    risks: (row.risks ?? []) as ReviewRisk[],
    questions: (row.questions ?? []) as string[],
    memory_used: (row.memory_used ?? []) as ProposalReview["memory_used"],
  };
}

export function isClosed(status: ProposalStatus): boolean {
  return CLOSED_STATUSES.includes(status);
}

export function isOpen(status: ProposalStatus): boolean {
  return status === "in_deliberation" || status === "voting";
}

/** The mean of the four quality scores, or null if the review has none. */
export function reviewQuality(review: ProposalReview | null): number | null {
  if (!review) return null;
  const parts = [
    review.clarity,
    review.evidence,
    review.feasibility,
    review.reversibility,
  ].filter((n): n is number => typeof n === "number");
  if (!parts.length) return null;
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

/** Tone for a 0–1 score, used consistently wherever one is shown. */
export function scoreTone(value: number, floor = 0.3): "alarm" | "neutral" | "calm" {
  if (value < floor) return "alarm";
  if (value >= 0.7) return "calm";
  return "neutral";
}

export const RESONANCE_DIMENSIONS = [
  {
    key: "alignment" as const,
    label: "Alignment",
    question: "How well does this sit with what you think this group is for?",
    low: "Not at all",
    high: "Completely",
  },
  {
    key: "confidence" as const,
    label: "Confidence",
    question: "How sure are you about that reading?",
    low: "Unsure",
    high: "Certain",
  },
  {
    key: "urgency" as const,
    label: "Urgency",
    question: "Does this need to happen now, or could it wait?",
    low: "It can wait",
    high: "It is time-critical",
  },
];

/**
 * The five scales, in order, with the profile field that decides eligibility
 * at each. Global has none, because global is everyone.
 */
export const SCOPES = [
  { value: "local" as const,       label: "Local",       field: "place_local" as const,       hint: "Your street, estate, village or neighbourhood." },
  { value: "regional" as const,    label: "Regional",    field: "place_regional" as const,    hint: "The city or county it sits in." },
  { value: "national" as const,    label: "National",    field: "place_national" as const,    hint: "The country." },
  { value: "continental" as const, label: "Continental", field: "place_continental" as const, hint: "The continent." },
  { value: "global" as const,      label: "Global",      field: null,                         hint: "Everyone. No place to set." },
];

export type ScopeField = Exclude<(typeof SCOPES)[number]["field"], null>;

/** Where this person is, at a given scale. Null at global, by definition. */
export function placeAt(
  profile: Partial<Record<ScopeField, string | null>>,
  scope: GroupScope,
): string | null {
  const field = SCOPES.find((s) => s.value === scope)?.field;
  return field ? (profile[field] ?? null) : null;
}

/** The scales this person has actually said where they are, plus global. */
export function reachableScopes(
  profile: Partial<Record<ScopeField, string | null>>,
): GroupScope[] {
  return SCOPES.filter(
    (s) => s.field === null || (profile[s.field] ?? "").trim() !== "",
  ).map((s) => s.value);
}

/** How a proposal is addressed, in the words the interface uses. */
export function addressLabel(
  proposal: Pick<Proposal, "scope" | "place" | "group_id">,
  groupName?: string | null,
): string {
  if (proposal.group_id) return groupName ?? "a group";
  if (proposal.scope === "global") return "Global";
  return proposal.place ?? "somewhere";
}
