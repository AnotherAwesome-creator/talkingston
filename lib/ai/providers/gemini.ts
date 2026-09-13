import type { z } from "zod";
import { normalizeOptions, parseStructured, readJsonResponse } from "./shared";
import type { AiMessage, AiProvider, AiRequestOptions } from "./types";

export class GeminiProvider implements AiProvider {
  readonly name = "gemini";
  readonly model: string;
  constructor(private readonly apiKey: string, model = "gemini-2.0-flash") { this.model = model; }

  async generateText(messages: AiMessage[], options?: Partial<AiRequestOptions>): Promise<string> {
    const config = normalizeOptions(this.model, options);
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`, {
      method: "POST", signal: config.signal, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: messages.filter((message) => message.role !== "system").map((message) => ({ role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content }] })), systemInstruction: messages.find((message) => message.role === "system") ? { parts: [{ text: messages.find((message) => message.role === "system")?.content }] } : undefined, generationConfig: { temperature: config.temperature, maxOutputTokens: config.maxTokens } }),
    });
    const data = await readJsonResponse(response, this.name) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const content = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("");
    if (!content) throw new Error("Gemini returned an empty response.");
    return content;
  }

  async *streamText(messages: AiMessage[], options?: Partial<AiRequestOptions>): AsyncIterable<string> { yield await this.generateText(messages, options); }
  async generateStructured<T>(messages: AiMessage[], schema: z.ZodType<T>, options?: Partial<AiRequestOptions>): Promise<T> {
    return parseStructured(await this.generateText([{ role: "system", content: "Return only valid JSON." }, ...messages], options), schema, this.name);
  }
}
