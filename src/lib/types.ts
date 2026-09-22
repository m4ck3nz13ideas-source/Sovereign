/**
 * Application types, kept in step with supabase/migrations by hand.
 *
 * Once you have a live project you can replace this file with generated types:
 *   npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
 * The names below are chosen to match, so the swap is mechanical.
 */

export type EntryMode = "journal" | "faith" | "idea" | "output";
export type EntryState = "unexamined" | "examined" | "archived" | "discarded";
export type ConceptStatus = "seed" | "developing" | "named" | "dormant";
export type GroupScope = "local" | "regional" | "national" | "continental" | "global";
export type GroupRole = "owner" | "steward" | "member";
export type TaskStatus = "todo" | "doing" | "done";
export type ProjectStatus = "planning" | "executing" | "completed" | "abandoned";
export type DecisionOutcome = "passed" | "failed";
export type FlagKind = "values" | "risk";
export type Severity = "low" | "medium" | "high";

export type ProposalStatus =
  | "in_review"
  | "in_deliberation"
  | "voting"
  | "passed"
  | "failed"
  | "withdrawn"
  | "executing"
  | "completed";

/** Statuses at which resonance numbers are revealed to the group. */
export const CLOSED_STATUSES: ProposalStatus[] = [
  "passed",
  "failed",
  "executing",
  "completed",
];

