import { NextResponse } from "next/server";
import { z } from "zod";
import { announceCheck, chooseWhotSuit, createGame, drawCard, getLegalMoves, playCard, rematchGame, startGame, defaultWhotRules, type WhotState } from "@/lib/games/whot";
import { getSocialUser } from "@/lib/social/server";

const rulesSchema = z.object({
  initialHand: z.number().int().min(3).max(12),
  drawMode: z.enum(["one", "until-playable"]),
  emptyMarketMode: z.enum(["score", "recycle"]),
  clockwise: z.boolean(),
  starDouble: z.boolean(),
  whotEnabled: z.boolean(),
  pickTwoMode: z.enum(["stack", "block", "none"]),
  pickThreeMode: z.enum(["stack", "block", "none"]),
  stackPenalties: z.boolean(),
  mustPlayWhenPossible: z.boolean(),
  skipOnEight: z.boolean(),
  drawOnFourteen: z.boolean(),
  extraTurnOnOne: z.boolean(),
}).strict();
const actionSchema = z.object({ action: z.enum(["ready", "start", "pause", "rematch", "configure_rules", "draw", "play", "check", "choose_suit", "chat"]), cardId: z.string().optional(), calledSuit: z.enum(["circle", "triangle", "cross", "square", "star"]).optional(), message: z.string().trim().min(1).max(500).optional(), rules: rulesSchema.optional() }).strict();

function privateState(state: WhotState, userId: string) {
  state.rules = { ...defaultWhotRules, ...(state.rules ?? {}) };
  state.activity ??= [];
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

async function roomChat(supabase: Awaited<ReturnType<typeof getSocialUser>>["supabase"], roomId: string) {
  const { data: events } = await supabase.from("whot_events").select("id, actor_id, payload, created_at").eq("room_id", roomId).eq("event_type", "CHAT").order("created_at", { ascending: true }).limit(100);
  const ids = (events ?? []).map((event) => event.actor_id);
  const { data: profiles } = ids.length ? await supabase.from("profiles").select("id, display_name, username, avatar_url").in("id", ids) : { data: [] };
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  return (events ?? []).map((event) => ({ id: event.id, actor_id: event.actor_id, message: typeof event.payload?.message === "string" ? event.payload.message : "", created_at: event.created_at, profile: profileMap.get(event.actor_id) ?? null }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid room." }, { status: 400 });
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabase.from("whot_rooms").select("id, room_code, owner_id, status, state, version, created_at, updated_at").eq("id", id).single();
  if (error || !data) return NextResponse.json({ error: "Room not found." }, { status: 404 });
  const { data: players } = await supabase.from("whot_players").select("user_id, seat, ready").eq("room_id", id).order("seat");
  const ids = (players ?? []).map((player) => player.user_id);
  const { data: profiles } = ids.length ? await supabase.from("profiles").select("id, display_name, username, avatar_url").in("id", ids) : { data: [] };
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  return NextResponse.json({
    room: {
      ...data,
      state: privateState(data.state as WhotState, user.id),
      players: (players ?? []).map((player) => ({ ...player, profile: profileMap.get(player.user_id) ?? null })),
      chat: await roomChat(supabase, id),
    },
  });
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
  state.rules = { ...defaultWhotRules, ...(state.rules ?? {}) };
  state.activity ??= [];
  try {
    if (parsed.data.action === "ready") {
      const { data: currentPlayer } = await supabase.from("whot_players").select("ready").eq("room_id", id).eq("user_id", user.id).single();
      const { error: readyError } = await supabase.from("whot_players").update({ ready: !(currentPlayer?.ready ?? false) }).eq("room_id", id).eq("user_id", user.id);
      if (readyError) return NextResponse.json({ error: "Unable to update readiness." }, { status: 500 });
      return NextResponse.json({ room: { state: privateState(state, user.id), version: room.version } });
    }
    if (parsed.data.action === "configure_rules") {
      if (room.owner_id !== user.id) return NextResponse.json({ error: "Only the room host can configure rules." }, { status: 403 });
      if (state.status !== "lobby") return NextResponse.json({ error: "Rules are locked after the game starts." }, { status: 409 });
      if (!parsed.data.rules) return NextResponse.json({ error: "Rules are required." }, { status: 400 });
      const nextRules = parsed.data.rules;
      if (state.rules.initialHand !== nextRules.initialHand || state.rules.whotEnabled !== nextRules.whotEnabled) {
        const redealt = createGame(state.id, state.players.map((player) => player.id), Math.random, nextRules);
        redealt.status = "lobby";
        redealt.lastAction = "RULES_UPDATED";
        redealt.version = state.version + 1;
        Object.assign(state, redealt);
      } else {
        state.rules = nextRules;
        state.direction = nextRules.clockwise ? 1 : -1;
        state.lastAction = "RULES_UPDATED";
        state.version += 1;
      }
      state.activity = ["Host updated game rules", ...state.activity].slice(0, 20);
      const { data: updatedRoom, error: updateError } = await supabase.from("whot_rooms").update({ state, version: state.version }).eq("id", id).eq("version", room.version).select("version").maybeSingle();
      if (updateError || !updatedRoom) return NextResponse.json({ error: "Room changed; reload and try again." }, { status: 409 });
      const { error: eventError } = await supabase.from("whot_events").insert({
        room_id: id,
        sequence: state.version,
        event_type: "RULES_UPDATED",
        actor_id: user.id,
        payload: { version: state.version },
      });
      if (eventError && eventError.code !== "23505") return NextResponse.json({ error: "Unable to publish Whot update." }, { status: 500 });
      return NextResponse.json({ room: { state: privateState(state, user.id), version: state.version } });
    }
    if (parsed.data.action === "chat") {
      if (!parsed.data.message) return NextResponse.json({ error: "A message is required." }, { status: 400 });
      const chatSequence = -(Date.now() % 2147483647);
      const { error: chatError } = await supabase.from("whot_events").insert({ room_id: id, sequence: chatSequence, event_type: "CHAT", actor_id: user.id, payload: { message: parsed.data.message } });
      if (chatError && chatError.code !== "23505") return NextResponse.json({ error: "Unable to send chat message." }, { status: 500 });
      return NextResponse.json({ room: { state: privateState(state, user.id), version: room.version, chat: await roomChat(supabase, id) } });
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
