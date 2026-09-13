import { NextResponse } from "next/server";
import { z } from "zod";
import { getChatUser } from "@/lib/chat/server";

const updateSchema = z.object({ title: z.string().trim().min(1).max(120).optional(), is_pinned: z.boolean().optional() }).strict();

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const { supabase, user } = await getChatUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: conversation, error } = await supabase.from("conversations").select("id, title, is_pinned, created_at, updated_at").eq("id", id).eq("user_id", user.id).single();
  if (error) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  const { data: messages, error: messagesError } = await supabase.from("messages").select("id, sender, content, created_at").eq("conversation_id", id).order("created_at", { ascending: true });
  if (messagesError) return NextResponse.json({ error: "Unable to load messages." }, { status: 500 });
  return NextResponse.json({ conversation, messages: messages ?? [] });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = updateSchema.safeParse(await request.json()); const { id } = await params;
  if (!parsed.success) return NextResponse.json({ error: "Invalid conversation update." }, { status: 400 });
  const { supabase, user } = await getChatUser(); if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabase.from("conversations").update(parsed.data).eq("id", id).eq("user_id", user.id).select("id, title, is_pinned, created_at, updated_at").single();
  if (error) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  return NextResponse.json({ conversation: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const { supabase, user } = await getChatUser(); if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { error } = await supabase.from("conversations").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Unable to delete conversation." }, { status: 500 });
  return NextResponse.json({ success: true });
}
