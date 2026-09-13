import { z } from "zod";

export const memoryCandidateSchema = z.object({
  content: z.string().trim().min(8).max(500),
  category: z.enum(["preference", "fact", "goal", "relationship"]),
  importance: z.number().int().min(1).max(5),
});

export type MemoryCandidate = z.infer<typeof memoryCandidateSchema>;

const patterns: Array<{ category: MemoryCandidate["category"]; regex: RegExp; importance: number }> = [
  { category: "preference", regex: /\b(?:i like|i love|i prefer|my favorite is)\s+(.{3,160})/i, importance: 3 },
  { category: "goal", regex: /\b(?:i want to|i'm trying to|my goal is to|i plan to)\s+(.{3,160})/i, importance: 4 },
  { category: "fact", regex: /\b(?:i am|i'm|i work as|i study)\s+(.{3,160})/i, importance: 3 },
];

export function extractMemoryCandidates(message: string): MemoryCandidate[] {
  if (message.length > 4000) return [];
  return patterns.flatMap(({ category, regex, importance }) => {
    const match = message.match(regex);
    if (!match?.[1]) return [];
    const content = match[0].trim().replace(/[.!?]+$/, "");
    const parsed = memoryCandidateSchema.safeParse({ content, category, importance });
    return parsed.success ? [parsed.data] : [];
  });
}

export function rankMemories<T extends { content: string; importance: number }>(memories: T[], query: string): T[] {
  const terms = query.toLowerCase().split(/\W+/).filter(Boolean);
  return memories.map((memory, index) => ({ memory, score: terms.filter((term) => memory.content.toLowerCase().includes(term)).length * 10 + memory.importance - index / 100 }))
    .sort((a, b) => b.score - a.score).map(({ memory }) => memory);
}
