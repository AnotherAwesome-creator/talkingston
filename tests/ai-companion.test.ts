import { describe, expect, it } from "vitest";
import { MockProvider } from "@/lib/ai/providers";
import { assembleContext, contextVectorNames, hasCompleteContextVectors } from "@/lib/ai/context";
import { extractMemoryCandidates, rankMemories } from "@/lib/ai/memory";
import { AiProviderError, type AiProvider } from "@/lib/ai/providers";
import { AiProviderRouter, resetProviderHealth } from "@/lib/ai/router";
import { z } from "zod";

describe("AI provider abstraction", () => {
  it("provides deterministic mock text and validated structured output", async () => {
    const provider = new MockProvider();
    await expect(provider.generateText([{ role: "user", content: "I like tea." }])).resolves.toContain("I hear you");
    await expect(provider.generateStructured([{ role: "user", content: "hello" }], z.object({ content: z.string() }))).resolves.toHaveProperty("content");
  });
});

describe("nine-vector context engine", () => {
  const input = {
    profile: { displayName: "Ada", username: "ada", interests: ["technology"] },
    preferences: { readingLevel: "clear" },
    personality: "Balanced" as const,
    proactivity: "Off" as const,
    relevantMemories: [{ content: "I like tea", category: "preference", importance: 3 }],
    conversationHistory: [{ role: "user" as const, content: "Earlier" }],
    projectContext: null,
    activeActivityGameContext: null,
    permissions: { canReadMemories: true, canWriteMemories: true, canUseTools: false },
  };
  it("assembles exactly the required vectors and trims history", () => {
    const context = assembleContext(input, "Latest", 500);
    expect(Object.keys(context.vectors)).toEqual(contextVectorNames);
    expect(hasCompleteContextVectors(context)).toBe(true);
    expect(context.messages.at(-1)?.content).toBe("Latest");
    expect(context.estimatedCharacters).toBeLessThan(12000);
  });
});

describe("memory extraction and fallback retrieval", () => {
  it("extracts useful explicit facts but ignores ordinary messages", () => {
    expect(extractMemoryCandidates("I like quiet mornings.")).toHaveLength(1);
    expect(extractMemoryCandidates("Hello there.")).toHaveLength(0);
  });
  it("ranks keyword matches before unrelated memories", () => {
    const memories = [{ content: "I like tea", importance: 2 }, { content: "I work in design", importance: 4 }];
    expect(rankMemories(memories, "tea")[0].content).toBe("I like tea");
  });
});

function fakeProvider(name: string, action: () => Promise<string>): AiProvider {
  return {
    name,
    model: "test",
    generateText: action,
    async *streamText() { yield await action(); },
    async generateStructured() { throw new Error("not used"); },
  };
}

describe("provider routing and health", () => {
  it("falls back after a rate limit and records the failure", async () => {
    resetProviderHealth();
    const router = new AiProviderRouter((name) => name === "gemini"
      ? fakeProvider(name, async () => { throw new AiProviderError("limited", name, 429, "rate_limit"); })
      : name === "anthropic" ? fakeProvider(name, async () => "fallback") : null);
    await expect(router.generateText({ task: "companion_chat", messages: [] })).resolves.toEqual({ provider: "anthropic", text: "fallback" });
    expect(router.health().find((item) => item.provider === "gemini")?.consecutiveFailures).toBe(1);
  });

  it("does not continue past a non-retryable provider error", async () => {
    resetProviderHealth();
    const router = new AiProviderRouter((name) => name === "gemini"
      ? fakeProvider(name, async () => { throw new AiProviderError("bad request", name, 400, "invalid_request"); })
      : fakeProvider(name, async () => "should not run"));
    await expect(router.generateText({ task: "structured_generation", messages: [] })).rejects.toThrow("All configured");
  });

  it("keeps project context isolated to the active project", () => {
    const context = assembleContext({
      profile: {}, preferences: {}, personality: "Balanced", proactivity: "Normal",
      relevantMemories: [], conversationHistory: [], projectContext: { id: "project-a", name: "A" },
      activeActivityGameContext: null, permissions: { canReadMemories: true, canWriteMemories: true, canUseTools: false },
    }, "Hello");
    expect(context.vectors.projectContext).toEqual({ id: "project-a", name: "A" });
    expect(JSON.stringify(context.messages)).not.toContain("project-b");
  });
});
