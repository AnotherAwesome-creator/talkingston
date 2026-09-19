import { AnthropicProvider } from "./anthropic";
import { GeminiProvider } from "./gemini";
import { MockProvider } from "./mock";
import { OpenAiProvider } from "./openai";
import type { AiProvider } from "./types";

export function createAiProvider(input: { provider?: string; model?: string; apiKey?: string } = {}): AiProvider {
  const provider = input.provider ?? process.env.AI_PROVIDER ?? "mock";
  const model = input.model;
  if (provider === "mock") {
    if (process.env.NODE_ENV === "production") throw new Error("The mock AI provider is disabled in production.");
    return new MockProvider(model);
  }
  const apiKey = input.apiKey ?? (provider === "gemini" ? process.env.GEMINI_API_KEY : provider === "anthropic" ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY);
  if (!apiKey) throw new Error(`AI provider '${provider}' is configured without its server-side API key.`);
  if (provider === "gemini") return new GeminiProvider(apiKey, model);
  if (provider === "anthropic") return new AnthropicProvider(apiKey, model);
  if (provider === "openai") return new OpenAiProvider(apiKey, model);
  throw new Error(`Unsupported AI provider '${provider}'.`);
}
