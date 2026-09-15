import { NextResponse } from "next/server";
import { z } from "zod";
import { announceCheck, chooseWhotSuit, drawCard, getLegalMoves, playCard, rematchGame, startGame, type WhotState } from "@/lib/games/whot";
import { getSocialUser } from "@/lib/social/server";

const actionSchema = z.object({ action: z.enum(["ready", "start", "pause", "rematch", "draw", "play", "check", "choose_suit", "chat"]), cardId: z.string().optional(), calledSuit: z.enum(["circle", "triangle", "cross", "square", "star"]).optional(), message: z.string().trim().min(1).max(500).optional() }).strict();

function privateState(state: WhotState, userId: string) {
  return {
    ...state,
    players: state.players.map((player) => ({
      id: player.id,
      hand: player.id === userId
        ? player.hand
        : player.hand.map((_, index) => ({ id: `hidden-${player.id}-${index}`, suit: "hidden", value: -1 })),
    })),
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid room." }, { status: 400 });
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabase.from("whot_rooms").select("id, owner_id, status, state, version, created_at, updated_at").eq("id", id).single();
  if (error || !data) return NextResponse.json({ error: "Room not found." }, { status: 404 });
  return NextResponse.json({ room: { ...data, state: privateState(data.state as WhotState, user.id) } });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = actionSchema.safeParse(await request.json());
  const { id } = await params;
  if (!parsed.success || !z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid Whot action." }, { status: 400 });
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: membership } = await supabase.from("whot_players").select("user_id").eq("room_id", id).eq("user_id", user.id).maybeSingle();
  if (!membership) return NextResponse.json({ error: "You are not a member of this room." }, { status: 403 });
  const { data: room, error } = await supabase.from("whot_rooms").select("owner_id, state, version").eq("id", id).single();
  if (error || !room) return NextResponse.json({ error: "Room not found." }, { status: 404 });
  const state = room.state as WhotState;
  try {
    if (parsed.data.action === "ready") {
      const { error: readyError } = await supabase.from("whot_players").update({ ready: true }).eq("room_id", id).eq("user_id", user.id);
      if (readyError) return NextResponse.json({ error: "Unable to update readiness." }, { status: 500 });
      return NextResponse.json({ room: { state: privateState(state, user.id), version: room.version } });
    }
    if (parsed.data.action === "chat") {
      if (!parsed.data.message) return NextResponse.json({ error: "A message is required." }, { status: 400 });
      const { error: chatError } = await supabase.from("whot_events").insert({ room_id: id, sequence: room.version + 1, event_type: "CHAT", actor_id: user.id, payload: { message: parsed.data.message } });
      if (chatError && chatError.code !== "23505") return NextResponse.json({ error: "Unable to send chat message." }, { status: 500 });
      return NextResponse.json({ room: { state: privateState(state, user.id), version: room.version } });
    }
    if (parsed.data.action === "start") {
      if (room.owner_id !== user.id) return NextResponse.json({ error: "Only the room owner can start the game." }, { status: 403 });
      const { data: readyPlayers } = await supabase.from("whot_players").select("ready").eq("room_id", id);
      if ((readyPlayers ?? []).some((player) => !player.ready) && !state.players.some((player) => player.id.startsWith("ai:"))) {
        return NextResponse.json({ error: "All players must be ready before starting." }, { status: 409 });
      }
      startGame(state);
    }
    if (parsed.data.action === "pause") {
      if (state.status !== "active") throw new Error("Only active games can be paused.");
      state.status = "lobby";
      state.lastAction = "GAME_PAUSED";
      state.version += 1;
    }
    if (parsed.data.action === "rematch") {
      if (state.status !== "finished") throw new Error("Only finished games can be rematched.");
      const next = rematchGame(state);
      Object.assign(state, next);
    }
    if (parsed.data.action === "draw") drawCard(state, user.id);
    if (parsed.data.action === "check") announceCheck(state, user.id);
    if (parsed.data.action === "choose_suit") {
      if (!parsed.data.calledSuit) return NextResponse.json({ error: "A suit is required." }, { status: 400 });
      chooseWhotSuit(state, user.id, parsed.data.calledSuit);
    }
    if (parsed.data.action === "play") {
      if (!parsed.data.cardId) return NextResponse.json({ error: "A card is required." }, { status: 400 });
      playCard(state, user.id, parsed.data.cardId, parsed.data.calledSuit);
    }
    const ai = state.players[state.currentPlayer];
    if (state.status === "active" && ai?.id === `ai:${id}`) {
      const legal = getLegalMoves(state, ai.id);
      if (legal[0]) playCard(state, ai.id, legal[0].id, legal[0].suit === "whot" ? "circle" : undefined);
      else drawCard(state, ai.id);
    }
  } catch (actionError) {
    return NextResponse.json({ error: actionError instanceof Error ? actionError.message : "Illegal Whot action." }, { status: 409 });
  }
  const { data: updatedRoom, error: updateError } = await supabase
    .from("whot_rooms")
    .update({ state, version: state.version, status: state.status })
    .eq("id", id)
    .eq("version", room.version)
    .select("version")
    .maybeSingle();
  if (updateError || !updatedRoom) return NextResponse.json({ error: "Room changed; reload and try again." }, { status: 409 });
  const { error: eventError } = await supabase.from("whot_events").insert({
    room_id: id,
    sequence: state.version,
    event_type: state.lastAction ?? parsed.data.action,
    actor_id: user.id,
    payload: { version: state.version },
  });
  if (eventError && eventError.code !== "23505") return NextResponse.json({ error: "Unable to publish Whot update." }, { status: 500 });
  return NextResponse.json({ room: { state: privateState(state, user.id), version: state.version } });
}
