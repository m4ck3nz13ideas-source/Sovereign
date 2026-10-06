import "server-only";

import { env } from "@/lib/env";
import { UNIVERSAL_LAWS } from "@/lib/universal-law";

import { AnthropicProvider } from "./anthropic";
import { MockProvider } from "./mock";
import {
  DEBATE_SUMMARY,
  DECISION_RATIONALE,
  GUARDIAN,
  IMPACT_SIMULATION,
  LAW_AUDIT,
  PROPOSAL_REVIEW,
  PROPOSAL_SHARPEN,
  POST_WITNESS,
  REFLECTION_PROMPT,
  SYNTHESIS_PROMPT,
  QUESTION_POSITIONS,
  VENDOR_VETTING,
  AI_CHAT,
  PROPOSAL_CONDITIONS,
  SELF_FOCUS,
} from "./prompts";
import { AiError, type AiProvider } from "./provider";
import {
  debateJsonSchema,
  debateSchema,
  lawAuditJsonSchema,
  lawAuditSchema,
  rationaleJsonSchema,
  rationaleSchema,
  reflectionJsonSchema,
  reflectionSchema,
  reviewJsonSchema,
  reviewSchema,
  guardianJsonSchema,
  guardianSchema,
  sharpenJsonSchema,
  sharpenSchema,
  simulationJsonSchema,
  simulationSchema,
  SHARPEN_SECTIONS,
  synthesisJsonSchema,
  synthesisSchema,
  witnessJsonSchema,
  witnessSchema,
  type DebateOutput,
  type GuardianOutput,
  type LawAuditOutput,
  type ReflectionOutput,
  type ReviewOutput,
  type SharpenOutput,
  type SimulationOutput,
  type SynthesisOutput,
  type WitnessOutput,
  positionsSchema,
  positionsJsonSchema,
  type PositionsOutput,
  chatJsonSchema,
  chatSchema,
  conditionsJsonSchema,
  conditionsSchema,
  type ConditionsOutput,
  focusJsonSchema,
  focusSchema,
} from "./schemas";

/**
 * The AI layer.
 *
 * Every call here happens on the server. The key never reaches the browser, and
 * the prompts are not something a client can substitute — a member cannot talk
 * the reviewer into a better score by editing a request.
 */

let cached: AiProvider | null = null;

export function provider(): AiProvider {
  if (cached) return cached;
  const key = env.anthropicKey;
  cached = key ? new AnthropicProvider(key) : new MockProvider();
  return cached;
}

/** Whether a real model is behind the AI layer. Shown in Settings and on reviews. */
export function aiIsLive(): boolean {
  return provider().live;
}

export interface ReviewContext {
  proposal: {
    title: string;
    summary: string;
    body: string;
    category: string | null;
    budget: string | null;
    termDays: number | null;
  };
  groupName: string;
  groupPurpose: string | null;
  /** The group's values, as the group defines them. The rubric is theirs. */
  values: { name: string; definition: string | null }[];
  /** Past decisions retrieved by value overlap, most relevant first. */
  memory: {
    id: string;
    title: string;
    outcome: string;
    decided_at: string;
    expected: string | null;
    actual: string | null;
    lesson: string | null;
  }[];
}

