import { NextResponse } from "next/server";
import { z } from "zod";
import { getSocialUser } from "@/lib/social/server";

const actionSchema = z.object({ action: z.enum(["read", "all_read"]), notificationId: z.string().uuid().optional() }).strict();
const querySchema = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(30), unread: z.enum(["true", "false"]).optional() });

export async function GET(request: Request) {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid notification query." }, { status: 400 });
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { page, limit, unread } = parsed.data;
  let query = supabase.from("notifications").select("id, type, title, body, target_route, target_id, created_at, read_at", { count: "exact" }).eq("user_id", user.id);
  if (unread === "true") query = query.is("read_at", null);
  const from = (page - 1) * limit;
  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, from + limit - 1);
  if (error) return NextResponse.json({ error: "Unable to load notifications." }, { status: 500 });
  const { count: unreadCount } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null);
  return NextResponse.json({ notifications: data ?? [], page, limit, total: count ?? 0, unreadCount: unreadCount ?? 0 });
}

export async function PATCH(request: Request) {
  const parsed = actionSchema.safeParse(await request.json());
  if (!parsed.success || (parsed.data.action === "read" && !parsed.data.notificationId)) return NextResponse.json({ error: "Invalid notification action." }, { status: 400 });
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let query = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  if (parsed.data.notificationId) query = query.eq("id", parsed.data.notificationId);
  const { error } = await query;
  if (error) return NextResponse.json({ error: "Unable to update notifications." }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const parsed = z.object({ notificationId: z.string().uuid() }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid notification." }, { status: 400 });
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { error } = await supabase.from("notifications").delete().eq("id", parsed.data.notificationId).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Unable to delete notification." }, { status: 500 });
  return NextResponse.json({ success: true });
}
