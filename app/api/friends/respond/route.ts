import { NextResponse } from "next/server";
import { z } from "zod";
import { getSocialUser } from "@/lib/social/server";

const schema = z.object({ requestId: z.string().uuid(), action: z.enum(["accept", "decline"]) }).strict();

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid friend response." }, { status: 400 });
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: friendship } = await supabase.from("friendships").select("id, friend_id, status").eq("id", parsed.data.requestId).eq("friend_id", user.id).eq("status", "pending").maybeSingle();
  if (!friendship) return NextResponse.json({ error: "Pending request not found." }, { status: 404 });
  if (parsed.data.action === "decline") {
    const { error } = await supabase.from("friendships").delete().eq("id", friendship.id).eq("friend_id", user.id);
    if (error) return NextResponse.json({ error: "Unable to decline request." }, { status: 500 });
    return NextResponse.json({ success: true });
  }
  const { data, error } = await supabase.from("friendships").update({ status: "accepted", updated_at: new Date().toISOString() }).eq("id", friendship.id).eq("friend_id", user.id).select("id, user_id, friend_id, status").single();
  if (error) return NextResponse.json({ error: "Unable to accept request." }, { status: 500 });
  return NextResponse.json({ friendship: data });
}
