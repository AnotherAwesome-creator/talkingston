"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, StateCard } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type Room = { id: string; owner_id: string; status: string; version: number };
type CardData = { id: string; suit: string; value: number };
type GameState = { players: Array<{ id: string; hand: CardData[] }>; discardPile: CardData[]; drawPile: CardData[]; currentPlayer: number; status: string; lastAction: string | null; calledSuit?: string | null; winnerId?: string | null; pendingDraw?: number };
const suitGlyphs: Record<string, string> = { circle: "○", triangle: "△", cross: "✚", square: "□", star: "★", whot: "W" };

function CardFace({ card, back = false }: { card: CardData; back?: boolean }) {
  if (back) return <div aria-label="Face-down card" className="grid min-h-24 w-16 place-items-center rounded-xl border border-pink-200/30 bg-gradient-to-br from-pink-500/60 to-indigo-700/70 p-2 text-2xl font-bold text-white shadow-lg">✦</div>;
  const isWhot = card.suit === "whot";
  return <div className={`grid min-h-24 w-16 place-items-center rounded-xl border p-2 text-center shadow-lg ${isWhot ? "border-amber-200/70 bg-gradient-to-br from-amber-400 to-pink-500 text-slate-950" : "border-indigo-200/40 bg-white/10 text-white"}`}><span className="text-2xl leading-none">{suitGlyphs[card.suit] ?? "?"}</span><span className="text-sm font-bold">{isWhot ? "WHOT" : card.value}</span></div>;
}

async function json<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Unable to complete Whot request.");
  return body;
}

export function WhotLobby() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [error, setError] = useState("");
  const load = useCallback(async () => { try { setRooms((await json<{ rooms: Array<{ whot_rooms: Room }> }>("/api/whot/rooms")).rooms.map((item) => item.whot_rooms)); } catch (err) { setError(err instanceof Error ? err.message : "Unable to load Whot rooms."); } }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const router = useRouter();
  const create = async () => { try { const result = await json<{ room: Room }>("/api/whot/rooms", { method: "POST", body: JSON.stringify({ ai: true }) }); router.push(`/games/whot/${result.room.id}`); } catch (err) { setError(err instanceof Error ? err.message : "Unable to create room."); } };
  return <div className="grid gap-6"><header><p className="text-sm font-semibold text-pink-300">WHOT</p><h1 className="mt-2 text-3xl font-semibold">Whot table</h1><p className="mt-2 text-muted">A deterministic, companion-friendly card game.</p></header><Card className="flex flex-wrap gap-3"><Button onClick={() => void create()}>Create room</Button><Button variant="secondary" onClick={() => void load()}>Refresh rooms</Button></Card>{error && <p role="alert" className="text-sm text-red-300">{error}</p>}{rooms.length ? <div className="grid gap-3 md:grid-cols-2">{rooms.map((room) => <Card key={room.id}><p className="font-semibold">Room {room.id.slice(0, 8)}</p><p className="text-sm text-muted">{room.status}</p><Link className="mt-3 inline-flex text-sm text-indigo-300" href={`/games/whot/${room.id}`}>Open room</Link></Card>)}</div> : <StateCard title="No Whot rooms yet" description="Create a room to deal the first hand." />}</div>;
}

