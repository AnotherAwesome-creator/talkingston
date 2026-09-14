import { NextResponse } from "next/server";
import { z } from "zod";
import { getSocialUser } from "@/lib/social/server";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid room." }, { status: 400 });
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: room } = await supabase.from("whot_rooms").select("id, status").eq("id", id).maybeSingle();
  if (!room || room.status !== "lobby") return NextResponse.json({ error: "Room is not available." }, { status: 409 });
  const { data: players } = await supabase.from("whot_players").select("seat, user_id").eq("room_id", id);
  if ((players ?? []).some((player) => player.user_id === user.id)) return NextResponse.json({ success: true }, { status: 200 });
  if ((players ?? []).length >= 4) return NextResponse.json({ error: "Room is full." }, { status: 409 });
  const seat = Math.max(-1, ...(players ?? []).map((player) => player.seat)) + 1;
  const { error } = await supabase.from("whot_players").insert({ room_id: id, user_id: user.id, seat, ready: false });
  if (error) return NextResponse.json({ error: "Unable to join room." }, { status: 409 });
  const { data: roomState } = await supabase.from("whot_rooms").select("state, version").eq("id", id).single();
  if (roomState) {
    const state = roomState.state as { players?: Array<{ id: string }> };
    const waiting = state.players?.find((player) => player.id === `waiting:${id}`);
    if (waiting) {
      waiting.id = user.id;
      await supabase.from("whot_rooms").update({ state, version: roomState.version + 1 }).eq("id", id).eq("version", roomState.version);
    }
  }
  return NextResponse.json({ success: true }, { status: 201 });
}
