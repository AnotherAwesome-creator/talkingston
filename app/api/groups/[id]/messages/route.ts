import { NextResponse } from "next/server";
import { z } from "zod";
import { getProfileMap, getSocialUser, isGroupMember } from "@/lib/social/server";

const messageSchema = z.object({ content: z.string().trim().min(1).max(4000) }).strict();
const querySchema = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(30) });

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams)); const { id } = await params;
  if (!query.success) return NextResponse.json({ error: "Invalid message query." }, { status: 400 });
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isGroupMember(supabase, id, user.id))) return NextResponse.json({ error: "Group not found." }, { status: 404 });
  const from = (query.data.page - 1) * query.data.limit;
  const { data, error } = await supabase.from("group_messages").select("id, group_id, sender_id, content, created_at").eq("group_id", id).order("created_at", { ascending: false }).range(from, from + query.data.limit - 1);
  if (error) return NextResponse.json({ error: "Unable to load group messages." }, { status: 500 });
  const messages = (data ?? []).reverse();
  const profiles = await getProfileMap(supabase, messages.map((message) => message.sender_id));
  return NextResponse.json({ messages: messages.map((message) => ({ ...message, profile: profiles.get(message.sender_id) ?? null })), page: query.data.page, limit: query.data.limit });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = messageSchema.safeParse(await request.json()); const { id } = await params;
  if (!parsed.success) return NextResponse.json({ error: "Invalid group message." }, { status: 400 });
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isGroupMember(supabase, id, user.id))) return NextResponse.json({ error: "Group not found." }, { status: 404 });
  const { data, error } = await supabase.from("group_messages").insert({ group_id: id, sender_id: user.id, content: parsed.data.content }).select("id, group_id, sender_id, content, created_at").single();
  if (error) return NextResponse.json({ error: "Unable to send group message." }, { status: 500 });
  const profiles = await getProfileMap(supabase, [user.id]);
  return NextResponse.json({ message: { ...data, profile: profiles.get(user.id) ?? null } }, { status: 201 });
}
