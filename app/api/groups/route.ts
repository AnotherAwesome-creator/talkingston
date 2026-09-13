import { NextResponse } from "next/server";
import { z } from "zod";
import { getSocialUser } from "@/lib/social/server";

const createSchema = z.object({ name: z.string().trim().min(1).max(100), description: z.string().trim().max(1000).nullable().optional(), avatarUrl: z.string().url().nullable().optional() }).strict();

export async function GET() {
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: memberships, error } = await supabase.from("group_members").select("group_id, role, joined_at").eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Unable to load groups." }, { status: 500 });
  const ids = (memberships ?? []).map((item) => item.group_id);
  const { data: groups } = ids.length ? await supabase.from("groups").select("id, owner_id, name, description, avatar_url, created_at, updated_at").in("id", ids).order("updated_at", { ascending: false }) : { data: [] };
  const roles = new Map((memberships ?? []).map((item) => [item.group_id, item.role]));
  return NextResponse.json({ groups: (groups ?? []).map((group) => ({ ...group, role: roles.get(group.id) ?? "member" })) });
}

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid group details." }, { status: 400 });
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: group, error } = await supabase.from("groups").insert({ owner_id: user.id, name: parsed.data.name, description: parsed.data.description ?? null, avatar_url: parsed.data.avatarUrl ?? null }).select("id, owner_id, name, description, avatar_url, created_at, updated_at").single();
  if (error || !group) return NextResponse.json({ error: "Unable to create group." }, { status: 500 });
  const { error: memberError } = await supabase.from("group_members").insert({ group_id: group.id, user_id: user.id, role: "owner" });
  if (memberError) return NextResponse.json({ error: "Unable to initialize group membership." }, { status: 500 });
  return NextResponse.json({ group }, { status: 201 });
}
