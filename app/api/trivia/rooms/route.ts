import { NextResponse } from "next/server";
import { z } from "zod";
import { getSocialUser } from "@/lib/social/server";
import { triviaQuestionSchema } from "@/lib/games/trivia";

const createSchema = z.object({ questions: z.array(triviaQuestionSchema).min(1).max(50) }).strict();

export async function GET() {
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabase.from("trivia_rooms").select("id, owner_id, status, version, created_at").eq("owner_id", user.id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Unable to load trivia rooms." }, { status: 500 });
  return NextResponse.json({ rooms: data ?? [] });
}

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid trivia questions." }, { status: 400 });
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = crypto.randomUUID();
  const { error } = await supabase.from("trivia_rooms").insert({ id, owner_id: user.id, questions: parsed.data.questions, state: { index: 0, submissions: [] } });
  if (error) return NextResponse.json({ error: "Unable to create trivia room." }, { status: 500 });
  const { error: playerError } = await supabase.from("trivia_players").insert({ room_id: id, user_id: user.id });
  if (playerError) return NextResponse.json({ error: "Unable to join trivia room." }, { status: 500 });
  return NextResponse.json({ room: { id, status: "lobby" } }, { status: 201 });
}
