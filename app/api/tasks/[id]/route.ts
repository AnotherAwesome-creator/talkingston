import { NextResponse } from "next/server";
import { z } from "zod";
import { getSocialUser } from "@/lib/social/server";
import { taskUpdateSchema } from "@/lib/productivity/state";

const idSchema = z.string().uuid();

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "Invalid task id." }, { status: 400 });
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabase.from("tasks").select("id, title, notes, due_at, priority, status, project_id, created_at, updated_at").eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to load task." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Task not found." }, { status: 404 });
  return NextResponse.json({ task: data });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "Invalid task id." }, { status: 400 });
  const parsed = taskUpdateSchema.safeParse(await request.json());
  if (!parsed.success || Object.keys(parsed.data).length === 0) return NextResponse.json({ error: "Invalid task changes." }, { status: 400 });
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const changes = {
    ...(parsed.data.title === undefined ? {} : { title: parsed.data.title }),
    ...(parsed.data.notes === undefined ? {} : { notes: parsed.data.notes }),
    ...(parsed.data.dueAt === undefined ? {} : { due_at: parsed.data.dueAt }),
    ...(parsed.data.priority === undefined ? {} : { priority: parsed.data.priority }),
    ...(parsed.data.projectId === undefined ? {} : { project_id: parsed.data.projectId }),
    ...(parsed.data.status === undefined ? {} : { status: parsed.data.status }),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("tasks").update(changes).eq("id", id).eq("owner_id", user.id).select("id, title, notes, due_at, priority, status, project_id, created_at, updated_at").maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to update task." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Task not found." }, { status: 404 });
  return NextResponse.json({ task: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "Invalid task id." }, { status: 400 });
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabase.from("tasks").delete().eq("id", id).eq("owner_id", user.id).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to delete task." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Task not found." }, { status: 404 });
  return NextResponse.json({ success: true });
}