export function WhotGame({ roomId }: { roomId: string }) {
  const [state, setState] = useState<GameState | null>(null);
  const [userId, setUserId] = useState("");
  const [pendingWhotCard, setPendingWhotCard] = useState<CardData | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => { try { setState((await json<{ room: { state: GameState } }>(`/api/whot/rooms/${roomId}`)).room.state); } catch (err) { setError(err instanceof Error ? err.message : "Unable to load room."); } }, [roomId]);
  useEffect(() => { const initial = window.setTimeout(() => void load(), 0); const timer = window.setInterval(() => void load(), 3000); return () => { window.clearTimeout(initial); window.clearInterval(timer); }; }, [load]);
  useEffect(() => { void createClient().auth.getUser().then(({ data }) => setUserId(data.user?.id ?? "")); }, []);
  useEffect(() => {
    let client: ReturnType<typeof createClient> | null = null;
    try {
      client = createClient();
      const channel = client.channel(`whot:${roomId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "whot_events", filter: `room_id=eq.${roomId}` }, () => void load()).subscribe();
      return () => { void client?.removeChannel(channel); };
    } catch {
      return undefined;
    }
  }, [roomId, load]);
  const action = async (body: object) => { try { setState((await json<{ room: { state: GameState } }>(`/api/whot/rooms/${roomId}`, { method: "POST", body: JSON.stringify(body) })).room.state); setError(""); } catch (err) { setError(err instanceof Error ? err.message : "Illegal move."); } };
  if (error && !state) return <StateCard title="Whot room unavailable" description={error} />;
  if (!state) return <StateCard title="Loading Whot table" description="Reconnecting to the room..." />;
  const player = state.players.find((entry) => entry.id === userId) ?? state.players[0];
  const opponent = state.players.find((entry) => entry.id !== userId);
  const yourTurn = state.players[state.currentPlayer]?.id === userId && state.status === "active";
  const special = state.lastAction?.includes("WHOT") || state.lastAction?.includes("LAST_CARD") || state.lastAction?.includes("CHECK") || state.lastAction?.includes("PICK");
  const play = (card: CardData) => {
    if (card.suit === "whot") {
      setPendingWhotCard(card);
      return;
    }
    void action({ action: "play", cardId: card.id });
  };
  const chooseSuit = (calledSuit: string) => {
    if (!pendingWhotCard) return;
    void action({ action: "play", cardId: pendingWhotCard.id, calledSuit });
    setPendingWhotCard(null);
  };
  return <div className="grid gap-6"><Link href="/games" className="text-sm text-indigo-300">← Back to games</Link><header><h1 className="text-3xl font-semibold">Whot room</h1><p className="text-sm text-muted">{state.status} · {state.lastAction ?? "Waiting for action"}</p>{state.status === "active" && <p className="mt-2 text-sm text-pink-300">{yourTurn ? "You are playing" : "Opponent is playing"}</p>}{state.calledSuit && <p className="mt-2 text-sm text-pink-300">Called suit: {state.calledSuit}</p>}{special && <p role="status" className="mt-2 text-sm text-amber-300">Special effect: {state.lastAction}</p>}</header>{state.status === "lobby" && <Card className="flex flex-wrap gap-3"><Button onClick={() => void action({ action: "start" })}>Start game</Button><Button variant="secondary" onClick={() => void action({ action: "ready" })}>Ready</Button></Card>}{state.status === "finished" && <Card className="flex flex-wrap items-center gap-3"><p className="font-semibold">Winner: {state.winnerId === player?.id ? "You" : "Opponent"}</p><Button onClick={() => void action({ action: "rematch" })}>Rematch</Button></Card>}<div className="grid gap-4 md:grid-cols-[1fr_auto_1fr]"><Card><p className="mb-3 text-sm text-muted">{yourTurn ? "Your hand" : "Your hand · waiting for opponent"}</p><div className="flex flex-wrap gap-2">{player?.hand.map((card) => <button aria-label={`Play ${card.suit} ${card.value}`} key={card.id} draggable={yourTurn} onDragStart={(event) => event.dataTransfer.setData("text/plain", card.id)} onDragEnd={(event) => event.dataTransfer.clearData()} disabled={!yourTurn} onClick={() => play(card)} className="touch-manipulation rounded-xl transition hover:-translate-y-1 disabled:opacity-50"><CardFace card={card} /></button>)}</div><Button className="mt-4" variant="secondary" disabled={!yourTurn} onClick={() => void action({ action: "draw" })}>Draw</Button>{yourTurn && player?.hand.length === 1 && <Button className="mt-4 ml-2" variant="secondary" onClick={() => void action({ action: "check" })}>Check</Button>}{pendingWhotCard && <div className="mt-4 flex flex-wrap items-center gap-2"><span className="text-sm text-muted">Choose suit</span>{["circle", "triangle", "cross", "square", "star"].map((suit) => <Button key={suit} variant="secondary" onClick={() => chooseSuit(suit)}>{suit}</Button>)}</div>}</Card><Card><div onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const cardId = event.dataTransfer.getData("text/plain"); const card = player?.hand.find((entry) => entry.id === cardId); if (card) play(card); }} className="grid place-items-center"><p className="text-xs text-muted">Discard pile</p><div className="mt-2"><CardFace card={state.discardPile.at(-1) ?? { id: "empty", suit: "whot", value: 20 }} /></div><p className="mt-3 text-xs text-muted">Draw pile: {state.drawPile.length}</p><div className="mt-2"><CardFace card={{ id: "back", suit: "hidden", value: -1 }} back /></div><p className="mt-2 text-xs text-muted">{state.pendingDraw ? `Draw ${state.pendingDraw} or defend` : "Match suit or number"}</p></div></Card><Card><p className="text-sm text-muted">Opponent hand</p><div className="mt-3 flex flex-wrap gap-2">{opponent?.hand.map((card) => <CardFace key={card.id} card={card} back />)}</div><p className="mt-2 text-sm text-muted">{yourTurn ? "You are playing" : "Opponent is playing"}</p></Card></div><Card><p className="mb-2 text-sm text-muted">Game chat</p><form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); const input = event.currentTarget.elements.namedItem("message"); if (input instanceof HTMLInputElement && input.value.trim()) { void action({ action: "chat", message: input.value.trim() }); input.value = ""; } }}><input name="message" aria-label="Game chat message" className="min-h-11 flex-1 rounded-xl border border-white/10 bg-white/[.04] px-3 text-slate-100" placeholder="Say something..." /><Button type="submit">Send</Button></form></Card>{error && <p role="alert" className="text-sm text-red-300">{error}</p>}</div>;
}
