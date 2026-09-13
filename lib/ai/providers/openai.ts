import type { z } from "zod";
import { normalizeOptions, parseStructured, readJsonResponse } from "./shared";
import type { AiMessage, AiProvider, AiRequestOptions } from "./types";

export class OpenAiProvider implements AiProvider {
  readonly name = "openai";
  readonly model: string;
  constructor(private readonly apiKey: string, model = "gpt-4o-mini") { this.model = model; }

  async generateText(messages: AiMessage[], options?: Partial<AiRequestOptions>): Promise<string> {
    const config = normalizeOptions(this.model, options);
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", signal: config.signal, headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: config.model, messages, temperature: config.temperature, max_tokens: config.maxTokens }),
    });
    const data = await readJsonResponse(response, this.name) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI returned an empty response.");
    return content;
  }

  async *streamText(messages: AiMessage[], options?: Partial<AiRequestOptions>): AsyncIterable<string> {
    yield await this.generateText(messages, options);
  }

  async generateStructured<T>(messages: AiMessage[], schema: z.ZodType<T>, options?: Partial<AiRequestOptions>): Promise<T> {
    const instruction: AiMessage = { role: "system", content: "Return only valid JSON matching the requested schema." };
    return parseStructured(await this.generateText([instruction, ...messages], options), schema, this.name);
  }
}
