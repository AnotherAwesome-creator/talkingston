import type { AiMessage } from "@/lib/ai/providers";

export const contextVectorNames = [
  "profile",
  "preferences",
  "personality",
  "proactivity",
  "relevantMemories",
  "conversationHistory",
  "projectContext",
  "activeActivityGameContext",
  "permissions",
] as const;

export type ContextVectorName = (typeof contextVectorNames)[number];
export type Personality = "Quiet" | "Balanced" | "Friendly" | "Witty" | "Very Playful";
export type Proactivity = "Off" | "Low" | "Normal" | "High";

export interface ContextInput {
  profile: { displayName?: string; username?: string; interests?: string[] };
  preferences: Record<string, string | number | boolean>;
  personality: Personality;
  proactivity: Proactivity;
  relevantMemories: Array<{ content: string; category: string; importance: number }>;
  conversationHistory: AiMessage[];
  projectContext: Record<string, unknown> | null;
  activeActivityGameContext: Record<string, unknown> | null;
  permissions: { canReadMemories: boolean; canWriteMemories: boolean; canUseTools: boolean };
}

export interface AssembledContext {
  vectors: Record<ContextVectorName, unknown>;
  systemPrompt: string;
  messages: AiMessage[];
  estimatedCharacters: number;
}
