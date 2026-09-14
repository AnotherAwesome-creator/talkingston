"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, StateCard } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type Room = { id: string; owner_id: string; status: string; version: number };
type CardData = { id: string; suit: string; value: number };
type GameState = { players: Array<{ id: string; hand: CardData[] }>; discardPile: CardData[]; drawPile: CardData[]; currentPlayer: number; status: string; lastAction: string | null; calledSuit?: string | null; winnerId?: string | null; pendingDraw?: number };

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
  const [error, setError] = useState("");
  const load = useCallback(async () => { try { setState((await json<{ room: { state: GameState } }>(`/api/whot/rooms/${roomId}`)).room.state); } catch (err) { setError(err instanceof Error ? err.message : "Unable to load room."); } }, [roomId]);
  useEffect(() => { const initial = window.setTimeout(() => void load(), 0); const timer = window.setInterval(() => void load(), 3000); return () => { window.clearTimeout(initial); window.clearInterval(timer); }; }, [load]);
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
  const player = state.players[0];
  const yourTurn = state.currentPlayer === 0 && state.status === "active";
  const special = state.lastAction?.includes("WHOT") || state.lastAction?.includes("LAST_CARD") || state.lastAction?.includes("CHECK") || state.lastAction?.includes("PICK");
  return <div className="grid gap-6"><Link href="/games" className="text-sm text-indigo-300">← Back to games</Link><header><h1 className="text-3xl font-semibold">Whot room</h1><p className="text-sm text-muted">{state.status} · {state.lastAction ?? "Waiting for action"}</p>{state.calledSuit && <p className="mt-2 text-sm text-pink-300">Called suit: {state.calledSuit}</p>}{special && <p role="status" className="mt-2 text-sm text-amber-300">Special effect: {state.lastAction}</p>}</header>{state.status === "lobby" && <Card className="flex flex-wrap gap-3"><Button onClick={() => void action({ action: "start" })}>Start game</Button><Button variant="secondary" onClick={() => void action({ action: "ready" })}>Ready</Button></Card>}{state.status === "finished" && <Card className="flex flex-wrap items-center gap-3"><p className="font-semibold">Winner: {state.winnerId === player?.id ? "You" : "Opponent"}</p><Button onClick={() => void action({ action: "rematch" })}>Rematch</Button></Card>}<div className="grid gap-4 md:grid-cols-[1fr_auto_1fr]"><Card><p className="mb-3 text-sm text-muted">{yourTurn ? "Your turn" : "Your hand"}</p><div className="flex flex-wrap gap-2">{player?.hand.map((card) => <button aria-label={`Play ${card.suit} ${card.value}`} key={card.id} disabled={!yourTurn} onClick={() => void action({ action: "play", cardId: card.id, ...(card.suit === "whot" ? { calledSuit: "circle" } : {}) })} className="grid min-h-24 w-16 place-items-center rounded-xl border border-indigo-300/30 bg-indigo-500/20 p-2 text-center text-sm font-semibold transition hover:-translate-y-1 hover:bg-indigo-500/40 disabled:opacity-50"><span>{card.suit}</span><span>{card.value === 20 ? "W" : card.value}</span></button>)}</div><Button className="mt-4" variant="secondary" disabled={!yourTurn} onClick={() => void action({ action: "draw" })}>Draw</Button></Card><Card className="grid place-items-center"><p className="text-xs text-muted">Discard</p><div className="mt-2 grid h-28 w-20 place-items-center rounded-xl border border-pink-300/30 bg-pink-500/20 text-xl font-bold">{state.discardPile.at(-1)?.value}</div><p className="mt-3 text-xs text-muted">Market: {state.drawPile.length}</p><p className="mt-2 text-xs text-muted">{state.pendingDraw ? `Draw ${state.pendingDraw} or defend` : "Match suit or number"}</p></Card><Card><p className="text-sm text-muted">Opponent</p><p className="mt-2 text-2xl font-semibold">{state.players[1]?.hand.length ?? 0} cards</p><p className="mt-2 text-sm text-muted">{state.currentPlayer === 0 ? "Your turn" : "Opponent turn"}</p></Card></div><Card><p className="mb-2 text-sm text-muted">Game chat</p><form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); const input = event.currentTarget.elements.namedItem("message"); if (input instanceof HTMLInputElement && input.value.trim()) { void action({ action: "chat", message: input.value.trim() }); input.value = ""; } }}><input name="message" aria-label="Game chat message" className="min-h-11 flex-1 rounded-xl border border-white/10 bg-white/[.04] px-3 text-slate-100" placeholder="Say something..." /><Button type="submit">Send</Button></form></Card>{error && <p role="alert" className="text-sm text-red-300">{error}</p>}</div>;
}
