import { NextResponse } from "next/server";
import { z } from "zod";
import { getChatUser } from "@/lib/chat/server";

const createConversationSchema = z.object({ title: z.string().trim().min(1).max(120).optional(), project_id: z.string().uuid().nullable().optional() }).strict();

export async function GET(request: Request) {
  const params = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(20) }).parse(Object.fromEntries(new URL(request.url).searchParams));
  const { supabase, user } = await getChatUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const from = (params.page - 1) * params.limit;
  const { data, error } = await supabase.from("conversations").select("id, title, project_id, is_pinned, is_archived, created_at, updated_at, messages(count)").eq("user_id", user.id).eq("is_archived", false).order("updated_at", { ascending: false }).range(from, from + params.limit - 1);
  if (error) return NextResponse.json({ error: "Unable to load conversations." }, { status: 500 });
  return NextResponse.json({ conversations: data ?? [] });
}

export async function POST(request: Request) {
  const parsed = createConversationSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid conversation details." }, { status: 400 });
  const { supabase, user } = await getChatUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (parsed.data.project_id) {
    const { data: project } = await supabase.from("projects").select("id").eq("id", parsed.data.project_id).eq("user_id", user.id).maybeSingle();
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  const { data, error } = await supabase.from("conversations").insert({ user_id: user.id, title: parsed.data.title ?? "New conversation", role_mode: "Companion", project_id: parsed.data.project_id ?? null }).select("id, title, project_id, is_pinned, is_archived, created_at, updated_at").single();
  if (error) return NextResponse.json({ error: "Unable to create conversation." }, { status: 500 });
  return NextResponse.json({ conversation: data }, { status: 201 });
}
