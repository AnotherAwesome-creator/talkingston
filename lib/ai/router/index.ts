import { AiProviderError, createAiProvider, type AiProvider } from "@/lib/ai/providers";
import { getProviderHealth, providerAvailable, recordProviderFailure, recordProviderSuccess } from "./health";
import type { AiTask, ProviderResolver, RoutedTextResponse, RouterRequest } from "./types";
import type { z } from "zod";

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
    if (process.env.NODE_ENV === "production") {
      const configuredProvider = process.env.AI_PROVIDER;
      if (!configuredProvider || configuredProvider === "mock") {
        throw new AiProviderError("Production AI requires an explicitly configured real provider.", "router", undefined, "invalid_request");
      }
      const instance = this.resolve(configuredProvider, task);
      if (!instance) {
        throw new AiProviderError(`AI provider '${configuredProvider}' is missing its server-side API key or is unsupported.`, configuredProvider, undefined, "authentication");
      }
      return [{ provider: configuredProvider, instance }];
    }
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

  async generateStructured<T>(request: RouterRequest, schema: z.ZodType<T>): Promise<{ provider: string; value: T }> {
    for (const candidate of this.candidates(request.task)) {
      try {
        const value = await candidate.instance.generateStructured(request.messages, schema, request.options);
        recordProviderSuccess(candidate.provider);
        return { provider: candidate.provider, value };
      } catch (error) {
        console.error("[ai] structured provider failed", {
          provider: candidate.provider,
          task: request.task,
          message: error instanceof Error ? error.message : "Unknown provider error",
        });
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
