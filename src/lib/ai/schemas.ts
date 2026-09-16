import { z } from "zod";

/**
 * The shapes the AI layer is allowed to return.
 *
 * A model's output is parsed against these before it reaches the database. If
 * it does not fit, the call fails loudly rather than writing a half-formed
 * review that members will read as authoritative.
 */

const score = z.number().min(0).max(1);

export const reviewSchema = z.object({
  clarity: score,
  evidence: score,
  feasibility: score,
  reversibility: score,
  values_alignment: z.record(z.string(), score),
  risks: z
    .array(
      z.object({
        title: z.string().min(1),
        severity: z.enum(["low", "medium", "high"]),
        note: z.string(),
      }),
    )
    .max(10),
  questions: z.array(z.string()).max(5),
  memory_used: z.array(z.string()).max(6),
  summary: z.string().min(1),
});

export type ReviewOutput = z.infer<typeof reviewSchema>;

export const rationaleSchema = z.object({
  rationale: z.string().min(1),
});

export type RationaleOutput = z.infer<typeof rationaleSchema>;

export const reflectionSchema = z.object({
  question: z.string(),
  rationale: z.string(),
});

export type ReflectionOutput = z.infer<typeof reflectionSchema>;

export const synthesisSchema = z.object({
  question: z.string(),
  rationale: z.string(),
  suggested_title: z.string(),
  discipline: z.string(),
});

export type SynthesisOutput = z.infer<typeof synthesisSchema>;

/* ---------------------------------------------------------------------------
   JSON Schemas handed to the model as a tool definition, so the shape is
   enforced at generation time as well as at parse time.
--------------------------------------------------------------------------- */

const scoreSchema = { type: "number", minimum: 0, maximum: 1 } as const;

export const reviewJsonSchema = {
  type: "object",
  required: [
    "clarity",
    "evidence",
    "feasibility",
    "reversibility",
    "values_alignment",
    "risks",
    "questions",
    "memory_used",
    "summary",
  ],
  properties: {
    clarity: scoreSchema,
    evidence: scoreSchema,
    feasibility: scoreSchema,
    reversibility: scoreSchema,
    values_alignment: {
      type: "object",
      description: "One entry per group value, keyed by the value's exact name.",
      additionalProperties: scoreSchema,
    },
    risks: {
      type: "array",
      maxItems: 10,
      items: {
        type: "object",
        required: ["title", "severity", "note"],
        properties: {
          title: { type: "string" },
          severity: { type: "string", enum: ["low", "medium", "high"] },
          note: { type: "string" },
        },
      },
    },
    questions: { type: "array", maxItems: 5, items: { type: "string" } },
    memory_used: {
      type: "array",
      maxItems: 6,
      description: "Ids of past decisions that informed this review. Empty if none did.",
      items: { type: "string" },
    },
    summary: { type: "string" },
  },
} as const;

export const rationaleJsonSchema = {
  type: "object",
  required: ["rationale"],
  properties: { rationale: { type: "string" } },
} as const;

export const reflectionJsonSchema = {
  type: "object",
  required: ["question", "rationale"],
  properties: {
    question: {
      type: "string",
      description: "Empty string when no question is worth asking.",
    },
    rationale: { type: "string" },
  },
} as const;

export const synthesisJsonSchema = {
  type: "object",
  required: ["question", "rationale", "suggested_title", "discipline"],
  properties: {
    question: {
      type: "string",
      description: "Empty string when nothing is recurring.",
    },
    rationale: { type: "string" },
    suggested_title: { type: "string" },
    discipline: { type: "string" },
  },
} as const;
