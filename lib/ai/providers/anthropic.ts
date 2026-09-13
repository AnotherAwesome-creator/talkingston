import type { z } from "zod";
import { normalizeOptions, parseStructured, readJsonResponse } from "./shared";
import type { AiMessage, AiProvider, AiRequestOptions } from "./types";

export class AnthropicProvider implements AiProvider {
  readonly name = "anthropic";
  readonly model: string;
  constructor(private readonly apiKey: string, model = "claude-3-5-haiku-latest") { this.model = model; }

  async generateText(messages: AiMessage[], options?: Partial<AiRequestOptions>): Promise<string> {
    const config = normalizeOptions(this.model, options);
    const system = messages.find((message) => message.role === "system")?.content;
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", signal: config.signal,
      headers: { "x-api-key": this.apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model: config.model, max_tokens: config.maxTokens, temperature: config.temperature, system, messages: messages.filter((message) => message.role !== "system") }),
    });
    const data = await readJsonResponse(response, this.name) as { content?: Array<{ type: string; text?: string }> };
    const content = data.content?.find((item) => item.type === "text")?.text;
    if (!content) throw new Error("Anthropic returned an empty response.");
    return content;
  }

  async *streamText(messages: AiMessage[], options?: Partial<AiRequestOptions>): AsyncIterable<string> { yield await this.generateText(messages, options); }
  async generateStructured<T>(messages: AiMessage[], schema: z.ZodType<T>, options?: Partial<AiRequestOptions>): Promise<T> {
    return parseStructured(await this.generateText([{ role: "system", content: "Return only valid JSON." }, ...messages], options), schema, this.name);
  }
}
