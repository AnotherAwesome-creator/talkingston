import { NextResponse } from "next/server";
import { z } from "zod";
import { getSocialUser } from "@/lib/social/server";
import { bootstrapProfile } from "@/lib/auth/profile-bootstrap";

const createSchema = z.object({ name: z.string().trim().min(1).max(100), description: z.string().trim().max(1000).nullable().optional(), avatarUrl: z.string().url().nullable().optional() }).strict();
const joinSchema = z.object({ code: z.string().trim().regex(/^[a-z0-9]{6,10}$/i) }).strict();

function createJoinCode() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

export async function GET() {
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: memberships, error } = await supabase.from("group_members").select("group_id, role, joined_at").eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Unable to load groups." }, { status: 500 });
  const ids = (memberships ?? []).map((item) => item.group_id);
  const { data: groups } = ids.length ? await supabase.from("groups").select("id, owner_id, name, description, avatar_url, join_code, created_at, updated_at").in("id", ids).order("updated_at", { ascending: false }) : { data: [] };
  const roles = new Map((memberships ?? []).map((item) => [item.group_id, item.role]));
  return NextResponse.json({ groups: (groups ?? []).map((group) => ({ ...group, role: roles.get(group.id) ?? "member" })) });
}

export async function PUT(request: Request) {
  const parsed = joinSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid group code." }, { status: 400 });
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabase.rpc("join_group_by_code", { input_code: parsed.data.code.toUpperCase() });
  if (error) return NextResponse.json({ error: error.message.includes("not found") ? "Group code not found." : "Unable to join group." }, { status: 409 });
  return NextResponse.json({ membership: data }, { status: 201 });
}

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid group details." }, { status: 400 });
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await bootstrapProfile(supabase, user);
  const groupId = crypto.randomUUID();
  const { error } = await supabase.from("groups").insert({ id: groupId, owner_id: user.id, name: parsed.data.name, description: parsed.data.description ?? null, avatar_url: parsed.data.avatarUrl ?? null, join_code: createJoinCode() });
  if (error) return NextResponse.json({ error: "Unable to create group." }, { status: 500 });
  const { error: memberError } = await supabase.from("group_members").insert({ group_id: groupId, user_id: user.id, role: "owner" });
  if (memberError) {
    await supabase.from("groups").delete().eq("id", groupId).eq("owner_id", user.id);
    return NextResponse.json({ error: "Unable to initialize group membership." }, { status: 500 });
  }
  const { data: group, error: groupError } = await supabase.from("groups").select("id, owner_id, name, description, avatar_url, join_code, created_at, updated_at").eq("id", groupId).single();
  if (groupError || !group) return NextResponse.json({ error: "Unable to load the new group." }, { status: 500 });
  return NextResponse.json({ group }, { status: 201 });
}
