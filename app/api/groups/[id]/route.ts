import { NextResponse } from "next/server";
import { z } from "zod";
import { getProfileMap, getSocialUser, isGroupMember } from "@/lib/social/server";

const updateSchema = z.object({ name: z.string().trim().min(1).max(100).optional(), description: z.string().trim().max(1000).nullable().optional(), avatarUrl: z.string().url().nullable().optional() }).strict();

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isGroupMember(supabase, id, user.id))) return NextResponse.json({ error: "Group not found." }, { status: 404 });
  const { data: group, error } = await supabase.from("groups").select("id, owner_id, name, description, avatar_url, join_code, created_at, updated_at").eq("id", id).single();
  if (error) return NextResponse.json({ error: "Group not found." }, { status: 404 });
  const { data: memberships } = await supabase.from("group_members").select("group_id, user_id, role, joined_at").eq("group_id", id);
  const profiles = await getProfileMap(supabase, (memberships ?? []).map((item) => item.user_id));
  return NextResponse.json({ group, members: (memberships ?? []).map((member) => ({ ...member, profile: profiles.get(member.user_id) ?? null })) });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = updateSchema.safeParse(await request.json()); const { id } = await params;
  if (!parsed.success) return NextResponse.json({ error: "Invalid group update." }, { status: 400 });
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await isGroupMember(supabase, id, user.id);
  if (!membership || !["owner", "admin"].includes(membership.role)) return NextResponse.json({ error: "Only group managers can edit this group." }, { status: 403 });
  const payload = { ...(parsed.data.name === undefined ? {} : { name: parsed.data.name }), ...(parsed.data.description === undefined ? {} : { description: parsed.data.description }), ...(parsed.data.avatarUrl === undefined ? {} : { avatar_url: parsed.data.avatarUrl }) };
  const { data, error } = await supabase.from("groups").update(payload).eq("id", id).select("id, owner_id, name, description, avatar_url, created_at, updated_at").single();
  if (error) return NextResponse.json({ error: "Unable to update group." }, { status: 500 });
  return NextResponse.json({ group: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await isGroupMember(supabase, id, user.id);
  if (!membership || membership.role !== "owner") return NextResponse.json({ error: "Only the owner can delete this group." }, { status: 403 });
  const { error } = await supabase.from("groups").delete().eq("id", id).eq("owner_id", user.id);
  if (error) return NextResponse.json({ error: "Unable to delete group." }, { status: 500 });
  return NextResponse.json({ success: true });
}
