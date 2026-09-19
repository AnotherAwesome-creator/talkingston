import { NextResponse } from "next/server";
import { z } from "zod";
import { createGame } from "@/lib/games/whot";
import { getSocialUser } from "@/lib/social/server";
import { bootstrapProfile } from "@/lib/auth/profile-bootstrap";

const requestSchema = z.union([
  z.object({ ai: z.boolean().default(false) }).strict(),
  z.object({ code: z.string().trim().regex(/^[a-z0-9]{6}$/i) }).strict(),
]);

function createRoomCode() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
}

export async function GET() {
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await bootstrapProfile(supabase, user);
  const { data, error } = await supabase.from("whot_players").select("room_id, seat, ready, whot_rooms(id, room_code, owner_id, status, version, created_at)").eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Unable to load Whot rooms." }, { status: 500 });
  return NextResponse.json({ rooms: data ?? [] });
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid Whot room." }, { status: 400 });
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ("code" in parsed.data) {
    const { data: room } = await supabase.from("whot_rooms").select("id, room_code, owner_id, status, version").eq("room_code", parsed.data.code.toUpperCase()).maybeSingle();
    if (!room || room.status !== "lobby") return NextResponse.json({ error: "Room code is not available." }, { status: 404 });
    const { data: players } = await supabase.from("whot_players").select("seat, user_id").eq("room_id", room.id);
    if (!(players ?? []).some((player) => player.user_id === user.id)) {
      if ((players ?? []).length >= 4) return NextResponse.json({ error: "Room is full." }, { status: 409 });
      const seat = Math.max(-1, ...(players ?? []).map((player) => player.seat)) + 1;
      const { error: playerError } = await supabase.from("whot_players").insert({ room_id: room.id, user_id: user.id, seat, ready: false });
      if (playerError) return NextResponse.json({ error: "Unable to join room." }, { status: 409 });
      const { data: roomState } = await supabase.from("whot_rooms").select("state, version").eq("id", room.id).single();
      if (roomState) {
        const state = roomState.state as { players?: Array<{ id: string }> };
        const waiting = state.players?.find((player) => player.id === `waiting:${room.id}`);
        if (waiting) {
          waiting.id = user.id;
          await supabase.from("whot_rooms").update({ state, version: roomState.version + 1 }).eq("id", room.id).eq("version", roomState.version);
        }
      }
    }
    return NextResponse.json({ room }, { status: 200 });
  }
  const roomId = crypto.randomUUID();
  const state = createGame(roomId, [user.id, parsed.data.ai ? `ai:${roomId}` : `waiting:${roomId}`]);
  state.status = "lobby";
  state.lastAction = "ROOM_CREATED";
  const roomCode = createRoomCode();
  const { error } = await supabase.from("whot_rooms").insert({ id: roomId, room_code: roomCode, owner_id: user.id, status: "lobby", state, version: state.version });
  if (error) return NextResponse.json({ error: "Unable to create Whot room." }, { status: 500 });
  const { error: playerError } = await supabase.from("whot_players").insert({ room_id: roomId, user_id: user.id, seat: 0, ready: false });
  if (playerError) {
    await supabase.from("whot_rooms").delete().eq("id", roomId).eq("owner_id", user.id);
    return NextResponse.json({ error: "Unable to initialize Whot room." }, { status: 500 });
  }
  return NextResponse.json({ room: { id: roomId, room_code: roomCode, owner_id: user.id, status: "lobby", version: state.version } }, { status: 201 });
}
