import { NextResponse } from "next/server";
import { z } from "zod";
import { areBlocked, getProfileMap, getSocialUser } from "@/lib/social/server";

const messageSchema = z.object({ recipientId: z.string().uuid(), content: z.string().trim().min(1).max(4000) }).strict();
const querySchema = z.object({ userId: z.string().uuid(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(30) });

async function verifyRecipient(supabase: Awaited<ReturnType<typeof getSocialUser>>["supabase"], userId: string, recipientId: string) {
  const { data } = await supabase.from("profiles").select("id").eq("id", recipientId).maybeSingle();
  if (!data) return false;
  return !(await areBlocked(supabase, userId, recipientId));
}

export async function GET(request: Request) {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid direct message query." }, { status: 400 });
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId, page, limit } = parsed.data;
  if (userId === user.id || !(await verifyRecipient(supabase, user.id, userId))) return NextResponse.json({ error: "User is unavailable." }, { status: 404 });
  const from = (page - 1) * limit;
  const { data, error } = await supabase.from("direct_messages").select("id, sender_id, recipient_id, content, is_read, created_at")
    .or(`and(sender_id.eq.${user.id},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${user.id})`)
    .order("created_at", { ascending: false }).range(from, from + limit - 1);
  if (error) return NextResponse.json({ error: "Unable to load messages." }, { status: 500 });
  await supabase.from("direct_messages").update({ is_read: true }).eq("sender_id", userId).eq("recipient_id", user.id).eq("is_read", false);
  const profiles = await getProfileMap(supabase, [user.id, userId]);
  return NextResponse.json({ messages: (data ?? []).reverse(), recipient: profiles.get(userId) ?? null, page, limit });
}

export async function POST(request: Request) {
  const parsed = messageSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid message." }, { status: 400 });
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (parsed.data.recipientId === user.id || !(await verifyRecipient(supabase, user.id, parsed.data.recipientId))) return NextResponse.json({ error: "Recipient is unavailable." }, { status: 403 });
  const { data, error } = await supabase.from("direct_messages").insert({ sender_id: user.id, recipient_id: parsed.data.recipientId, content: parsed.data.content, is_read: false }).select("id, sender_id, recipient_id, content, is_read, created_at").single();
  if (error) return NextResponse.json({ error: "Unable to send message." }, { status: 500 });
  return NextResponse.json({ message: data }, { status: 201 });
}
