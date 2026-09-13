import { NextResponse } from "next/server";
import { z } from "zod";
import { getSocialUser } from "@/lib/social/server";

const schema = z.object({ action: z.enum(["cancel", "remove", "block", "unblock"]) }).strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = schema.safeParse(await request.json()); const { id } = await params;
  if (!parsed.success || !z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid friendship action." }, { status: 400 });
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (parsed.data.action === "block") {
    await supabase.from("friendships").delete().or(`and(user_id.eq.${user.id},friend_id.eq.${id}),and(user_id.eq.${id},friend_id.eq.${user.id})`);
    const { data, error } = await supabase.from("friendships").insert({ user_id: user.id, friend_id: id, status: "blocked" }).select("id, user_id, friend_id, status").single();
    if (error) return NextResponse.json({ error: "Unable to block user." }, { status: 500 });
    return NextResponse.json({ friendship: data });
  }
  const query = supabase.from("friendships").delete().eq("id", id);
  if (parsed.data.action === "cancel") query.eq("user_id", user.id).eq("status", "pending");
  if (parsed.data.action === "remove") query.or(`user_id.eq.${user.id},friend_id.eq.${user.id}`).eq("status", "accepted");
  if (parsed.data.action === "unblock") query.eq("user_id", user.id).eq("status", "blocked");
  const { error } = await query;
  if (error) return NextResponse.json({ error: "Unable to update friendship." }, { status: 500 });
  if (parsed.data.action === "unblock") return NextResponse.json({ success: true });
  return NextResponse.json({ success: true });
}
