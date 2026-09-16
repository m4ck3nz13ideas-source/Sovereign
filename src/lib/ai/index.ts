import "server-only";

import { env } from "@/lib/env";

import { AnthropicProvider } from "./anthropic";
import { MockProvider } from "./mock";
import {
  DECISION_RATIONALE,
  PROPOSAL_REVIEW,
  REFLECTION_PROMPT,
  SYNTHESIS_PROMPT,
} from "./prompts";
import { AiError, type AiProvider } from "./provider";
import {
  rationaleJsonSchema,
  rationaleSchema,
  reflectionJsonSchema,
  reflectionSchema,
  reviewJsonSchema,
  reviewSchema,
  synthesisJsonSchema,
  synthesisSchema,
  type ReflectionOutput,
  type ReviewOutput,
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
