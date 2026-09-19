import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export function generateProfileUsername(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16) || "friend";
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${base}${suffix}`.slice(0, 24);
}

export function generateProfileShareCode() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

export async function bootstrapProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: User,
  adminClient = createAdminClient(),
) {
  const { data: existing, error: lookupError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (lookupError) throw new Error(`Unable to load your profile: ${lookupError.message}`);
  if (existing) return;

  const metaName = typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name.trim() : "";
  const fallbackName = user.email?.split("@")[0] ?? "Friend";
  const { error: insertError } = await adminClient.from("profiles").insert({
    id: user.id,
    username: generateProfileUsername(metaName || fallbackName),
    display_name: (metaName || fallbackName).slice(0, 80),
    share_code: generateProfileShareCode(),
  });
  if (insertError && insertError.code !== "23505") {
    throw new Error(`Unable to create your profile: ${insertError.message}`);
  }
}

export async function getCurrentUserWithProfile() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw new Error(`Unable to verify your session: ${error.message}`);
  if (!user) return { supabase, user: null };
  await bootstrapProfile(supabase, user);
  return { supabase, user };
}
