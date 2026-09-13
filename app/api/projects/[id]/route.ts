import { NextResponse } from "next/server";
import { z } from "zod";
import { getChatUser } from "@/lib/chat/server";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  color_code: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  is_archived: z.boolean().optional(),
}).strict();

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const { supabase, user } = await getChatUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: project, error } = await supabase.from("projects").select("id, name, description, color_code, is_archived, created_at, updated_at").eq("id", id).eq("user_id", user.id).single();
  if (error) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  const { data: conversations } = await supabase.from("conversations").select("id, title, is_pinned, is_archived, updated_at").eq("project_id", id).eq("user_id", user.id).order("updated_at", { ascending: false });
  return NextResponse.json({ project, conversations: conversations ?? [] });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = updateSchema.safeParse(await request.json()); const { id } = await params;
  if (!parsed.success) return NextResponse.json({ error: "Invalid project update." }, { status: 400 });
  const { supabase, user } = await getChatUser(); if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabase.from("projects").update(parsed.data).eq("id", id).eq("user_id", user.id).select("id, name, description, color_code, is_archived, created_at, updated_at").single();
  if (error) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  return NextResponse.json({ project: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const { supabase, user } = await getChatUser(); if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { error } = await supabase.from("projects").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Unable to delete project." }, { status: 500 });
  return NextResponse.json({ success: true });
}
