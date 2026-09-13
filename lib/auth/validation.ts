import { z } from "zod";

export const personalityValues = ["Quiet", "Balanced", "Friendly", "Witty", "Very Playful"] as const;
export const proactivityValues = ["Off", "Low", "Normal", "High"] as const;
export const interestValues = ["art", "food", "movies", "career", "entertainment", "technology"] as const;

export const onboardingSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/, "Use 3-24 letters, numbers, or underscores."),
  interests: z.array(z.enum(interestValues)).min(1).max(6),
  personality: z.enum(personalityValues),
  proactivity: z.enum(proactivityValues),
});

export const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/, "Use 3-24 letters, numbers, or underscores."),
  avatarUrl: z.string().url().or(z.literal("")),
});

export const settingsSchema = z.object({
  personality: z.enum(personalityValues),
  proactivity: z.enum(proactivityValues),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
