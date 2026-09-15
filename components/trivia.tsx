"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, StateCard } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type Room = { id: string; status: string };
type Question = { id: string; question: string; options: string[]; category: string; difficulty: string; timerMs: number };
type RoomState = { question: Question; scores: Array<{ userId: string; score: number; rank: number }>; locked: boolean; answered: boolean; waitingForPlayers: boolean; finished: boolean; startedAtMs: number | null };

async function request<T>(url: string, options?: RequestInit) {
  const response = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Trivia request failed.");
  return body as T;
}

const sampleQuestions = [{ id: "welcome", question: "Which number follows 2?", options: ["1", "3", "4", "5"], correctOptionIndex: 1, explanation: "Counting onward from two gives three.", category: "General", difficulty: "easy", timerMs: 15000, metadata: {} }];

export function TriviaLobby() {
  const [room, setRoom] = useState<Room | null>(null);
  const [roomId, setRoomId] = useState("");
  const [error, setError] = useState("");
  const create = async () => { try { setRoom((await request<{ room: Room }>("/api/trivia/rooms", { method: "POST", body: JSON.stringify({ questions: sampleQuestions }) })).room); } catch (err) { setError(err instanceof Error ? err.message : "Unable to create trivia room."); } };
  if (room) return <TriviaRoom roomId={room.id} />;
  return <div className="grid gap-6"><header><p className="text-sm font-semibold text-cyan-300">TRIVIA</p><h1 className="mt-2 text-3xl font-semibold">Trivia room</h1><p className="mt-2 text-muted">Deterministic answers, scoring, and rankings.</p></header><Card className="grid gap-3"><Button onClick={() => void create()}>Create room</Button><div className="flex gap-2"><input aria-label="Trivia room ID" value={roomId} onChange={(event) => setRoomId(event.target.value)} placeholder="Paste room ID" className="min-h-11 flex-1 rounded-xl border border-white/10 bg-white/[.04] px-3" /><Button variant="secondary" onClick={() => setRoom({ id: roomId, status: "lobby" })} disabled={!roomId}>Join</Button></div>{error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}</Card></div>;
}

function TriviaRoom({ roomId }: { roomId: string }) {
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => { try { const result = await request<{ room: RoomState }>(`/api/trivia/rooms/${roomId}`); setRoomState(result.room); } catch (err) { setMessage(err instanceof Error ? err.message : "Unable to load quiz."); } }, [roomId]);
  useEffect(() => { const timer = window.setTimeout(() => { void request(`/api/trivia/rooms/${roomId}`, { method: "POST", body: JSON.stringify({ action: "join" }) }).then(() => load()).catch(() => load()); }, 0); return () => window.clearTimeout(timer); }, [roomId, load]);
  useEffect(() => {
    const client = createClient();
    const channel = client.channel(`trivia:${roomId}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "trivia_rooms", filter: `id=eq.${roomId}` }, () => void load()).subscribe();
    const timer = window.setInterval(() => void load(), 3000);
    return () => { window.clearInterval(timer); void client.removeChannel(channel); };
  }, [roomId, load]);
  const start = async () => { await request(`/api/trivia/rooms/${roomId}`, { method: "POST", body: JSON.stringify({ action: "start" }) }); await load(); };
  const answer = async (index: number) => { try { await request(`/api/trivia/rooms/${roomId}`, { method: "POST", body: JSON.stringify({ action: "answer", questionId: roomState?.question.id, optionIndex: index }) }); setMessage("Answer locked."); await load(); } catch (err) { setMessage(err instanceof Error ? err.message : "Unable to submit answer."); } };
  if (!roomState) return <StateCard title="Loading trivia" description={message || "Preparing the next question..."} />;
  const question = roomState.question;
  return <div className="grid max-w-2xl gap-6"><Link href="/trivia" className="text-sm text-indigo-300">← Trivia lobby</Link><Card><p className="text-sm text-muted">{question.category} · {question.difficulty} · {question.timerMs / 1000}s</p><h1 className="mt-3 text-2xl font-semibold">{roomState.finished ? "Results" : question.question}</h1>{!roomState.finished && !roomState.answered && <div className="mt-5 grid gap-3">{question.options.map((option, index) => <Button key={option} disabled={roomState.locked} variant="secondary" onClick={() => void answer(index)}>{option}</Button>)}</div>}<p className="mt-4 text-sm text-muted">{roomState.finished ? "Results" : roomState.answered ? "Waiting for another player" : roomState.waitingForPlayers ? "Waiting for you" : "Waiting for you"}</p><ol className="mt-4 grid gap-1 text-sm">{roomState.scores.map((score) => <li key={score.userId}>#{score.rank} {score.userId}: {score.score}</li>)}</ol><Button className="mt-5" onClick={() => void start()}>Start / rematch</Button>{message && <p role="status" className="mt-3 text-sm text-emerald-300">{message}</p>}</Card></div>;
}
