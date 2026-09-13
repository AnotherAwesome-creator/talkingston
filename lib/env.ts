import { z } from "zod";

/**
 * Talkingston V1 — Environment Variable Validation & Diagnostics
 *
 * Rules:
 * - Does NOT require real Supabase or AI credentials for local development or automated tests.
 * - Validates variables when present and provides clear diagnostics for malformed values.
 * - Tests and local dev run out-of-the-box with no external service credentials.
 * - Never fabricates fake production secrets.
 */

export const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url("NEXT_PUBLIC_APP_URL must be a valid URL (e.g. http://localhost:3000)")
    .default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL")
    .optional()
    .or(z.literal("")),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional().or(z.literal("")),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().or(z.literal("")),
  AI_PROVIDER: z
    .enum(["gemini", "anthropic", "openai", "mock"], {
      errorMap: () => ({
        message: "AI_PROVIDER must be one of: 'gemini', 'anthropic', 'openai', 'mock'",
      }),
    })
    .default("mock"),
  GEMINI_API_KEY: z.string().optional().or(z.literal("")),
  ANTHROPIC_API_KEY: z.string().optional().or(z.literal("")),
  OPENAI_API_KEY: z.string().optional().or(z.literal("")),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type RawEnv = z.infer<typeof envSchema>;

export interface ValidationDiagnostic {
  isValid: boolean;
  errors: Record<string, string[]>;
  warnings: string[];
}

export interface AppEnv {
  appUrl: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseServiceRoleKey?: string;
  aiProvider: "gemini" | "anthropic" | "openai" | "mock";
  geminiApiKey?: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  isProduction: boolean;
  isTest: boolean;
  hasSupabaseCredentials: boolean;
  hasAiCredentials: boolean;
}

/**
 * Validates environment configuration and produces actionable diagnostics
 * without throwing exceptions that block test execution or local startup.
 */
export function validateEnv(
  rawInput: Record<string, string | undefined> = process.env
): { env: AppEnv; diagnostics: ValidationDiagnostic } {
  const result = envSchema.safeParse(rawInput);

  const errors: Record<string, string[]> = {};
  const warnings: string[] = [];

  if (!result.success) {
    const formatted = result.error.format();
    for (const [key, value] of Object.entries(formatted)) {
      if (key !== "_errors" && value && "_errors" in value) {
        errors[key] = (value as { _errors: string[] })._errors;
      }
    }
  }

  const parsed = result.success ? result.data : envSchema.parse({});

  const hasSupabaseCredentials = Boolean(
    parsed.NEXT_PUBLIC_SUPABASE_URL && parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const hasAiCredentials = Boolean(
    (parsed.AI_PROVIDER === "gemini" && parsed.GEMINI_API_KEY) ||
    (parsed.AI_PROVIDER === "anthropic" && parsed.ANTHROPIC_API_KEY) ||
    (parsed.AI_PROVIDER === "openai" && parsed.OPENAI_API_KEY) ||
    parsed.AI_PROVIDER === "mock"
  );

  if (parsed.NODE_ENV === "production" && !hasSupabaseCredentials) {
    warnings.push("Production deployment requires valid NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  if (parsed.AI_PROVIDER !== "mock" && !hasAiCredentials) {
    warnings.push(`AI_PROVIDER is set to '${parsed.AI_PROVIDER}' but corresponding API key is missing. Using mock fallback.`);
  }

  const appEnv: AppEnv = {
    appUrl: parsed.NEXT_PUBLIC_APP_URL,
    supabaseUrl: parsed.NEXT_PUBLIC_SUPABASE_URL || undefined,
    supabaseAnonKey: parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY || undefined,
    supabaseServiceRoleKey: parsed.SUPABASE_SERVICE_ROLE_KEY || undefined,
    aiProvider: parsed.AI_PROVIDER,
    geminiApiKey: parsed.GEMINI_API_KEY || undefined,
    anthropicApiKey: parsed.ANTHROPIC_API_KEY || undefined,
    openaiApiKey: parsed.OPENAI_API_KEY || undefined,
    isProduction: parsed.NODE_ENV === "production",
    isTest: parsed.NODE_ENV === "test",
    hasSupabaseCredentials,
    hasAiCredentials,
  };

  return {
    env: appEnv,
    diagnostics: {
      isValid: result.success,
      errors,
      warnings,
    },
  };
}

export const { env, diagnostics: envDiagnostics } = validateEnv();
