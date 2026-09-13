import type { z } from "zod";
import { AiProviderError, type AiMessage, type AiRequestOptions } from "./types";

export async function readJsonResponse(response: Response, provider: string): Promise<unknown> {
  if (!response.ok) {
    const detail = await response.text();
    const kind = response.status === 401 || response.status === 403
      ? "authentication"
      : response.status === 429
        ? "rate_limit"
        : response.status >= 500
          ? "unavailable"
          : "invalid_request";
    throw new AiProviderError(`${provider} request failed: ${detail.slice(0, 500)}`, provider, response.status, kind);
  }
  try {
    return await response.json();
  } catch {
    throw new AiProviderError(`${provider} returned malformed JSON.`, provider, response.status);
  }
}

export function parseStructured<T>(text: string, schema: z.ZodType<T>, provider: string): T {
  const jsonText = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/)?.[0];
  if (!jsonText) throw new AiProviderError(`${provider} returned no structured JSON.`, provider);
  let value: unknown;
  try {
    value = JSON.parse(jsonText);
  } catch {
    throw new AiProviderError(`${provider} returned invalid structured JSON.`, provider);
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new AiProviderError(`${provider} returned data that failed validation.`, provider);
  return parsed.data;
}

export function normalizeOptions(defaultModel: string, options?: Partial<AiRequestOptions>): AiRequestOptions {
  return {
    model: options?.model ?? defaultModel,
    temperature: options?.temperature ?? 0.7,
    maxTokens: options?.maxTokens ?? 800,
    signal: options?.signal,
  };
}

export async function* singleChunk(text: string): AsyncIterable<string> {
  yield text;
}

export function messagesToPrompt(messages: AiMessage[]): string {
  return messages.map((message) => `${message.role.toUpperCase()}: ${message.content}`).join("\n\n");
}