export interface Profile {
  id: string;
  handle: string | null;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  purpose: string | null;
  purpose_updated_at: string | null;
  faith_statement: string | null;
  faith_updated_at: string | null;
  share_values: boolean;
  share_purpose: boolean;
  share_faith: boolean;
  /**
   * Where they are, at four scales, as they wrote it. Never a coordinate —
   * these are claims, checkable by the people standing next to them.
   */
  place_local: string | null;
  place_regional: string | null;
  place_national: string | null;
  place_continental: string | null;
  place_set_at: string | null;
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileValue {
  id: string;
  profile_id: string;
  name: string;
  definition: string | null;
  position: number;
  created_at: string;
}

export interface ProfilePassion {
  id: string;
  profile_id: string;
  name: string;
  note: string | null;
  position: number;
  created_at: string;
}

export interface StatementRevision {
  id: string;
  profile_id: string;
  kind: "faith" | "purpose";
  statement: string;
  created_at: string;
}

export interface Entry {
  id: string;
  profile_id: string;
  mode: EntryMode;
  body: string;
  expanded_body: string | null;
  state: EntryState;
  examined_at: string | null;
  created_at: string;
}

export interface Concept {
  id: string;
  profile_id: string;
  title: string;
  discipline: string | null;
  body: string;
  status: ConceptStatus;
  source_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: string;
  name: string;
  slug: string;
  purpose: string | null;
  scope: GroupScope;
  created_by: string | null;
  threshold_alignment: number;
  threshold_participation: number;
  threshold_values_floor: number;
  created_at: string;
}

export interface GroupMember {
  group_id: string;
  profile_id: string;
  role: GroupRole;
  joined_at: string;
}

export interface Proposal {
  id: string;
  /** Null when the proposal is addressed to a place rather than a group. */
  group_id: string | null;
  author_id: string;
  title: string;
  summary: string;
  body: string;
  category: string | null;
  scope: GroupScope;
  /** The six sections. `body` is these concatenated, and what was sharpened. */
  intent: string;
  change: string;
  constraints: string;
  risks: string;
  alternatives: string;
  evidence: string | null;
  /** The score the draft cleared before it could be submitted. */
  readiness: number | null;
  body_sha256: string | null;
  /** The place it is addressed to. Null for a group proposal and for a global one. */
  place: string | null;
  /** When deliberation ends for a place proposal. Nobody may close it sooner. */
  closes_at: string | null;
  budget_amount: number | null;
  budget_currency: string;
  term_days: number | null;
  status: ProposalStatus;
  created_at: string;
  submitted_at: string;
  closed_at: string | null;
}

/** One section's reading from the sharpening pass. */
export interface ReadinessSection {
  section: string;
  ready: boolean;
  note: string;
  questions: string[];
}

/**
 * The sharpening a draft had to clear before it could be submitted.
 *
 * Private to its author while `proposal_id` is null — a draft, and anything
 * derived from a draft, is nobody else's business until it is sent.
 */
export interface ProposalReadiness {
  id: string;
  author_id: string;
  proposal_id: string | null;
  body_sha256: string;
  readiness: number;
  verdict: string;
  sections: ReadinessSection[];
  prompt_id: string;
  prompt_version: string;
  model: string;
  created_at: string;
}

/** The decision rule at one scale, for proposals addressed to a place. */
export interface ScopeRule {
  scope: GroupScope;
  threshold_alignment: number;
  min_voices: number;
  deliberation_days: number;
  note: string | null;
}

/** How a proposal is addressed: to a group, or to a place at a scale. */
export type Address =
  | { kind: "group"; groupId: string }
  | { kind: "place"; scope: GroupScope; place: string | null };

export interface ReviewRisk {
  title: string;
  severity: Severity;
  note: string;
}

export interface MemoryReference {
  decision_id: string;
  title: string;
  outcome: DecisionOutcome;
  lesson: string | null;
}

export interface ProposalReview {
  id: string;
  proposal_id: string;
  prompt_id: string;
  prompt_version: string;
  model: string;
  clarity: number | null;
  evidence: number | null;
  feasibility: number | null;
  reversibility: number | null;
  values_alignment: Record<string, number>;
  risks: ReviewRisk[];
  questions: string[];
  memory_used: MemoryReference[];
  summary: string | null;
  created_at: string;
  created_by: string | null;
}

export interface ProposalFlag {
  id: string;
  proposal_id: string;
  review_id: string | null;
  kind: FlagKind;
  label: string;
  severity: string;
  detail: string | null;
  resolution: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

export interface DeliberationComment {
  id: string;
  proposal_id: string;
  author_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
}

export interface ResonanceVote {
  proposal_id: string;
  profile_id: string;
  alignment: number;
  confidence: number;
  urgency: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResonanceSummary {
  voter_count: number;
  /** Null for a place proposal: there is no register to be a share of. */
  member_count: number | null;
  avg_alignment: number | null;
  avg_confidence: number | null;
  avg_urgency: number | null;
  revealed: boolean;
}

/* ---------------------------------------------------------------------------
   Universal Law — the constitutional layer.
   The laws themselves are in src/lib/universal-law.ts; these are the records
   of a proposal being read against them.
--------------------------------------------------------------------------- */

export interface LawAssessment {
  id: string;
  proposal_id: string;
  review_id: string | null;
  law_id: string;
  verdict: "aligned" | "tension" | "violation";
  reasoning: string;
  resolution: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  superseded_at: string | null;
  prompt_id: string;
  prompt_version: string;
  model: string;
  created_at: string;
}

export interface LawChallenge {
  id: string;
  assessment_id: string;
  proposal_id: string;
  challenger_id: string;
  argument: string;
  answered_at: string | null;
  created_at: string;
}

/** What law_standing() returns: everything between a proposal and lawfulness. */
export interface LawStanding {
  audited: boolean;
  laws_assessed: number;
  violations: number;
  unanswered_tensions: number;
  lawful: boolean;
}

/* ---------------------------------------------------------------------------
   Activate — "If supported, resources and people flow to make it real."
--------------------------------------------------------------------------- */

export type CommitmentKind = "money" | "time" | "skill" | "material";
export type CommitmentStatus = "pledged" | "honoured" | "withdrawn";

export interface ProposalNeed {
  id: string;
  proposal_id: string;
  kind: CommitmentKind;
  description: string;
  quantity: number;
  unit: string;
  created_at: string;
  created_by: string | null;
}

export interface Commitment {
  id: string;
  need_id: string;
  proposal_id: string;
  profile_id: string;
  quantity: number;
  note: string | null;
  status: CommitmentStatus;
  created_at: string;
  honoured_at: string | null;
  withdrawn_at: string | null;
}

/** One row per need, from need_standing(). */
export interface NeedStanding {
  need_id: string;
  kind: CommitmentKind;
  description: string;
  unit: string;
  required: number;
  pledged: number;
  met: boolean;
}

export interface ActivationStanding {
  needs_total: number;
  needs_met: number;
  people_pledged: number;
  ready: boolean;
}

export interface Decision {
  id: string;
  proposal_id: string;
  outcome: DecisionOutcome;
  avg_alignment: number | null;
  avg_confidence: number | null;
  avg_urgency: number | null;
  participation: number | null;
  voter_count: number;
  member_count: number;
  values_invoked: string[];
  rationale_summary: string | null;
  prompt_version: string | null;
  decided_at: string;
  decided_by: string | null;
}

export interface Project {
  id: string;
  proposal_id: string;
  group_id: string;
  title: string;
  expected_outcome: string | null;
  status: ProjectStatus;
  budget_committed: number;
  budget_spent: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ProjectTask {
  id: string;
  project_id: string;
  title: string;
  assignee_id: string | null;
  status: TaskStatus;
  due_on: string | null;
  created_at: string;
}

export interface ProjectUpdate {
  id: string;
  project_id: string;
  author_id: string;
  body: string;
  spend_delta: number;
  created_at: string;
}

export interface Reflection {
  id: string;
  project_id: string;
  actual_outcome: string;
  lesson: string | null;
  assumption_wrong: string | null;
  ai_summary: string | null;
  prompt_version: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Post {
  id: string;
  author_id: string;
  group_id: string | null;
  entry_id: string | null;
  body: string;
  source_tag: string | null;
  created_at: string;
}

export interface SurfacedPrompt {
  id: string;
  profile_id: string;
  surface: "reflection" | "pipeline";
  question: string;
  rationale: string | null;
  prompt_id: string;
  prompt_version: string;
  model: string;
  responded_at: string | null;
  dismissed_at: string | null;
  created_at: string;
}

export interface RelatedDecision {
  decision_id: string;
  proposal_id: string;
  title: string;
  outcome: DecisionOutcome;
  decided_at: string;
  values_invoked: string[];
  overlap: number;
  expected_outcome: string | null;
  actual_outcome: string | null;
  lesson: string | null;
}

export interface ContributionRecord {
  proposals_authored: number;
  proposals_passed: number;
  resonance_recorded: number;
  comments_written: number;
  tasks_completed: number;
  budget_committed: number;
  budget_spent: number;
  reflections_written: number;
}

export interface LedgerEvent {
  seq: number;
  id: string;
  group_id: string | null;
  actor_id: string | null;
  kind: string;
  subject_type: string;
  subject_id: string | null;
  payload: Record<string, unknown>;
  prev_hash: string | null;
  hash: string;
  created_at: string;
}

/* ---------------------------------------------------------------------------
   Launch filing logic — life_OS.pdf, "Filing logic"
   Each mode lands somewhere different, as a banner.
--------------------------------------------------------------------------- */

export const LAUNCH_MODES: {
  mode: EntryMode;
  label: string;
  prompt: string;
  filesTo: string;
  filesToHref: string;
}[] = [
  {
    mode: "journal",
    label: "Journal",
    prompt: "What's alive in you right now? Don't edit, just write.",
    filesTo: "Reflection",
    filesToHref: "/reflection",
  },
  {
    mode: "faith",
    label: "Faith",
    prompt: "A prayer, a practice, a question. Whatever this moment holds.",
    filesTo: "Profile",
    filesToHref: "/profile",
  },
  {
    mode: "idea",
    label: "Idea",
    prompt: "What caught your attention? One sentence is enough.",
    filesTo: "Pipeline",
    filesToHref: "/pipeline",
  },
  {
    mode: "output",
    label: "Output",
    prompt: "Something worth sharing. A thought, a link, a draft line.",
    filesTo: "Connection",
    filesToHref: "/connection",
  },
];
