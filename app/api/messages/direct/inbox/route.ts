import { NextResponse } from "next/server";
import { getProfileMap, getSocialUser } from "@/lib/social/server";

export async function GET() {
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabase.from("direct_messages").select("id, sender_id, recipient_id, content, is_read, created_at")
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`).order("created_at", { ascending: false }).limit(200);
  if (error) return NextResponse.json({ error: "Unable to load direct message inbox." }, { status: 500 });
  const rows = data ?? [];
  const partnerIds = rows.map((message) => message.sender_id === user.id ? message.recipient_id : message.sender_id);
  const profiles = await getProfileMap(supabase, partnerIds);
  const conversations = new Map<string, { partner: Record<string, unknown>; lastMessage: typeof rows[number]; unreadCount: number }>();
  for (const message of rows) {
    const partnerId = message.sender_id === user.id ? message.recipient_id : message.sender_id;
    const existing = conversations.get(partnerId);
    if (existing) {
      if (message.recipient_id === user.id && !message.is_read) existing.unreadCount += 1;
      continue;
    }
    conversations.set(partnerId, {
      partner: profiles.get(partnerId) ?? {},
      lastMessage: message,
      unreadCount: message.recipient_id === user.id && !message.is_read ? 1 : 0,
    });
  }
  return NextResponse.json({ conversations: [...conversations.entries()].map(([userId, value]) => ({ userId, ...value })) });
}
