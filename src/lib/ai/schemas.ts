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

/**
 * The Universal Law audit.
 *
 * Exactly ten readings, one per law, is enforced here rather than trusted:
 * a nine-law audit would silently leave a law unexamined while looking
 * complete, and law_standing() would call it lawful.
 */
export const lawAuditSchema = z.object({
  readings: z
    .array(
      z.object({
        law_id: z.string().min(1),
        verdict: z.enum(["aligned", "tension", "violation"]),
        reasoning: z.string().min(1),
      }),
    )
    .length(10),
});

export type LawAuditOutput = z.infer<typeof lawAuditSchema>;

/**
 * The sharpening pass.
 *
 * One reading per section, all six, enforced here for the same reason the law
 * audit enforces ten: a five-section reading would leave a section unexamined
 * while looking complete.
 */
export const SHARPEN_SECTIONS = [
  "intent",
  "change",
  "constraints",
  "risks",
  "alternatives",
  "evidence",
] as const;

export type SharpenSection = (typeof SHARPEN_SECTIONS)[number];

export const sharpenSchema = z.object({
  sections: z
    .array(
      z.object({
        section: z.enum(SHARPEN_SECTIONS),
        ready: z.boolean(),
        note: z.string().min(1),
        questions: z.array(z.string()).max(4),
      }),
    )
    .length(6),
  readiness: score,
  verdict: z.string().min(1),
});

export type SharpenOutput = z.infer<typeof sharpenSchema>;

/** The debate summary. Arguments in the participants' terms, not the model's. */
export const debateSchema = z.object({
  arguments_for: z
    .array(z.object({ point: z.string().min(1), from: z.string() }))
    .max(6),
  arguments_against: z
    .array(z.object({ point: z.string().min(1), from: z.string() }))
    .max(6),
  unresolved: z.array(z.string()).max(6),
  shifted: z.string(),
  polarization: z.enum(["converging", "mixed", "splitting"]),
  reading: z.string().min(1),
});

export type DebateOutput = z.infer<typeof debateSchema>;

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

export const lawAuditJsonSchema = {
  type: "object",
  required: ["readings"],
  properties: {
    readings: {
      type: "array",
      minItems: 10,
      maxItems: 10,
      description: "One reading per Universal Law, all ten, in the order given.",
      items: {
        type: "object",
        required: ["law_id", "verdict", "reasoning"],
        properties: {
          law_id: {
            type: "string",
            description: "The law's id, exactly as given in the prompt.",
          },
          verdict: {
            type: "string",
            enum: ["aligned", "tension", "violation"],
          },
          reasoning: {
            type: "string",
            description:
              "One paragraph. What in the proposal, against what part of the law.",
          },
        },
      },
    },
  },
} as const;

export const sharpenJsonSchema = {
  type: "object",
  required: ["sections", "readiness", "verdict"],
  properties: {
    sections: {
      type: "array",
      minItems: 6,
      maxItems: 6,
      description: "One reading per section, all six, in the order given.",
      items: {
        type: "object",
        required: ["section", "ready", "note", "questions"],
        properties: {
          section: {
            type: "string",
            enum: [...SHARPEN_SECTIONS],
          },
          ready: { type: "boolean" },
          note: {
            type: "string",
            description: "One or two sentences to the author about this section.",
          },
          questions: {
            type: "array",
            maxItems: 4,
            description:
              "The specific questions still unanswered. Empty when the section is ready.",
            items: { type: "string" },
          },
        },
      },
    },
    readiness: scoreSchema,
    verdict: { type: "string" },
  },
} as const;

const argumentList = {
  type: "array",
  maxItems: 6,
  items: {
    type: "object",
    required: ["point", "from"],
    properties: {
      point: { type: "string", description: "The argument, at its strongest." },
      from: {
        type: "string",
        description: "Who made it, by display name. Empty if it is the thread's collective position.",
      },
    },
  },
} as const;

export const debateJsonSchema = {
  type: "object",
  required: [
    "arguments_for",
    "arguments_against",
    "unresolved",
    "shifted",
    "polarization",
    "reading",
  ],
  properties: {
    arguments_for: argumentList,
    arguments_against: argumentList,
    unresolved: {
      type: "array",
      maxItems: 6,
      description: "Questions and concerns nobody has taken up. Specific and short.",
      items: { type: "string" },
    },
    shifted: {
      type: "string",
      description: "What moved during the debate. Empty string when nothing did.",
    },
    polarization: {
      type: "string",
      enum: ["converging", "mixed", "splitting"],
      description: "A reading of the argument, never of anyone's vote.",
    },
    reading: { type: "string" },
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
