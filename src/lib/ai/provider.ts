import type { PromptSpec } from "./prompts";

/**
 * The seam between Sovereign and whichever model is behind it.
 *
 * One method. A provider is handed a versioned prompt, a user message, and a
 * JSON schema describing the shape it must return; it returns parsed JSON and
 * the name of the model that produced it.
 *
 * Adding a provider means implementing this interface and registering it in
 * index.ts. Nothing in the application layer changes.
 */
export interface AiProvider {
  readonly name: string;
  /** True when this provider makes real calls. The UI says so where it matters. */
  readonly live: boolean;

  complete(args: {
    prompt: PromptSpec;
    input: string;
    schema: Record<string, unknown>;
    /** Name given to the structured-output tool. Shows up in provider logs. */
    schemaName: string;
    maxTokens?: number;
  }): Promise<{ data: unknown; model: string }>;
}

export class AiError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AiError";
  }
}
