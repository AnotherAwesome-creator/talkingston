import type { AiMessage, AiProvider, AiRequestOptions } from "@/lib/ai/providers";

export type AiTask = "companion_chat" | "memory_extraction" | "structured_generation" | "quiz_generation" | "game_commentary" | "test";

export interface RouterRequest {
  task: AiTask;
  messages: AiMessage[];
  options?: Partial<AiRequestOptions>;
}

export interface ProviderHealthSnapshot {
  provider: string;
  lastSuccessAt: number | null;
  consecutiveFailures: number;
  cooldownUntil: number | null;
  unavailable: boolean;
}

export interface RoutedTextResponse {
  provider: string;
  text: string;
}

export interface ProviderResolver {
  resolve(providerName: string, task: AiTask): AiProvider | null;
}
