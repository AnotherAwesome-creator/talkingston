import { NextResponse } from "next/server";
import { z } from "zod";
import { acceptSubmission, rankScores, scoreAnswer, type TriviaQuestion } from "@/lib/games/trivia";
import { getSocialUser } from "@/lib/social/server";

const actionSchema = z.object({ action: z.enum(["join", "start", "answer", "rematch"]), questionId: z.string().optional(), optionIndex: z.number().int().min(0).max(3).optional(), submittedAtMs: z.number().int().optional() }).strict();

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid room." }, { status: 400 });
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabase.from("trivia_rooms").select("id, owner_id, status, questions, state, version").eq("id", id).single();
  if (error || !data) return NextResponse.json({ error: "Room not found." }, { status: 404 });
  const state = data.state as { index?: number; submissions?: Array<{ userId: string; questionId: string; optionIndex: number; submittedAtMs: number }> };
  const questions = data.questions as TriviaQuestion[];
  const current = questions[state.index ?? 0];
  return NextResponse.json({ room: { id: data.id, owner_id: data.owner_id, status: data.status, version: data.version, question: data.status === "active" ? { ...current, correctOptionIndex: undefined, explanation: undefined } : current, scores: rankScores({}) } });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = actionSchema.safeParse(await request.json());
  const { id } = await params;
  if (!parsed.success || !z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid trivia action." }, { status: 400 });
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: room, error } = await supabase.from("trivia_rooms").select("id, owner_id, status, questions, state, version").eq("id", id).single();
  if (error || !room) return NextResponse.json({ error: "Room not found." }, { status: 404 });
  if (parsed.data.action === "join") {
    const { error: joinError } = await supabase.from("trivia_players").upsert({ room_id: id, user_id: user.id });
    if (joinError) return NextResponse.json({ error: "Unable to join room." }, { status: 409 });
    return NextResponse.json({ success: true });
  }
  if (room.owner_id !== user.id && parsed.data.action !== "answer") return NextResponse.json({ error: "Only the room owner can control this room." }, { status: 403 });
  const state = room.state as { index: number; submissions: Array<{ userId: string; questionId: string; optionIndex: number; submittedAtMs: number }> };
  if (parsed.data.action === "start" || parsed.data.action === "rematch") {
    const { data: updated, error: updateError } = await supabase.from("trivia_rooms").update({ status: "active", state: { index: 0, submissions: [] }, version: room.version + 1 }).eq("id", id).eq("version", room.version).select("version").maybeSingle();
    if (updateError || !updated) return NextResponse.json({ error: "Room changed; reload and try again." }, { status: 409 });
    return NextResponse.json({ success: true, version: updated.version });
  }
  if (!parsed.data.questionId || parsed.data.optionIndex === undefined || parsed.data.submittedAtMs === undefined) return NextResponse.json({ error: "Answer is incomplete." }, { status: 400 });
  const question = (room.questions as TriviaQuestion[]).find((entry) => entry.id === parsed.data.questionId);
  if (!question || question.id !== (room.questions as TriviaQuestion[])[state.index]?.id) return NextResponse.json({ error: "Question is not active." }, { status: 409 });
  try {
    const submissions = acceptSubmission(state.submissions ?? [], { userId: user.id, questionId: question.id, optionIndex: parsed.data.optionIndex, submittedAtMs: parsed.data.submittedAtMs });
    const { error: answerError } = await supabase.from("trivia_answers").insert({ room_id: id, user_id: user.id, question_id: question.id, option_index: parsed.data.optionIndex, submitted_at_ms: parsed.data.submittedAtMs });
    if (answerError) return NextResponse.json({ error: "Answer already submitted." }, { status: 409 });
    const score = scoreAnswer(question, parsed.data.optionIndex, parsed.data.submittedAtMs, 0);
    const { error: stateError } = await supabase.from("trivia_rooms").update({ state: { ...state, submissions }, version: room.version + 1 }).eq("id", id).eq("version", room.version);
    if (stateError) return NextResponse.json({ error: "Room changed; reload and try again." }, { status: 409 });
    return NextResponse.json({ success: true, score });
  } catch (actionError) {
    return NextResponse.json({ error: actionError instanceof Error ? actionError.message : "Invalid answer." }, { status: 409 });
  }
}
