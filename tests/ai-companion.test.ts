import { describe, expect, it } from "vitest";
import { MockProvider } from "@/lib/ai/providers";
import { assembleContext, contextVectorNames, hasCompleteContextVectors } from "@/lib/ai/context";
import { extractMemoryCandidates, rankMemories } from "@/lib/ai/memory";
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
