import { NextResponse } from "next/server";
import { z } from "zod";
import { getChatUser } from "@/lib/chat/server";

const projectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).nullable().optional(),
  color_code: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
}).strict();

export async function GET() {
  const { supabase, user } = await getChatUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabase.from("projects").select("id, name, description, color_code, is_archived, created_at, updated_at").eq("user_id", user.id).order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Unable to load projects." }, { status: 500 });
  return NextResponse.json({ projects: data ?? [] });
}

export async function POST(request: Request) {
  const parsed = projectSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid project details." }, { status: 400 });
  const { supabase, user } = await getChatUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabase.from("projects").insert({ user_id: user.id, ...parsed.data }).select("id, name, description, color_code, is_archived, created_at, updated_at").single();
  if (error) return NextResponse.json({ error: "Unable to create project." }, { status: 500 });
  return NextResponse.json({ project: data }, { status: 201 });
}
