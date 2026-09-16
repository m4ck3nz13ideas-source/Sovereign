import Anthropic from "@anthropic-ai/sdk";

import { env } from "@/lib/env";

import { AiError, type AiProvider } from "./provider";

/**
 * Anthropic adapter.
 *
 * Structured output is obtained by giving the model a single tool whose input
 * schema is the shape we want and requiring it. That is more reliable than
 * asking for JSON in prose and parsing whatever comes back.
 */
export class AnthropicProvider implements AiProvider {
  readonly name = "anthropic";
  readonly live = true;

  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async complete({
    prompt,
    input,
    schema,
    schemaName,
    maxTokens = 2048,
  }: {
    prompt: { system: string };
    input: string;
    schema: Record<string, unknown>;
    schemaName: string;
    maxTokens?: number;
  }) {
    const model = env.anthropicModel;

    let response;
    try {
      response = await this.client.messages.create({
        model,
        max_tokens: maxTokens,
        system: prompt.system,
        tools: [
          {
            name: schemaName,
            description: "Record the result in the required shape.",
            // The SDK's InputSchema type is narrower than an arbitrary JSON Schema.
            input_schema: schema as unknown as Anthropic.Tool["input_schema"],
          },
        ],
        tool_choice: { type: "tool", name: schemaName },
        messages: [{ role: "user", content: input }],
      });
    } catch (cause) {
      throw new AiError("The model call failed.", cause);
    }

    const block = response.content.find((c) => c.type === "tool_use");
    if (!block || block.type !== "tool_use") {
      throw new AiError("The model returned no structured result.");
    }

    return { data: block.input, model: response.model };
  }
}