export async function reviewProposal(
  ctx: ReviewContext,
): Promise<{ review: ReviewOutput; model: string; prompt: typeof PROPOSAL_REVIEW }> {
  const valueLines = ctx.values.length
    ? ctx.values
        .map((v) => `- ${v.name}: ${v.definition ?? "(no definition given)"}`)
        .join("\n")
    : "- (this group has not stated its values yet; score an empty object)";

  const memoryBlock = ctx.memory.length
    ? ctx.memory
        .map(
          (m) =>
            [
              `id: ${m.id}`,
              `title: ${m.title}`,
              `outcome: ${m.outcome} on ${m.decided_at.slice(0, 10)}`,
              `expected: ${m.expected ?? "—"}`,
              `actually happened: ${m.actual ?? "not yet known"}`,
              `lesson recorded: ${m.lesson ?? "—"}`,
            ].join("\n"),
        )
        .join("\n\n")
    : "(no past decisions in this group yet)";

  const input = `GROUP
${ctx.groupName}${ctx.groupPurpose ? ` — ${ctx.groupPurpose}` : ""}

THE GROUP'S VALUES
${valueLines}

PAST DECISIONS BY THIS GROUP
${memoryBlock}

THE PROPOSAL
title: ${ctx.proposal.title}
summary: ${ctx.proposal.summary}
category: ${ctx.proposal.category ?? "—"}
budget: ${ctx.proposal.budget ?? "none stated"}
term: ${ctx.proposal.termDays ? `${ctx.proposal.termDays} days` : "none stated"}

${ctx.proposal.body}`;

  const { data, model } = await provider().complete({
    prompt: PROPOSAL_REVIEW,
    input,
    schema: reviewJsonSchema as unknown as Record<string, unknown>,
    schemaName: "record_review",
    maxTokens: 3000,
  });

  const parsed = reviewSchema.safeParse(data);
  if (!parsed.success) {
    throw new AiError(`The review did not match the expected shape: ${parsed.error.message}`);
  }

  return { review: parsed.data, model, prompt: PROPOSAL_REVIEW };
}

/**
 * The Universal Law audit.
 *
 * The laws are sent with every call rather than assumed known, because the
 * model must be reading the text that shipped with this build — not its
 * memory of something similar. A challenge from a member is passed in and
 * must be considered; it does not oblige a different answer.
 */
/**
 * A draft, as the six sections the author fills in.
 *
 * This is the only shape in this file that describes something not yet in the
 * database — a sharpening runs on a draft that exists in one browser.
 */
export interface Draft {
  title: string;
  summary: string;
  intent: string;
  change: string;
  constraints: string;
  risks: string;
  alternatives: string;
  evidence: string;
  scope: string;
  place: string | null;
  budget: string | null;
  termDays: string | null;
}

