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
  /**
   * The Universal Law this rewrites, or null. An amendment is global by
   * definition — a street does not amend the constitution for everybody.
   */
  amends_law: string | null;
  amendment_text: string | null;
  amendment_violation: string | null;
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
  /** The earlier proposal this one was written from, if it is a second attempt. */
  supersedes: string | null;
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

/** What a top-level contribution to a deliberation is. A reply is a reply. */
export type ContributionKind =
  | "question"
  | "amendment"
  | "alternative"
  | "concern"
  | "reply";

/** Where a deliberation stands, from `debate_standing()`. */
export interface DebateStanding {
  contributions: number;
  questions: number;
  open_questions: number;
  concerns: number;
  open_concerns: number;
  amendments: number;
  adopted: number;
  alternatives: number;
  voices: number;
}

/** A stored reading of a deliberation thread. */
export interface DebateSummary {
  id: string;
  proposal_id: string;
  /** How many contributions it was written across. Fewer than now means stale. */
  covers: number;
  arguments_for: { point: string; from: string }[];
  arguments_against: { point: string; from: string }[];
  unresolved: string[];
  shifted: string | null;
  /** A reading of the argument, never of anyone's vote. */
  polarization: "converging" | "mixed" | "splitting";
  reading: string;
  prompt_id: string;
  prompt_version: string;
  model: string;
  created_at: string;
}

/** A row from `attention_queue()`: one open proposal, and why it is in front of you. */
export interface AttentionItem {
  proposal_id: string;
  title: string;
  summary: string;
  status: ProposalStatus;
  reason: string;
  detail: string;
  /** Sort key, not a score. Lower is more urgent. Never shown. */
  weight: number;
  closes_at: string | null;
  submitted_at: string;
}

/** A proposal that failed for want of people rather than for want of merit. */
export interface DormantProposal {
  proposal_id: string;
  title: string;
  summary: string;
  why: string;
  voices: number;
  needed: number;
  decided_at: string;
}

/** One governance act, read off the ledger. */
export interface SignalEvent {
  seq: number;
  kind: string;
  subject_id: string;
  title: string;
  payload: Record<string, unknown>;
  actor: string;
  created_at: string;
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
  /** Whether resonance at this scale needs proof of personhood. Reading never does. */
  require_personhood: boolean;
  note: string | null;
}

/**
 * Proof that an account is a distinct living person.
 *
 * Note what is not here: a name, a document, an image, a biometric, an account
 * at the verifier. The nullifier is an opaque per-application hash — stable
 * for one human, not reversible into them — and it is the only thing about a
 * person's body that this system ever holds. It is readable by its owner and
 * nobody else.
 */
export interface PersonhoodProof {
  profile_id: string;
  method: "biometric" | "seed";
  provider: string;
  level: string | null;
  nullifier: string;
  verified_at: string;
  expires_at: string | null;
  revoked_at: string | null;
}

/** How you are tied to somebody. Neither tie affects what either of you may decide. */
export type Tie = "following" | "friend";

/** Where a friendship has got to, in the words the screens use. */
export type FriendshipState = "none" | "you asked" | "they asked" | "friends";

/** A person, as `find_person()` or `my_people()` returns them. */
export interface Person {
  profile_id: string;
  display_name: string;
  handle: string | null;
  tie?: Tie;
}

/**
 * A public profile, from `person_standing()`.
 *
 * What they have done, never what they think. No ratio and no percentage:
 * "written 12, passed 3" is a record, "25% success" is a score, and the
 * difference between those is one division and the whole design.
 */
export interface PersonStanding {
  proposals_written: number;
  proposals_passed: number;
  projects_finished: number;
  predictions_marked: number;
  questions_answered: number;
  joined_at: string;
  you_follow: boolean;
  you_are_friends: boolean;
  they_follow_you: boolean;
  friendship: FriendshipState;
}

/**
 * One message in a private conversation.
 *
 * Reaches no proposal, no decision and no ledger. There is no `read_at` and
 * there is not going to be: read state belongs to the reader, and the other
 * person has no way to see it.
 */
export interface Message {
  id: string;
  author_id: string;
  mine: boolean;
  body: string;
  created_at: string;
}

/** A thread, from `my_conversations()`. One per friend, said in or not. */
export interface Conversation {
  profile_id: string;
  display_name: string;
  handle: string | null;
  last_body: string | null;
  last_at: string | null;
  last_was_mine: boolean | null;
  /** New since you last looked. Your own count, invisible to them. */
  unread: number;
}

/** A pending friendship, either direction, from `friendship_requests()`. */
export interface FriendshipRequest {
  profile_id: string;
  display_name: string;
  handle: string | null;
  direction: "you asked" | "they asked";
  asked_at: string;
}

/**
 * One thing somebody you know actually did, from `people_feed()`.
 *
 * Read straight off the ledger, ordered by time and nothing else. Resonance
 * is deliberately absent: "four people you follow have responded to this" is a
 * bandwagon with a friendly face.
 */
export interface PeopleFeedEvent {
  event_id: string;
  actor_id: string;
  actor_name: string;
  actor_handle: string | null;
  kind: string;
  subject_type: string;
  subject_id: string;
  title: string | null;
  tie: Tie;
  happened_at: string;
}

