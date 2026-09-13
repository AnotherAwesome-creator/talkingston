import { AiProviderError, createAiProvider, type AiProvider } from "@/lib/ai/providers";
import { getProviderHealth, providerAvailable, recordProviderFailure, recordProviderSuccess } from "./health";
import type { AiTask, ProviderResolver, RoutedTextResponse, RouterRequest } from "./types";

const defaultOrder = ["gemini", "anthropic", "openai", "mock"];

function configuredOrder() {
  const configured = process.env.AI_PROVIDER_ORDER?.split(",").map((item) => item.trim()).filter(Boolean);
  return configured?.length ? configured : defaultOrder;
}

export class AiProviderRouter implements ProviderResolver {
  constructor(private readonly resolver: (provider: string, task: AiTask) => AiProvider | null = (provider) => {
    try { return createAiProvider({ provider }); } catch { return null; }
  }) {}

  resolve(providerName: string, _task: AiTask) {
    return this.resolver(providerName, _task);
  }

  candidates(task: AiTask) {
    return configuredOrder().map((provider) => ({ provider, instance: this.resolve(provider, task) }))
      .filter((entry): entry is { provider: string; instance: AiProvider } => Boolean(entry.instance))
      .filter((entry) => providerAvailable(entry.provider));
  }

  async generateText(request: RouterRequest): Promise<RoutedTextResponse> {
    for (const candidate of this.candidates(request.task)) {
      try {
        const text = await candidate.instance.generateText(request.messages, request.options);
        recordProviderSuccess(candidate.provider);
        return { provider: candidate.provider, text };
      } catch (error) {
        const retryable = error instanceof AiProviderError ? error.retryable : false;
        recordProviderFailure(candidate.provider, retryable);
        if (!retryable) break;
      }
    }
    throw new AiProviderError("All configured AI providers are currently unavailable.", "router", undefined, "unavailable");
  }

  async *streamText(request: RouterRequest): AsyncIterable<{ provider: string; chunk: string }> {
    let lastError: unknown;
    for (const candidate of this.candidates(request.task)) {
      try {
        for await (const chunk of candidate.instance.streamText(request.messages, request.options)) {
          recordProviderSuccess(candidate.provider);
          yield { provider: candidate.provider, chunk };
        }
        return;
      } catch (error) {
        lastError = error;
        const retryable = error instanceof AiProviderError ? error.retryable : false;
        recordProviderFailure(candidate.provider, retryable);
        if (!retryable) break;
      }
    }
    throw lastError instanceof Error ? lastError : new AiProviderError("All configured AI providers are currently unavailable.", "router", undefined, "unavailable");
  }

  health() { return getProviderHealth(); }
}

export const aiProviderRouter = new AiProviderRouter();
export * from "./types";
export * from "./health";
