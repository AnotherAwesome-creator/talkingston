import { NextResponse } from "next/server";
import { z } from "zod";
import { createGame } from "@/lib/games/whot";
import { getSocialUser } from "@/lib/social/server";

const createSchema = z.object({ ai: z.boolean().default(false) }).strict();

export async function GET() {
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabase.from("whot_players").select("room_id, seat, ready, whot_rooms(id, owner_id, status, version, created_at)").eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Unable to load Whot rooms." }, { status: 500 });
  return NextResponse.json({ rooms: data ?? [] });
}

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid Whot room." }, { status: 400 });
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roomId = crypto.randomUUID();
  const state = createGame(roomId, [user.id, parsed.data.ai ? `ai:${roomId}` : `waiting:${roomId}`]);
  state.status = "lobby";
  state.lastAction = "ROOM_CREATED";
  const { error } = await supabase.from("whot_rooms").insert({ id: roomId, owner_id: user.id, status: "lobby", state, version: state.version });
  if (error) return NextResponse.json({ error: "Unable to create Whot room." }, { status: 500 });
  const { error: playerError } = await supabase.from("whot_players").insert({ room_id: roomId, user_id: user.id, seat: 0, ready: false });
  if (playerError) {
    await supabase.from("whot_rooms").delete().eq("id", roomId).eq("owner_id", user.id);
    return NextResponse.json({ error: "Unable to initialize Whot room." }, { status: 500 });
  }
  return NextResponse.json({ room: { id: roomId, owner_id: user.id, status: "lobby", version: state.version } }, { status: 201 });
}
