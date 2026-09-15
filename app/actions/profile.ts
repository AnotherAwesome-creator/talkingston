"use server";

import { revalidatePath } from "next/cache";
import { onboardingSchema, profileSchema, settingsSchema, type OnboardingInput } from "@/lib/auth/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isMissingAuthSession } from "@/lib/social/server";
import { profileVisibilityValues } from "@/lib/productivity/state";

async function profileExists(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data, error } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (error) throw new Error(`Unable to load your profile: ${error.message}`);
  return Boolean(data);
}

export async function saveOnboarding(input: OnboardingInput) {
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Please check the highlighted details and try again." };

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw new Error(`Unable to verify your session: ${userError.message}`);
  if (!user) return { ok: false as const, error: "Your session has expired. Please sign in again." };

  const profileValues = {
    id: user.id,
    username: parsed.data.username,
    display_name: parsed.data.displayName,
    interests: parsed.data.interests,
    onboarding_completed: true,
    updated_at: new Date().toISOString(),
  };
  const profileQuery = profileExists(supabase, user.id)
    .then((exists) => exists
      ? supabase.from("profiles").update(profileValues).eq("id", user.id)
      : createAdminClient().from("profiles").insert(profileValues));
  const { error: profileError } = await profileQuery;
  if (profileError) return { ok: false as const, error: profileError.message };

  const { error: settingsError } = await supabase.from("companion_settings").upsert({
    user_id: user.id,
    personality: parsed.data.personality,
    proactivity: parsed.data.proactivity,
    updated_at: new Date().toISOString(),
  });
  if (settingsError) return { ok: false as const, error: settingsError.message };

  revalidatePath("/home");
  revalidatePath("/settings");
  return { ok: true as const };
}

async function getAuthenticatedClient() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error && !isMissingAuthSession(error)) throw new Error(`Unable to verify your session: ${error.message}`);
  if (!user) return { supabase, user: null };
  return { supabase, user };
}

export async function saveProfile(input: { displayName: string; username: string; avatarUrl: string; bio: string; profileVisibility?: string }) {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Please provide a valid name, username, and avatar URL." };
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { ok: false as const, error: "Your session has expired. Please sign in again." };
  const profileValues = {
    id: user.id,
    display_name: parsed.data.displayName,
    username: parsed.data.username,
    avatar_url: parsed.data.avatarUrl || null,
    bio: parsed.data.bio || null,
    updated_at: new Date().toISOString(),
  };
  const profileQuery = profileExists(supabase, user.id)
    .then((exists) => exists
      ? supabase.from("profiles").update(profileValues).eq("id", user.id).select("id, display_name").single()
      : createAdminClient().from("profiles").insert(profileValues).select("id, display_name").single());
  const { data: savedProfile, error } = await profileQuery;
  if (error) {
    if (
      error.code === "23505"
      && [error.message, error.details, error.hint].some((value) => value?.toLowerCase().includes("username"))
    ) {
      return { ok: false as const, error: "That username is already taken." };
    }
    return { ok: false as const, error: error.message };
  }
  if (!savedProfile) return { ok: false as const, error: "Your profile could not be saved. Please try again." };
  revalidatePath("/settings/profile");
  revalidatePath("/home");
  return { ok: true as const };
}

export async function savePrivacySettings(input: { profileVisibility: string }) {
  if (!profileVisibilityValues.includes(input.profileVisibility as typeof profileVisibilityValues[number])) {
    return { ok: false as const, error: "Choose a valid profile visibility setting." };
  }
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { ok: false as const, error: "Your session has expired. Please sign in again." };
  const { error } = await supabase.from("profiles").update({ profile_visibility: input.profileVisibility, updated_at: new Date().toISOString() }).eq("id", user.id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/settings/profile");
  return { ok: true as const };
}

export async function saveCompanionSettings(input: { personality: string; proactivity: string }) {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Choose a valid personality and proactivity level." };
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { ok: false as const, error: "Your session has expired. Please sign in again." };
  const { error } = await supabase.from("companion_settings").upsert({
    user_id: user.id,
    personality: parsed.data.personality,
    proactivity: parsed.data.proactivity,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/settings");
  return { ok: true as const };
}
