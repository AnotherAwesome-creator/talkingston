import { NextResponse } from "next/server";
import { z } from "zod";
import { getSocialUser, isGroupMember } from "@/lib/social/server";

const inviteSchema = z.object({ userId: z.string().uuid() }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = inviteSchema.safeParse(await request.json()); const { id } = await params;
  if (!parsed.success) return NextResponse.json({ error: "Invalid member." }, { status: 400 });
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const manager = await isGroupMember(supabase, id, user.id);
  if (!manager || !["owner", "admin"].includes(manager.role)) return NextResponse.json({ error: "Only group managers can invite members." }, { status: 403 });
  if (parsed.data.userId === user.id) return NextResponse.json({ error: "You are already a member." }, { status: 400 });
  const { data: friendship } = await supabase.from("friendships").select("id").eq("status", "accepted").or(`and(user_id.eq.${user.id},friend_id.eq.${parsed.data.userId}),and(user_id.eq.${parsed.data.userId},friend_id.eq.${user.id})`).maybeSingle();
  if (!friendship) return NextResponse.json({ error: "You can only invite an accepted friend." }, { status: 403 });
  const { data: target } = await supabase.from("profiles").select("id").eq("id", parsed.data.userId).maybeSingle();
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });
  const { data, error } = await supabase.from("group_members").insert({ group_id: id, user_id: target.id, role: "member" }).select("group_id, user_id, role, joined_at").single();
  if (error) return NextResponse.json({ error: "User is already a member or could not be invited." }, { status: 409 });
  return NextResponse.json({ member: data }, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = inviteSchema.safeParse(await request.json()); const { id } = await params;
  if (!parsed.success) return NextResponse.json({ error: "Invalid member." }, { status: 400 });
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const manager = await isGroupMember(supabase, id, user.id);
  if (!manager) return NextResponse.json({ error: "Group not found." }, { status: 404 });
  if (parsed.data.userId !== user.id && !["owner", "admin"].includes(manager.role)) return NextResponse.json({ error: "Only group managers can remove members." }, { status: 403 });
  const { error } = await supabase.from("group_members").delete().eq("group_id", id).eq("user_id", parsed.data.userId).neq("role", "owner");
  if (error) return NextResponse.json({ error: "Unable to update membership." }, { status: 500 });
  return NextResponse.json({ success: true });
}
