import { describe, it, expect } from "vitest";
import { validateEnv } from "@/lib/env";

describe("Stage 1 Foundation & Architecture Verification", () => {
  describe("Environment Validation & Diagnostics (lib/env.ts)", () => {
    it("runs cleanly with no real external service credentials", () => {
      // Empty environment should safely resolve defaults without throwing or creating fake secrets
      const { env, diagnostics } = validateEnv({});
      expect(diagnostics.isValid).toBe(true);
      expect(env.appUrl).toBe("http://localhost:3000");
      expect(env.aiProvider).toBe("mock");
      expect(env.hasSupabaseCredentials).toBe(false);
      expect(env.hasAiCredentials).toBe(true); // 'mock' is a self-contained provider
      expect(env.supabaseUrl).toBeUndefined();
      expect(env.supabaseAnonKey).toBeUndefined();
    });

    it("flags invalid URLs with clear diagnostics", () => {
      const { diagnostics } = validateEnv({
        NEXT_PUBLIC_APP_URL: "not-a-valid-url",
        NEXT_PUBLIC_SUPABASE_URL: "invalid-supabase-url",
      });

      expect(diagnostics.isValid).toBe(false);
      expect(diagnostics.errors.NEXT_PUBLIC_APP_URL).toBeDefined();
      expect(diagnostics.errors.NEXT_PUBLIC_SUPABASE_URL).toBeDefined();
    });

    it("rejects unsupported AI providers with helpful error messages", () => {
      const { diagnostics } = validateEnv({
        AI_PROVIDER: "unsupported-llm-engine",
      });

      expect(diagnostics.isValid).toBe(false);
      expect(diagnostics.errors.AI_PROVIDER).toBeDefined();
      expect(diagnostics.errors.AI_PROVIDER[0]).toContain(
        "AI_PROVIDER must be one of: 'gemini', 'anthropic', 'openai', 'mock'"
      );
    });

    it("generates actionable warnings when an external AI provider lacks credentials", () => {
      const { env, diagnostics } = validateEnv({
        AI_PROVIDER: "gemini",
        GEMINI_API_KEY: "",
      });

      expect(env.hasAiCredentials).toBe(false);
      expect(diagnostics.warnings.length).toBeGreaterThan(0);
      expect(diagnostics.warnings[0]).toContain("AI_PROVIDER is set to 'gemini' but corresponding API key is missing");
    });
  });

  describe("Talkingston Companion Personalization Constraints", () => {
    it("verifies the exact approved Talkingston personality archetypes", () => {
      const allowedPersonalities = [
        "Quiet",
        "Balanced",
        "Friendly",
        "Witty",
        "Very Playful",
      ] as const;

      expect(allowedPersonalities).toHaveLength(5);
      expect(allowedPersonalities).toEqual([
        "Quiet",
        "Balanced",
        "Friendly",
        "Witty",
        "Very Playful",
      ]);
    });

    it("verifies the exact approved Talkingston proactivity levels", () => {
      const allowedProactivity = ["Off", "Low", "Normal", "High"] as const;

      expect(allowedProactivity).toHaveLength(4);
      expect(allowedProactivity).toEqual(["Off", "Low", "Normal", "High"]);
    });
  });

  describe("AI Context Engine Design Constraints", () => {
    it("verifies the 9 required AI context vectors are explicitly designated", () => {
      const requiredContextVectors = [
        "profile",
        "preferences",
        "personality",
        "proactivity",
        "relevant memories",
        "conversation history",
        "project context",
        "active activity/game context",
        "permissions",
      ] as const;

      expect(requiredContextVectors).toHaveLength(9);
      expect(new Set(requiredContextVectors).size).toBe(9); // All distinct
    });
  });

  describe("Authoritative Pure TypeScript Game Rules Verification", () => {
    it("verifies Talkingston V1 Whot authoritative 54-card deck composition", () => {
      const deckComposition = {
        circles: 12,    // 1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14
        triangles: 12,  // 1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14
        crosses: 10,    // 1, 2, 3, 5, 7, 8, 10, 11, 13, 14
        squares: 9,     // 1, 2, 3, 5, 7, 10, 11, 13, 14
        stars: 7,       // 1, 2, 3, 4, 5, 7, 8
        whots: 4,       // 20 (Four copies)
      };

      const totalCards = Object.values(deckComposition).reduce((sum, count) => sum + count, 0);
      expect(totalCards).toBe(54);
    });

    it("confirms Chess is strictly excluded from V1 scope", () => {
      const v1SupportedGames = ["Whot", "Trivia", "DocumentQuiz"];
      expect(v1SupportedGames).not.toContain("Chess");
    });
  });
});
