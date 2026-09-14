import { NextResponse } from "next/server";
import { z } from "zod";
import { getProfileMap, getSocialUser } from "@/lib/social/server";

const requestSchema = z.object({ targetUserId: z.string().uuid() }).strict();

export async function GET(request: Request) {
  const status = z.enum(["pending", "accepted", "blocked"]).optional().safeParse(new URL(request.url).searchParams.get("status") ?? undefined);
  if (!status.success) return NextResponse.json({ error: "Invalid friendship status." }, { status: 400 });
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let query = supabase.from("friendships").select("id, user_id, friend_id, status, created_at, updated_at")
    .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);
  if (status.data) query = query.eq("status", status.data);
  const { data, error } = await query.order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Unable to load friendships." }, { status: 500 });
  const rows = data ?? [];
  const profiles = await getProfileMap(supabase, rows.map((row) => row.user_id === user.id ? row.friend_id : row.user_id));
  return NextResponse.json({ friendships: rows.map((row) => ({ ...row, profile: profiles.get(row.user_id === user.id ? row.friend_id : row.user_id) ?? null, direction: row.user_id === user.id ? "outgoing" : "incoming" })) });
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid friend request." }, { status: 400 });
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (parsed.data.targetUserId === user.id) return NextResponse.json({ error: "You cannot friend yourself." }, { status: 400 });
  const { data: target } = await supabase.from("public_profiles").select("id").eq("id", parsed.data.targetUserId).maybeSingle();
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });
  const { data: existing } = await supabase.from("friendships").select("id, user_id, friend_id, status")
    .or(`and(user_id.eq.${user.id},friend_id.eq.${target.id}),and(user_id.eq.${target.id},friend_id.eq.${user.id})`);
  if (existing?.some((row) => row.status === "blocked")) return NextResponse.json({ error: "This user is blocked." }, { status: 409 });
  if (existing?.some((row) => row.status === "accepted" || row.status === "pending")) return NextResponse.json({ error: "A friendship or request already exists." }, { status: 409 });
  const { data, error } = await supabase.from("friendships").insert({ user_id: user.id, friend_id: target.id, status: "pending" }).select("id, user_id, friend_id, status, created_at").single();
  if (error) return NextResponse.json({ error: "Unable to send friend request." }, { status: 500 });
  return NextResponse.json({ friendship: data }, { status: 201 });
}
