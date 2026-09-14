import { NextResponse } from "next/server";
import { getSocialUser } from "@/lib/social/server";
import { notificationPreferencesSchema, privacySchema } from "@/lib/productivity/state";

export async function GET() {
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [{ data: profile }, { data: preferences }] = await Promise.all([
    supabase.from("profiles").select("profile_visibility").eq("id", user.id).maybeSingle(),
    supabase.from("notification_preferences").select("friend_requests, friend_accepted, group_invites, direct_messages, reminders").eq("user_id", user.id).maybeSingle(),
  ]);
  return NextResponse.json({ profileVisibility: profile?.profile_visibility ?? "public", notificationPreferences: preferences ?? { friend_requests: true, friend_accepted: true, group_invites: true, direct_messages: true, reminders: true } });
}

export async function PATCH(request: Request) {
  const parsed = (await request.json().catch(() => null)) as unknown;
  const privacy = privacySchema.safeParse(parsed);
  const preferences = notificationPreferencesSchema.safeParse(parsed);
  if (!privacy.success && !preferences.success) return NextResponse.json({ error: "Invalid privacy settings." }, { status: 400 });
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (privacy.success) {
    const { error } = await supabase.from("profiles").update({ profile_visibility: privacy.data.profileVisibility, updated_at: new Date().toISOString() }).eq("id", user.id);
    if (error) return NextResponse.json({ error: "Unable to save profile visibility." }, { status: 500 });
  }
  if (preferences.success) {
    const { error } = await supabase.from("notification_preferences").upsert({ user_id: user.id, friend_requests: preferences.data.friendRequests, friend_accepted: preferences.data.friendAccepted, group_invites: preferences.data.groupInvites, direct_messages: preferences.data.directMessages, reminders: preferences.data.reminders, updated_at: new Date().toISOString() });
    if (error) return NextResponse.json({ error: "Unable to save notification preferences." }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
