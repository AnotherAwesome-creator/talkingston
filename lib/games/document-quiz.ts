import { z } from "zod";
import { validateQuestions, type TriviaQuestion } from "@/lib/games/trivia";

export const supportedDocumentTypes = ["application/pdf", "text/plain", "text/markdown"] as const;
export const documentQuizInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(100000),
});

export function validateDocument(file: { type: string; size: number }) {
  return supportedDocumentTypes.includes(file.type as typeof supportedDocumentTypes[number]) && file.size > 0 && file.size <= 10 * 1024 * 1024;
}

export function extractText(buffer: Buffer, type: string) {
  if (!supportedDocumentTypes.includes(type as typeof supportedDocumentTypes[number])) throw new Error("Unsupported document type.");
  const text = type === "text/plain" || type === "text/markdown" ? buffer.toString("utf8") : buffer.toString("utf8").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, " ");
  if (!text.trim()) throw new Error("Document contains no extractable text.");
  return text.slice(0, 100000);
}

export function validateGeneratedQuiz(input: unknown): TriviaQuestion[] {
  const result = validateQuestions(input);
  if (!result.success) throw new Error("Generated quiz data is invalid.");
  return result.data;
}
