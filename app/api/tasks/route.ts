import { NextResponse } from "next/server";
import { z } from "zod";
import { getSocialUser } from "@/lib/social/server";
import { taskSchema } from "@/lib/productivity/state";

const querySchema = z.object({
  status: z.enum(["open", "completed"]).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  projectId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export async function GET(request: Request) {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid task filters." }, { status: 400 });
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { status, priority, projectId, page, limit } = parsed.data;
  let query = supabase.from("tasks").select("id, title, notes, due_at, priority, status, project_id, created_at, updated_at", { count: "exact" }).eq("owner_id", user.id);
  if (status) query = query.eq("status", status);
  if (priority) query = query.eq("priority", priority);
  if (projectId) query = query.eq("project_id", projectId);
  const from = (page - 1) * limit;
  const { data, error, count } = await query.order("due_at", { ascending: true, nullsFirst: false }).range(from, from + limit - 1);
  if (error) return NextResponse.json({ error: "Unable to load tasks." }, { status: 500 });
  return NextResponse.json({ tasks: data ?? [], page, limit, total: count ?? 0 });
}

export async function POST(request: Request) {
  const parsed = taskSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid task details." }, { status: 400 });
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabase.from("tasks").insert({
    owner_id: user.id,
    title: parsed.data.title,
    notes: parsed.data.notes ?? null,
    due_at: parsed.data.dueAt ?? null,
    priority: parsed.data.priority,
    project_id: parsed.data.projectId ?? null,
  }).select("id, title, notes, due_at, priority, status, project_id, created_at, updated_at").single();
  if (error) return NextResponse.json({ error: "Unable to create task." }, { status: 500 });
  return NextResponse.json({ task: data }, { status: 201 });
}
