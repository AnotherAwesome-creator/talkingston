import { NextResponse } from "next/server";
import { z } from "zod";
import { getChatUser } from "@/lib/chat/server";

const searchSchema = z.object({ q: z.string().trim().min(2).max(100), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(20).default(10) });

export async function GET(request: Request) {
  const parsed = searchSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Search must contain at least two characters." }, { status: 400 });
  const { supabase, user } = await getChatUser(); if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const from = (parsed.data.page - 1) * parsed.data.limit;
  const to = from + parsed.data.limit - 1;
  const pattern = `%${parsed.data.q}%`;
  const [{ data: conversations }, { data: messages }] = await Promise.all([
    supabase.from("conversations").select("id, title, project_id, updated_at").eq("user_id", user.id).ilike("title", pattern).order("updated_at", { ascending: false }).range(from, to),
    supabase.from("messages").select("conversation_id, content, created_at").ilike("content", pattern).order("created_at", { ascending: false }).range(from, to),
  ]);
  const conversationIds = [...new Set((messages ?? []).map((message) => message.conversation_id))];
  const { data: messageConversations } = conversationIds.length
    ? await supabase.from("conversations").select("id, title, project_id, updated_at").eq("user_id", user.id).in("id", conversationIds)
    : { data: [] };
  const results = [...(conversations ?? []), ...(messageConversations ?? [])].filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index).map((conversation) => ({
    ...conversation,
    snippets: (messages ?? []).filter((message) => message.conversation_id === conversation.id).slice(0, 2).map((message) => message.content.slice(0, 180)),
  }));
  return NextResponse.json({ results });
}