/**
 * A named set of proposals that cannot all happen.
 *
 * It decides the ORDER in which proposals that already passed go looking for
 * resources. It never decides whether any of them passed — that was settled by
 * `close_proposal()` on each one's own terms and nothing here reaches back
 * into it.
 */
export interface Contention {
  contention_id: string;
  question: string;
  note: string | null;
  members: number;
  /** How many people have named a first choice. Never which one, until it resolves. */
  responded: number;
  resolved_at: string | null;
}

/** One member of a contended set, from `contention_standing()`. */
export interface ContentionEntry {
  proposal_id: string;
  title: string;
  status: ProposalStatus;
  passed: boolean;
  /** Null until every member has closed — a running total is a bandwagon. */
  preferences: number | null;
  /** Null until it resolves, and only for the ones that passed. */
  order_position: number | null;
  revealed: boolean;
  /** Whether this is the one you named. Yours is visible to you at any time. */
  mine: boolean;
}

/**
 * An amendment to the wording of a Universal Law.
 *
 * Revision 1 is the shipped text and is not stored — the first row for a law
 * is revision 2. Nothing here is ever updated or deleted: superseded wordings
 * stay, because assessments point at them.
 */
export interface LawRevision {
  revision: number;
  text: string;
  violation_looks_like: string;
  adopted_at: string;
  adopted_from: string;
}

/** Where one amendment stands, from `amendment_standing()`. */
export interface AmendmentStanding {
  law_id: string;
  current_revision: number;
  proposed_text: string;
  proposed_violation: string;
  /** Higher than any scale's own threshold. The constitution is harder to change. */
  threshold: number;
  alignment: number | null;
  /** The lowest single voice. This is what the bar is applied to, not the mean. */
  lowest_voice: number | null;
  voices: number | null;
  passed: boolean;
  enacted: boolean;
  /** How many past proposals this law has killed. A reading list, not a verdict. */
  would_reopen: number;
}

/** Something this law has already refused, for people to read before voting. */
export interface PastRefusal {
  proposal_id: string;
  title: string;
  summary: string;
  reasoning: string;
  law_revision: number;
  decided_at: string | null;
}

export type ProjectionDirection = "effect" | "risk";
export type ProjectionVerdict = "held" | "missed" | "unclear";

/**
 * A dated, falsifiable claim about what a proposal will do.
 *
 * Frozen before the vote, never editable, never deletable, and marked against
 * reality when the horizon passes. `source` says whose words they are — the
 * model's or a person's — and `created_by` is always whoever put them on the
 * record.
 */
export interface Projection {
  id: string;
  proposal_id: string;
  direction: ProjectionDirection;
  statement: string;
  /** Days from the decision, not from when it was written. */
  horizon_days: number;
  confidence: number | null;
  source: "ai" | "human";
  created_by: string;
  prompt_id: string | null;
  prompt_version: string | null;
  model: string | null;
  verdict: ProjectionVerdict | null;
  verdict_note: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

/** A row from `projection_standing()`. */
export interface ProjectionStanding {
  total: number;
  effects: number;
  risks: number;
  resolved: number;
  held: number;
  missed: number;
  unclear: number;
  /** Come due and not yet marked. This is what blocks a project completing. */
  due_now: number;
  soonest_due: string | null;
}

/** A row from `due_projections()`: something waiting to be marked. */
export interface DueProjection {
  projection_id: string;
  proposal_id: string;
  title: string;
  direction: ProjectionDirection;
  statement: string;
  source: "ai" | "human";
  confidence: number | null;
  due_at: string;
  days_overdue: number;
}

/**
 * A row from `forecast_record()`. Never a person: whose WORDS they were.
 * There is no function that returns somebody else's record, on purpose.
 */
export interface ForecastRecord {
  source: "ai" | "human";
  marked: number;
  held: number;
  missed: number;
  unclear: number;
  /** held / (held + missed). Null until something has been settled either way. */
  hit_rate: number | null;
  mean_confidence: number | null;
}

/** A row from `personhood_standing()`: what one scale asks of you. */
export interface PersonhoodStanding {
  scope: GroupScope;
  required: boolean;
  min_voices: number;
  you_are_verified: boolean;
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
  /**
   * Population standard deviation of alignment. A mean without this hides
   * whether the group agreed or merely averaged.
   */
  dispersion: number | null;
  /** Spread, with both ends occupied. A split, not an uncertainty. */
  polarized: boolean;
  open_questions: number;
  open_concerns: number;
  /**
   * How many of the voices had proof of personhood when this closed. Recorded
   * at every scale, required at some — a decision carried by four accounts
   * that might be one person is a different object from one carried by four
   * people, and a record that showed them identically would be lying.
   */
  verified_voices: number | null;
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
    filesToHref: "/individual/journal",
  },
  {
    mode: "faith",
    label: "Faith",
    prompt: "A prayer, a practice, a question. Whatever this moment holds.",
    filesTo: "Profile",
    filesToHref: "/individual/profile",
  },
  {
    mode: "idea",
    label: "Idea",
    prompt: "What caught your attention? One sentence is enough.",
    filesTo: "Pipeline",
    filesToHref: "/individual/ideas",
  },
  {
    mode: "output",
    label: "Output",
    prompt: "Something worth sharing. A thought, a link, a draft line.",
    filesTo: "Connection",
    filesToHref: "/home",
  },
];
