import type { z } from "zod";

export type AiRole = "system" | "user" | "assistant";

export interface AiMessage {
  role: AiRole;
  content: string;
}

export interface AiModelConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AiRequestOptions extends AiModelConfig {
  signal?: AbortSignal;
}

export class AiProviderError extends Error {
  constructor(message: string, public readonly provider: string, public readonly status?: number) {
    super(message);
    this.name = "AiProviderError";
  }
}

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  generateText(messages: AiMessage[], options?: Partial<AiRequestOptions>): Promise<string>;
  streamText(messages: AiMessage[], options?: Partial<AiRequestOptions>): AsyncIterable<string>;
  generateStructured<T>(messages: AiMessage[], schema: z.ZodType<T>, options?: Partial<AiRequestOptions>): Promise<T>;
}
