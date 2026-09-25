import "server-only";

import { env } from "@/lib/env";
import { UNIVERSAL_LAWS } from "@/lib/universal-law";

import { AnthropicProvider } from "./anthropic";
import { MockProvider } from "./mock";
import {
  DEBATE_SUMMARY,
  DECISION_RATIONALE,
  LAW_AUDIT,
  PROPOSAL_REVIEW,
  PROPOSAL_SHARPEN,
  REFLECTION_PROMPT,
  SYNTHESIS_PROMPT,
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
  sharpenJsonSchema,
  sharpenSchema,
  SHARPEN_SECTIONS,
  synthesisJsonSchema,
  synthesisSchema,
  type DebateOutput,
  type LawAuditOutput,
  type ReflectionOutput,
  type ReviewOutput,
  type SharpenOutput,
  type SynthesisOutput,
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
}): Promise<{ readings: LawAuditOutput["readings"]; model: string; prompt: typeof LAW_AUDIT }> {
  const laws = UNIVERSAL_LAWS.map(
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

function fmt(n: number | null): string {
  return n === null ? "—" : n.toFixed(2);
}

export { AiError } from "./provider";
export * from "./prompts";
