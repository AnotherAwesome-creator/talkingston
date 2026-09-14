import { NextResponse } from "next/server";
import { z } from "zod";
import { getSocialUser } from "@/lib/social/server";
import { reminderUpdateSchema } from "@/lib/productivity/state";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid reminder id." }, { status: 400 });
  const parsed = reminderUpdateSchema.safeParse(await request.json());
  if (!parsed.success || Object.keys(parsed.data).length === 0) return NextResponse.json({ error: "Invalid reminder changes." }, { status: 400 });
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const changes = {
    ...(parsed.data.scheduledAt === undefined ? {} : { scheduled_at: parsed.data.scheduledAt }),
    ...(parsed.data.active === undefined ? {} : { active: parsed.data.active }),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("reminders").update(changes).eq("id", id).eq("owner_id", user.id).select("id, task_id, scheduled_at, active, created_at, updated_at").maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to update reminder." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Reminder not found." }, { status: 404 });
  return NextResponse.json({ reminder: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid reminder id." }, { status: 400 });
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabase.from("reminders").delete().eq("id", id).eq("owner_id", user.id).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to delete reminder." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Reminder not found." }, { status: 404 });
  return NextResponse.json({ success: true });
}
