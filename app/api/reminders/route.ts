import { NextResponse } from "next/server";
import { getSocialUser } from "@/lib/social/server";
import { reminderSchema } from "@/lib/productivity/state";

export async function GET() {
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabase.from("reminders").select("id, task_id, scheduled_at, active, delivered_at, created_at, updated_at").eq("owner_id", user.id).order("scheduled_at", { ascending: true });
  if (error) return NextResponse.json({ error: "Unable to load reminders." }, { status: 500 });
  return NextResponse.json({ reminders: data ?? [] });
}

export async function POST(request: Request) {
  const parsed = reminderSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid reminder details." }, { status: 400 });
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: task } = await supabase.from("tasks").select("id").eq("id", parsed.data.taskId).eq("owner_id", user.id).maybeSingle();
  if (!task) return NextResponse.json({ error: "Task not found." }, { status: 404 });
  const { data, error } = await supabase.from("reminders").insert({ owner_id: user.id, task_id: task.id, scheduled_at: parsed.data.scheduledAt, active: parsed.data.active }).select("id, task_id, scheduled_at, active, delivered_at, created_at, updated_at").single();
  if (error) return NextResponse.json({ error: "Unable to create reminder." }, { status: 500 });
  return NextResponse.json({ reminder: data }, { status: 201 });
}
