import { NextResponse } from "next/server";
import { z } from "zod";
import { getChatUser } from "@/lib/chat/server";

const createConversationSchema = z.object({ title: z.string().trim().min(1).max(120).optional() }).strict();

export async function GET() {
  const { supabase, user } = await getChatUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabase.from("conversations").select("id, title, is_pinned, created_at, updated_at").eq("user_id", user.id).order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Unable to load conversations." }, { status: 500 });
  return NextResponse.json({ conversations: data ?? [] });
}

export async function POST(request: Request) {
  const parsed = createConversationSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid conversation details." }, { status: 400 });
  const { supabase, user } = await getChatUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabase.from("conversations").insert({ user_id: user.id, title: parsed.data.title ?? "New conversation", role_mode: "Companion" }).select("id, title, is_pinned, created_at, updated_at").single();
  if (error) return NextResponse.json({ error: "Unable to create conversation." }, { status: 500 });
  return NextResponse.json({ conversation: data }, { status: 201 });
}