/** The whole draft as one block, and the exact text the readiness is bound to. */
export function draftBody(d: Draft): string {
  return [
    `## What this is solving
${d.intent.trim()}`,
    `## What would change
${d.change.trim()}`,
    `## What it takes
${d.constraints.trim()}`,
    `## What could go wrong
${d.risks.trim()}`,
    `## What else was considered
${d.alternatives.trim()}`,
    d.evidence.trim() ? `## Evidence
${d.evidence.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Sharpen a draft.
 *
 * Runs before anything reaches the shared store, and its verdict is what
 * decides whether the author may submit at all. See PROPOSAL_SHARPEN.
 */
export async function sharpenDraft(
  draft: Draft,
): Promise<{ sharpen: SharpenOutput; model: string; prompt: typeof PROPOSAL_SHARPEN }> {
  const input = `WHO THIS WOULD BE PUT TO
scale: ${draft.scope}${draft.place ? ` — ${draft.place}` : ""}

Judge the rigour against what is being asked of whom. A street deciding where
to meet is not a country committing money.

THE DRAFT
title: ${draft.title}
in one line: ${draft.summary}
budget: ${draft.budget?.trim() ? draft.budget : "none stated"}
term: ${draft.termDays?.trim() ? `${draft.termDays} days` : "none stated"}

intent:
${draft.intent.trim() || "(empty)"}

change:
${draft.change.trim() || "(empty)"}

constraints:
${draft.constraints.trim() || "(empty)"}

risks:
${draft.risks.trim() || "(empty)"}

alternatives:
${draft.alternatives.trim() || "(empty)"}

evidence:
${draft.evidence.trim() || "(none given — this section is optional)"}

Return exactly six section readings, using the section names given above.`;

  const { data, model } = await provider().complete({
    prompt: PROPOSAL_SHARPEN,
    input,
    schema: sharpenJsonSchema as unknown as Record<string, unknown>,
    schemaName: "record_sharpening",
    maxTokens: 3000,
  });

  const parsed = sharpenSchema.safeParse(data);
  if (!parsed.success) {
    throw new AiError(
      `The sharpening did not match the expected shape: ${parsed.error.message}`,
    );
  }

  // All six, exactly once. A reading that silently skipped "risks" would let a
  // draft through on five sections while looking complete.
  const seen = new Set(parsed.data.sections.map((r) => r.section));
  const missing = SHARPEN_SECTIONS.filter((x) => !seen.has(x));
  if (missing.length) {
    throw new AiError(`The sharpening did not cover: ${missing.join(", ")}.`);
  }

  return { sharpen: parsed.data, model, prompt: PROPOSAL_SHARPEN };
}

/**
 * Summarise a deliberation thread.
 *
 * Runs on demand rather than on a timer: a summary is an artefact with a
 * version on it, and one written by a cron job at 3am is one nobody asked for
 * and nobody can date to a moment in the argument.
 *
 * The votes are not passed in and must not be. They are hidden until the
 * proposal closes, and a polarization reading inferred from them would be that
 * rule broken by another route.
 */
export async function summariseDebate(ctx: {
  proposal: { title: string; summary: string; intent: string; change: string };
  contributions: {
    kind: string;
    author: string;
    body: string;
    answer: string | null;
    answeredBy: string | null;
    when: string;
  }[];
}): Promise<{ debate: DebateOutput; model: string; prompt: typeof DEBATE_SUMMARY }> {
  const thread = ctx.contributions
    .map((c) =>
      [
        `[${c.kind}] ${c.author} — ${c.when}`,
        c.body,
        c.answer ? `ANSWERED by ${c.answeredBy ?? "a member"}: ${c.answer}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n---\n\n");

  const input = `THE PROPOSAL
title: ${ctx.proposal.title}
in one line: ${ctx.proposal.summary}

what it is solving:
${ctx.proposal.intent}

what would change:
${ctx.proposal.change}

THE THREAD, in order
${thread || "(nothing said yet)"}

You cannot see anyone's resonance and are not being asked to guess it.`;

  const { data, model } = await provider().complete({
    prompt: DEBATE_SUMMARY,
    input,
    schema: debateJsonSchema as unknown as Record<string, unknown>,
    schemaName: "record_debate_summary",
    maxTokens: 2500,
  });

  const parsed = debateSchema.safeParse(data);
  if (!parsed.success) {
    throw new AiError(
      `The debate summary did not match the expected shape: ${parsed.error.message}`,
    );
  }

  return { debate: parsed.data, model, prompt: DEBATE_SUMMARY };
}

export async function auditAgainstLaw(ctx: {
  proposal: { title: string; summary: string; body: string; scope: string; budget: string | null };
  groupName: string;
  /** A member's argument that a previous verdict was wrong. */
  challenge?: { law: string; previousVerdict: string; argument: string } | null;
  /**
   * The laws as they currently read. Defaults to the shipped text, which is
   * revision 1 of each — the caller passes the amended set once anything has
   * been amended, because auditing against superseded wording would make the
   * amendment protocol decorative.
   */
  laws?: typeof UNIVERSAL_LAWS;
}): Promise<{ readings: LawAuditOutput["readings"]; model: string; prompt: typeof LAW_AUDIT }> {
  const laws = (ctx.laws ?? UNIVERSAL_LAWS).map(
    (l) =>
      `${l.ordinal}. ${l.name}\n   id: ${l.id}\n   "${l.text}"\n   a violation here looks like: ${l.violationLooksLike}`,
  ).join("\n\n");

  const challengeBlock = ctx.challenge
    ? `\n\nA MEMBER HAS CHALLENGED AN EARLIER READING\n\nlaw: ${ctx.challenge.law}\nyour previous verdict: ${ctx.challenge.previousVerdict}\ntheir argument:\n${ctx.challenge.argument}\n\nConsider it seriously and address it in your reasoning for that law. It does not oblige you to change your verdict — if the law still says what it said, say so and explain why their argument does not reach it. Changing a verdict because someone objected, rather than because they were right, would make the audit worthless.`
    : "";

  const input = `THE TEN UNIVERSAL LAWS

${laws}

THE PROPOSAL
group: ${ctx.groupName}
scope: ${ctx.proposal.scope}
title: ${ctx.proposal.title}
summary: ${ctx.proposal.summary}
budget: ${ctx.proposal.budget ?? "none stated"}

${ctx.proposal.body}${challengeBlock}

Return exactly ten readings, one per law, using the ids given above.`;

  const { data, model } = await provider().complete({
    prompt: LAW_AUDIT,
    input,
    schema: lawAuditJsonSchema as unknown as Record<string, unknown>,
    schemaName: "record_law_audit",
    maxTokens: 4000,
  });

  const parsed = lawAuditSchema.safeParse(data);
  if (!parsed.success) {
    throw new AiError(`The law audit did not match the expected shape: ${parsed.error.message}`);
  }

  // Every law must be present exactly once. A model that returns ten readings
  // covering nine laws would otherwise leave one unexamined while law_standing()
  // reported a complete audit.
  const seen = new Set(parsed.data.readings.map((r) => r.law_id));
  const missing = UNIVERSAL_LAWS.filter((l) => !seen.has(l.id));
  if (missing.length) {
    throw new AiError(
      `The audit did not cover: ${missing.map((l) => l.name).join(", ")}.`,
    );
  }

  return { readings: parsed.data.readings, model, prompt: LAW_AUDIT };
}

/** Reads a business against the ten Universal Laws, for the marketplace. */
export async function vetVendor(vendor: {
  name: string;
  description: string;
  evidence: string;
  website: string;
  location: string | null;
}): Promise<{ readings: LawAuditOutput["readings"]; model: string; prompt: typeof VENDOR_VETTING }> {
  const laws = UNIVERSAL_LAWS.map(
    (l) =>
      `${l.ordinal}. ${l.name}\n   id: ${l.id}\n   "${l.text}"\n   a violation here looks like: ${l.violationLooksLike}`,
  ).join("\n\n");

  const input = `THE TEN UNIVERSAL LAWS

${laws}

THE BUSINESS
name: ${vendor.name}
website: ${vendor.website}
location: ${vendor.location ?? "not given"}

what it is:
${vendor.description}

its evidence:
${vendor.evidence}

Return exactly ten readings, one per law, using the ids given above.`;

  const { data, model } = await provider().complete({
    prompt: VENDOR_VETTING,
    input,
    schema: lawAuditJsonSchema as unknown as Record<string, unknown>,
    schemaName: "record_law_audit",
    maxTokens: 4000,
  });

  const parsed = lawAuditSchema.safeParse(data);
  if (!parsed.success) {
    throw new AiError(`The vetting did not match the expected shape: ${parsed.error.message}`);
  }
  const seen = new Set(parsed.data.readings.map((r) => r.law_id));
  const missing = UNIVERSAL_LAWS.filter((l) => !seen.has(l.id));
  if (missing.length) {
    throw new AiError(`The vetting did not cover: ${missing.map((l) => l.name).join(", ")}.`);
  }
  return { readings: parsed.data.readings, model, prompt: VENDOR_VETTING };
}

export interface RationaleContext {
  title: string;
  summary: string;
  outcome: "passed" | "failed";
  alignment: number | null;
  confidence: number | null;
  urgency: number | null;
  participation: number | null;
  voters: number;
  members: number;
  thresholds: { alignment: number; participation: number };
  reviewSummary: string | null;
  comments: { author: string; body: string }[];
  flags: { label: string; resolution: string | null }[];
}

/**
 * The impact simulation.
 *
 * Given the proposal and what the reviewer already found, propose dated claims
 * about what will be true afterwards. Nothing this returns is stored: the
 * screen shows them as candidates and a person decides which go on the record,
 * because a prediction nobody chose to make is not one the group owns.
 */
export async function simulateImpact(ctx: {
  proposal: {
    title: string;
    summary: string;
    body: string;
    scope: string;
    place: string | null;
    budget: string | null;
    termDays: number | null;
  };
  /** What the reviewer already said, so the simulation adds rather than repeats. */
  reviewSummary: string | null;
  risks: { title: string; severity: string; note: string }[];
  /** How comparable past decisions actually went. The only evidence there is. */
  past: { title: string; expected: string | null; actual: string | null; lesson: string | null }[];
}): Promise<{
  result: SimulationOutput;
  model: string;
  prompt: typeof IMPACT_SIMULATION;
}> {
  const input = `THE PROPOSAL
title: ${ctx.proposal.title}
in one line: ${ctx.proposal.summary}
addressed to: ${ctx.proposal.place ? `${ctx.proposal.place} (${ctx.proposal.scope})` : ctx.proposal.scope}
budget: ${ctx.proposal.budget ?? "none stated"}
term: ${ctx.proposal.termDays ? `${ctx.proposal.termDays} days` : "none stated"}

${ctx.proposal.body}

WHAT THE REVIEWER FOUND
${ctx.reviewSummary ?? "(no review on file)"}

RISKS ALREADY NAMED
${
  ctx.risks.length
    ? ctx.risks.map((r) => `- [${r.severity}] ${r.title}: ${r.note}`).join("\n")
    : "(none)"
}

HOW COMPARABLE DECISIONS HERE ACTUALLY WENT
${
  ctx.past.length
    ? ctx.past
        .map(
          (d) =>
            `- ${d.title}\n  expected: ${d.expected ?? "not recorded"}\n  actually: ${d.actual ?? "not yet known"}${d.lesson ? `\n  lesson: ${d.lesson}` : ""}`,
        )
        .join("\n")
    : "(nothing comparable has closed here yet)"
}

Do not repeat a risk the reviewer has already named unless you can make it
checkable and dated, which is the thing this adds.`;

  const { data, model } = await provider().complete({
    prompt: IMPACT_SIMULATION,
    input,
    schema: simulationJsonSchema as unknown as Record<string, unknown>,
    schemaName: "record_simulation",
    maxTokens: 2000,
  });

  const parsed = simulationSchema.safeParse(data);
  if (!parsed.success) {
    throw new AiError(
      `The simulation did not match the expected shape: ${parsed.error.message}`,
    );
  }

  return { result: parsed.data, model, prompt: IMPACT_SIMULATION };
}

/**
 * One person's guardian, reading one proposal against what they wrote down.
 *
 * Note what is NOT a parameter: their journal, their drafts, how they voted
 * before, what they have read, who they know. The context is the proposal and
 * their own stated values, and widening it is a decision somebody should have
 * to make on purpose rather than by adding a field here.
 */
export async function askGuardian(ctx: {
  proposal: { title: string; summary: string; body: string; scope: string; place: string | null };
  /** Their own words, from their own values screen. Nothing inferred. */
  values: { name: string; definition: string | null }[];
  /** True when this is their own draft rather than somebody else's proposal. */
  ownDraft: boolean;
}): Promise<{ result: GuardianOutput; model: string; prompt: typeof GUARDIAN }> {
  const values = ctx.values.length
    ? ctx.values
        .map((v) => `- ${v.name}${v.definition ? `: ${v.definition}` : ""}`)
        .join("\n")
    : "(they have not written any down — ask about the proposal on its own terms and do not guess at what they value)";

  const input = `WHAT THEY WROTE DOWN THAT THEY VALUE
${values}

${ctx.ownDraft ? "THEIR OWN DRAFT" : "THE PROPOSAL"}
title: ${ctx.proposal.title}
in one line: ${ctx.proposal.summary}
addressed to: ${ctx.proposal.place ?? ctx.proposal.scope}

${ctx.proposal.body}

${
  ctx.ownDraft
    ? "This is theirs and not yet submitted. The useful questions are the ones somebody else will ask them."
    : "This is somebody else's and they are deciding how to respond to it."
}`;

  const { data, model } = await provider().complete({
    prompt: GUARDIAN,
    input,
    schema: guardianJsonSchema as unknown as Record<string, unknown>,
    schemaName: "record_guardian",
    maxTokens: 1500,
  });

  const parsed = guardianSchema.safeParse(data);
  if (!parsed.success) {
    throw new AiError(`The guardian did not match the expected shape: ${parsed.error.message}`);
  }

  return { result: parsed.data, model, prompt: GUARDIAN };
}

export async function writeRationale(
  ctx: RationaleContext,
): Promise<{ rationale: string; model: string; prompt: typeof DECISION_RATIONALE }> {
  const input = `PROPOSAL
${ctx.title}
${ctx.summary}

REVIEW SUMMARY
${ctx.reviewSummary ?? "(no review on file)"}

DELIBERATION
${ctx.comments.length ? ctx.comments.map((c) => `${c.author}: ${c.body}`).join("\n\n") : "(no comments)"}

CRITICAL FLAGS
${ctx.flags.length ? ctx.flags.map((f) => `- ${f.label}\n  answered: ${f.resolution ?? "UNANSWERED"}`).join("\n") : "(none raised)"}

RESONANCE
alignment: ${fmt(ctx.alignment)} (threshold ${ctx.thresholds.alignment})
confidence: ${fmt(ctx.confidence)}
urgency: ${fmt(ctx.urgency)}
participation: ${fmt(ctx.participation)} — ${ctx.voters} of ${ctx.members} members (threshold ${ctx.thresholds.participation})

OUTCOME: ${ctx.outcome}`;

  const { data, model } = await provider().complete({
    prompt: DECISION_RATIONALE,
    input,
    schema: rationaleJsonSchema as unknown as Record<string, unknown>,
    schemaName: "record_rationale",
    maxTokens: 800,
  });

  const parsed = rationaleSchema.safeParse(data);
  if (!parsed.success) {
    throw new AiError(`The rationale did not match the expected shape: ${parsed.error.message}`);
  }

  return { rationale: parsed.data.rationale, model, prompt: DECISION_RATIONALE };
}

export async function reflectionQuestion(
  entries: { created_at: string; body: string }[],
): Promise<{ result: ReflectionOutput; model: string; prompt: typeof REFLECTION_PROMPT }> {
  const input = entries
    .map((e) => `${e.created_at.slice(0, 10)}\n${e.body}\n---`)
    .join("\n");

  const { data, model } = await provider().complete({
    prompt: REFLECTION_PROMPT,
    input: input || "(no entries)",
    schema: reflectionJsonSchema as unknown as Record<string, unknown>,
    schemaName: "record_reflection",
    maxTokens: 600,
  });

  const parsed = reflectionSchema.safeParse(data);
  if (!parsed.success) {
    throw new AiError(`The reflection did not match the expected shape: ${parsed.error.message}`);
  }

  return { result: parsed.data, model, prompt: REFLECTION_PROMPT };
}

export async function synthesisQuestion(
  ideas: { created_at: string; body: string }[],
  concepts: { title: string; discipline: string | null }[],
): Promise<{ result: SynthesisOutput; model: string; prompt: typeof SYNTHESIS_PROMPT }> {
  const input = `EXISTING CONCEPTS
${concepts.length ? concepts.map((c) => `- ${c.title} (${c.discipline ?? "unfiled"})`).join("\n") : "(none yet)"}

IDEA INBOX
${ideas.map((e) => `${e.created_at.slice(0, 10)}\n${e.body}\n---`).join("\n") || "(empty)"}`;

  const { data, model } = await provider().complete({
    prompt: SYNTHESIS_PROMPT,
    input,
    schema: synthesisJsonSchema as unknown as Record<string, unknown>,
    schemaName: "record_synthesis",
    maxTokens: 600,
  });

  const parsed = synthesisSchema.safeParse(data);
  if (!parsed.success) {
    throw new AiError(`The synthesis did not match the expected shape: ${parsed.error.message}`);
  }

  return { result: parsed.data, model, prompt: SYNTHESIS_PROMPT };
}

/**
 * What several ways of knowing hold about one question.
 *
 * Returns a survey and never a conclusion. The provider is asked for at least
 * two lenses and the database refuses fewer, so there is no path by which a
 * single position reaches a screen looking like an answer.
 */
export async function surveyPositions(ctx: {
  question: string;
  /** The proposal it was asked about, so the lenses address this rather than the abstract case. */
  proposal: { title: string; summary: string; scope: string; place: string | null };
}): Promise<{
  result: PositionsOutput;
  model: string;
  prompt: typeof QUESTION_POSITIONS;
}> {
  const input = `THE QUESTION
${ctx.question}

ASKED WHILE READING THIS PROPOSAL
title: ${ctx.proposal.title}
in one line: ${ctx.proposal.summary}
addressed to: ${ctx.proposal.place ? `${ctx.proposal.place} (${ctx.proposal.scope})` : ctx.proposal.scope}

Address the question as it bears on this decision, not the abstract version of
it. Survey what the lenses hold. Do not resolve them.`;

  const { data, model } = await provider().complete({
    prompt: QUESTION_POSITIONS,
    input,
    schema: positionsJsonSchema as unknown as Record<string, unknown>,
    schemaName: "record_positions",
    maxTokens: 2400,
  });

  const parsed = positionsSchema.safeParse(data);
  if (!parsed.success) {
    throw new AiError(
      `The survey did not match the expected shape: ${parsed.error.message}`,
    );
  }

  return { result: parsed.data, model, prompt: QUESTION_POSITIONS };
}


function fmt(n: number | null): string {
  return n === null ? "—" : n.toFixed(2);
}

export { AiError } from "./provider";
export * from "./prompts";

/* ---------------------------------------------------------------------------
   The witness.

   Runs on a post before anybody sees it, on text that exists only in the
   author's browser until it clears. The database refuses a post without a
   reading of these exact words at or above the floor (0025), so this is the
   gate rather than a suggestion — but the refusal is answerable: the concerns
   name the line that did it and the author rewrites.

   `fast` tier on purpose. This runs on every post somebody writes, it is one
   number and two sentences, and a gate people wait ten seconds for is a gate
   they route around by not posting.
--------------------------------------------------------------------------- */

export const POST_FLOOR = 0.6;

export async function readPost(post: {
  body: string;
  kind: string;
  mediaUrl?: string | null;
  mediaKind?: string | null;
}): Promise<{ witness: WitnessOutput; model: string; prompt: typeof POST_WITNESS }> {
  const input = `WHAT THE AUTHOR SAYS THIS IS
${post.kind}

THE POST
${post.body.trim()}

${
  post.mediaUrl
    ? `ATTACHED
a ${post.mediaKind ?? "link"}: ${post.mediaUrl}

You cannot open it. Judge the words, and treat the link as part of what is
being claimed — a post whose words exist to get somebody to click something is
the thing you are keeping out.`
    : "Nothing is attached."
}`;

  const { data, model } = await provider().complete({
    prompt: POST_WITNESS,
    input,
    schema: witnessJsonSchema as unknown as Record<string, unknown>,
    schemaName: "record_witness",
    maxTokens: 700,
  });

  const parsed = witnessSchema.safeParse(data);
  if (!parsed.success) {
    throw new AiError(
      `The witness reading did not match the expected shape: ${parsed.error.message}`,
    );
  }

  return { witness: parsed.data, model, prompt: POST_WITNESS };
}

/** One turn of the private chat. Nothing is stored. */
export async function chatTurn(
  history: { role: "you" | "ai"; text: string }[],
  values: { name: string; definition: string | null }[],
  self: { description: string; focus: string | null } | null = null,
): Promise<string> {
  const vals = values.length
    ? values.map((v) => `- ${v.name}${v.definition ? `: ${v.definition}` : ""}`).join("\n")
    : "(none written yet)";
  const convo = history
    .slice(-20)
    .map((m) => `${m.role === "you" ? "THEM" : "YOU"}: ${m.text}`)
    .join("\n\n");
  const know = self
    ? `\n\nWHAT THEY FOUND IN KNOW YOURSELF — the centre of what you understand about them\n${self.description}${
        self.focus ? `\nTHEIR FOCUS: ${self.focus}` : ""
      }`
    : "";
  const input = `THEIR VALUES, IN THEIR WORDS\n${vals}${know}\n\nTHE CONVERSATION SO FAR\n${convo}\n\nReply to their last message.`;

  const { data } = await provider().complete({
    prompt: AI_CHAT,
    input,
    schema: chatJsonSchema as unknown as Record<string, unknown>,
    schemaName: "record_chat",
    maxTokens: 1500,
  });
  const parsed = chatSchema.safeParse(data);
  if (!parsed.success) throw new AiError("The reply did not come back in the expected shape.");
  return parsed.data.reply;
}

/** Sets one proposal's conditions: voices, window and what must be answered. */
export async function setConditions(ctx: {
  title: string;
  summary: string | null;
  body: string;
  scale: string;
  where: string;
  members: number | null;
  budget: string | null;
}): Promise<{ conditions: ConditionsOutput; model: string; prompt: typeof PROPOSAL_CONDITIONS }> {
  const input = `THE PROPOSAL
title: ${ctx.title}
summary: ${ctx.summary ?? "(none)"}
scale: ${ctx.scale}
addressed to: ${ctx.where}
members: ${ctx.members ?? "n/a"}
budget: ${ctx.budget ?? "none"}

${ctx.body}`;

  const { data, model } = await provider().complete({
    prompt: PROPOSAL_CONDITIONS,
    input,
    schema: conditionsJsonSchema as unknown as Record<string, unknown>,
    schemaName: "record_conditions",
    maxTokens: 1500,
  });
  const parsed = conditionsSchema.safeParse(data);
  if (!parsed.success) throw new AiError(`The conditions did not match the expected shape: ${parsed.error.message}`);
  return { conditions: parsed.data, model, prompt: PROPOSAL_CONDITIONS };
}

export interface SelfAssessmentInput {
  needs: Record<string, number>;
  topNeeds: string[];
  toward: string[];
  away: string[];
  beliefs: { area: string; limiting: string; empowering: string }[];
  goals: { result: string; purpose: string; actions: string[] }[];
}

export function describeSelf(a: SelfAssessmentInput): string {
  const needs = Object.entries(a.needs)
    .map(([k, v]) => `${k} ${v.toFixed(2)}`)
    .join(", ");
  const beliefs = a.beliefs.length
    ? a.beliefs.map((b) => `- ${b.area}: holds "${b.limiting}"; would rather believe "${b.empowering}"`).join("\n")
    : "(none given)";
  const goals = a.goals.length
    ? a.goals
        .map((g, i) => `GOAL ${i + 1}: ${g.result}\n  purpose: ${g.purpose}\n  first actions: ${g.actions.join("; ")}`)
        .join("\n")
    : "(none given)";
  return `NEEDS: ${needs}
TOP NEEDS: ${a.topNeeds.join(" and ")}
TOWARD: ${a.toward.join(", ")}
AWAY FROM: ${a.away.join(", ") || "(none)"}
BELIEFS:
${beliefs}
${goals}`;
}

/** What to focus on, from one person's own assessment. */
export async function readFocus(a: SelfAssessmentInput): Promise<{ focus: string; model: string }> {
  const { data, model } = await provider().complete({
    prompt: SELF_FOCUS,
    input: describeSelf(a),
    schema: focusJsonSchema as unknown as Record<string, unknown>,
    schemaName: "record_focus",
    maxTokens: 800,
  });
  const parsed = focusSchema.safeParse(data);
  if (!parsed.success) throw new AiError("The focus did not come back in the expected shape.");
  return { focus: parsed.data.focus, model };
}
