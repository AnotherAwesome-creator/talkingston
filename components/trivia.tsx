"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, StateCard } from "@/components/ui";

type Room = { id: string; status: string };
type Question = { id: string; question: string; options: string[]; category: string; difficulty: string; timerMs: number };

async function request<T>(url: string, options?: RequestInit) {
  const response = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Trivia request failed.");
  return body as T;
}

const sampleQuestions = [{ id: "welcome", question: "Which number follows 2?", options: ["1", "3", "4", "5"], correctOptionIndex: 1, explanation: "Counting onward from two gives three.", category: "General", difficulty: "easy", timerMs: 15000, metadata: {} }];

export function TriviaLobby() {
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState("");
  const create = async () => { try { setRoom((await request<{ room: Room }>("/api/trivia/rooms", { method: "POST", body: JSON.stringify({ questions: sampleQuestions }) })).room); } catch (err) { setError(err instanceof Error ? err.message : "Unable to create trivia room."); } };
  if (room) return <TriviaRoom roomId={room.id} />;
  return <div className="grid gap-6"><header><p className="text-sm font-semibold text-cyan-300">TRIVIA</p><h1 className="mt-2 text-3xl font-semibold">Trivia room</h1><p className="mt-2 text-muted">Deterministic answers, scoring, and rankings.</p></header><Card><Button onClick={() => void create()}>Create room</Button>{error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}</Card></div>;
}

function TriviaRoom({ roomId }: { roomId: string }) {
  const [question, setQuestion] = useState<Question | null>(null);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => { try { setQuestion((await request<{ room: { question: Question } }>(`/api/trivia/rooms/${roomId}`)).room.question); } catch (err) { setMessage(err instanceof Error ? err.message : "Unable to load quiz."); } }, [roomId]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const start = async () => { await request(`/api/trivia/rooms/${roomId}`, { method: "POST", body: JSON.stringify({ action: "start" }) }); await load(); };
  const answer = async (index: number) => { try { await request(`/api/trivia/rooms/${roomId}`, { method: "POST", body: JSON.stringify({ action: "answer", questionId: question?.id, optionIndex: index, submittedAtMs: 1000 }) }); setMessage("Answer locked."); } catch (err) { setMessage(err instanceof Error ? err.message : "Unable to submit answer."); } };
  if (!question) return <StateCard title="Loading trivia" description={message || "Preparing the next question..."} />;
  return <div className="grid max-w-2xl gap-6"><Link href="/trivia" className="text-sm text-indigo-300">← Trivia lobby</Link><Card><p className="text-sm text-muted">{question.category} · {question.difficulty} · {question.timerMs / 1000}s</p><h1 className="mt-3 text-2xl font-semibold">{question.question}</h1><div className="mt-5 grid gap-3">{question.options.map((option, index) => <Button key={option} variant="secondary" onClick={() => void answer(index)}>{option}</Button>)}</div><Button className="mt-5" onClick={() => void start()}>Start / restart</Button>{message && <p role="status" className="mt-3 text-sm text-emerald-300">{message}</p>}</Card></div>;
}
