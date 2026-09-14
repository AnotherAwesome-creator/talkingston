import { NextResponse } from "next/server";
import { z } from "zod";
import { validateGeneratedQuiz } from "@/lib/games/document-quiz";
import { triviaQuestionSchema } from "@/lib/games/trivia";
import { aiProviderRouter } from "@/lib/ai/router";
import { getSocialUser } from "@/lib/social/server";

const requestSchema = z.object({ count: z.number().int().min(1).max(20).default(5) }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));
  const { id } = await params;
  if (!parsed.success || !z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid quiz request." }, { status: 400 });
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: document, error } = await supabase.from("user_documents").select("id, name, extracted_text").eq("id", id).eq("owner_id", user.id).single();
  if (error || !document) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  const questionArray = z.array(triviaQuestionSchema).min(1).max(20);
  try {
    const { value } = await aiProviderRouter.generateStructured({
      task: "quiz_generation",
      messages: [
        { role: "system", content: "Create multiple-choice questions from the supplied document. Return only valid structured questions. Never invent facts not supported by the document." },
        { role: "user", content: `Create ${parsed.data.count} questions from:\n${document.extracted_text.slice(0, 100000)}` },
      ],
    }, questionArray);
    const questions = validateGeneratedQuiz(value);
    const { data: quiz, error: saveError } = await supabase.from("document_quizzes").insert({ owner_id: user.id, document_id: document.id, questions }).select("id, document_id, created_at").single();
    if (saveError) return NextResponse.json({ error: "Unable to save quiz." }, { status: 500 });
    return NextResponse.json({ quiz, questions }, { status: 201 });
  } catch (generationError) {
    return NextResponse.json({ error: generationError instanceof Error ? generationError.message : "Unable to generate quiz." }, { status: 422 });
  }
}
