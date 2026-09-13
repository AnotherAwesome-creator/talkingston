import { NextResponse } from "next/server";
import { z } from "zod";
import { getChatUser } from "@/lib/chat/server";
import { rankMemories } from "@/lib/ai/memory";

const querySchema = z.object({ query: z.string().max(200).optional(), limit: z.coerce.number().int().min(1).max(50).default(20) });

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams); const parsed = querySchema.safeParse(params);
  if (!parsed.success) return NextResponse.json({ error: "Invalid memory query." }, { status: 400 });
  const { supabase, user } = await getChatUser(); if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabase.from("user_memories").select("id, content, category, importance, created_at, updated_at").eq("user_id", user.id).order("importance", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: "Unable to load memories." }, { status: 500 });
  const memories = parsed.data.query ? rankMemories(data ?? [], parsed.data.query).slice(0, parsed.data.limit) : (data ?? []).slice(0, parsed.data.limit);
  return NextResponse.json({ memories });
}
