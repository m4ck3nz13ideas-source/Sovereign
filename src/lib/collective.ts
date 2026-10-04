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

/* --- where a proposal has got to ----------------------------------------- */

export type StepState = "done" | "current" | "ahead";

export interface ProgressStep {
  key: string;
  label: string;
  state: StepState;
}

/**
 * The path a proposal walks, and where this one is on it.
 *
 * Derived entirely from `status`, which the database moves — nothing here
 * decides anything, and the strip must never show a step the record does not
 * support. Two honest gaps follow from that:
 *
 *   * A proposal that did not pass, or was withdrawn, ends where it ended. The
 *     steps after it are not drawn greyed-out as though they were still ahead.
 *   * A withdrawn proposal shows only that it was withdrawn. `status` does not
 *     say which stage it was withdrawn from, and drawing "reviewed, deliberated"
 *     in front of it would be a guess presented as history.
 *
 * `passed` is not the end: ratification is not activation (rule 9), so the
 * step after it stays visibly ahead until a project exists.
 */
export function proposalProgress(status: ProposalStatus): ProgressStep[] {
  if (status === "withdrawn") {
    return [{ key: "withdrawn", label: "Withdrawn", state: "current" }];
  }

  const decided =
    status === "failed" ? "Did not pass" : "Passed";

  const path: { key: string; label: string; at: ProposalStatus[] }[] = [
    { key: "review", label: "Review", at: ["in_review"] },
    { key: "deliberation", label: "Deliberation", at: ["in_deliberation"] },
    { key: "resonance", label: "Resonance", at: ["voting"] },
    { key: "decided", label: decided, at: ["passed", "failed"] },
    { key: "underway", label: "Under way", at: ["executing"] },
    { key: "done", label: "Done", at: ["completed"] },
  ];

  const here = path.findIndex((p) => p.at.includes(status));
  const steps = path.map((p, i): ProgressStep => ({
    key: p.key,
    label: p.label,
    state: i < here ? "done" : i === here ? "current" : "ahead",
  }));

  // A path that ended does not show the road it did not take.
  return status === "failed" ? steps.slice(0, here + 1) : steps;
}

/**
 * One sentence on what happens next, in the voice of the rest of the app: the
 * rule, and why. `closesAt` is only known for a place (rule 15 — the clock
 * decides there, not a steward).
 */
export function whatHappensNext(
  status: ProposalStatus,
  opts: { hasGroup: boolean; closesAt: string | null },
): string {
  switch (status) {
    case "in_review":
      return "The reviewer and the law audit read it first. Nobody is asked to respond to something that has not been read.";
    case "in_deliberation":
      return "Questions and concerns are open. Each person's resonance unlocks once they have read it.";
    case "voting":
      return opts.hasGroup
        ? "Resonance is open, and the averages stay hidden until a steward closes it."
        : opts.closesAt
          ? `Resonance is open until ${new Date(opts.closesAt).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}, and the averages stay hidden until then.`
          : "Resonance is open, and the averages stay hidden until it closes.";
    case "passed":
      return "Passing is not starting. It becomes a project once every need has somebody's name against it.";
    case "failed":
      return "The record stands as it is. A second attempt can take it up, and has to say what it changed.";
    case "executing":
      return "It completes when somebody writes down what actually happened, against what was expected.";
    case "completed":
      return "Finished, with a reflection on the record.";
    case "withdrawn":
      return "Its author withdrew it. The record of it stays.";
  }
}

/* --- quoting a sentence -------------------------------------------------- */

const MAX_EXCERPT = 400;

/**
 * The sentence around [start, end) in `text`, trimmed to something quotable.
 *
 * Used when a word is raised from a proposal: the sighting quotes the sentence
 * somebody stopped at (rule 35). The database checks the quote against the
 * proposal, so this only has to find a sensible span, not a trustworthy one.
 */
export function sentenceAround(text: string, start: number, end: number): string {
  let from = Math.max(0, Math.min(start, text.length));
  while (from > 0 && !/[.!?\n]/.test(text[from - 1])) from--;
  let to = Math.max(from, Math.min(end, text.length));
  while (to < text.length && !/[.!?\n]/.test(text[to])) to++;
  if (to < text.length && text[to] !== "\n") to++; // keep the full stop

  const s = text.slice(from, to).trim();
  if (s.length <= MAX_EXCERPT) return s;

  // Centre a window on the selection rather than cutting it off.
  const mid = Math.floor((start + end) / 2) - from;
  const lo = Math.max(0, Math.min(mid - MAX_EXCERPT / 2, s.length - MAX_EXCERPT));
  return s.slice(lo, lo + MAX_EXCERPT).trim();
}
