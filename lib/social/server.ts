import { createClient } from "@/lib/supabase/server";

export const publicProfileFields = "id, username, display_name, avatar_url, bio";
export const publicProfileRelation = "public_profiles";

export function isMissingAuthSession(error: { name?: string } | null) {
  return error?.name === "AuthSessionMissingError";
}

export async function getSocialUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error && !isMissingAuthSession(error)) throw new Error(`Unable to verify your session: ${error.message}`);
  return { supabase, user };
}

export async function getProfileMap(supabase: Awaited<ReturnType<typeof createClient>>, ids: string[]) {
  if (ids.length === 0) return new Map<string, Record<string, unknown>>();
  const { data } = await supabase.from(publicProfileRelation).select(publicProfileFields).in("id", [...new Set(ids)]);
  return new Map((data ?? []).map((profile) => [profile.id as string, profile]));
}

export function orderedPair(first: string, second: string) {
  return [first, second].sort().join(":");
}

export async function areBlocked(
  supabase: Awaited<ReturnType<typeof createClient>>,
  first: string,
  second: string,
) {
  const { data } = await supabase
    .from("friendships")
    .select("id")
    .or(`and(user_id.eq.${first},friend_id.eq.${second},status.eq.blocked),and(user_id.eq.${second},friend_id.eq.${first},status.eq.blocked)`)
    .limit(1);
  return Boolean(data?.length);
}

export async function isGroupMember(
  supabase: Awaited<ReturnType<typeof createClient>>,
  groupId: string,
  userId: string,
) {
  const { data } = await supabase.from("group_members").select("role").eq("group_id", groupId).eq("user_id", userId).maybeSingle();
  return data;
}
