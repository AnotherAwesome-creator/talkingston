import { z } from "zod";

export const triviaQuestionSchema = z.object({
  id: z.string().min(1).max(100),
  question: z.string().trim().min(1).max(2000),
  options: z.array(z.string().trim().min(1).max(500)).length(4),
  correctOptionIndex: z.number().int().min(0).max(3),
  explanation: z.string().trim().max(2000),
  category: z.string().trim().min(1).max(100),
  difficulty: z.enum(["easy", "medium", "hard"]),
  timerMs: z.number().int().min(5000).max(120000).default(15000),
  metadata: z.record(z.string(), z.string()).default({}),
});
export type TriviaQuestion = z.infer<typeof triviaQuestionSchema>;

export type TriviaSubmission = { userId: string; questionId: string; optionIndex: number; submittedAtMs: number };
export type TriviaScore = { correct: boolean; points: number; streak: number };

const basePoints = { easy: 100, medium: 150, hard: 200 } as const;

export function validateQuestions(input: unknown) {
  return z.array(triviaQuestionSchema).min(1).max(100).safeParse(input);
}

export function scoreAnswer(question: TriviaQuestion, optionIndex: number, elapsedMs: number, streak: number): TriviaScore {
  const correct = optionIndex === question.correctOptionIndex && elapsedMs >= 0 && elapsedMs <= question.timerMs;
  if (!correct) return { correct: false, points: 0, streak: 0 };
  const remaining = Math.max(0, question.timerMs - elapsedMs);
  const speedBonus = Math.floor((remaining / question.timerMs) * 50);
  const nextStreak = Math.min(streak + 1, 5);
  return { correct: true, points: basePoints[question.difficulty] + speedBonus + nextStreak * 10, streak: nextStreak };
}

export function rankScores(scores: Record<string, number>) {
  return Object.entries(scores).sort((left, right) => right[1] - left[1]).map(([userId, score], index) => ({ userId, score, rank: index + 1 }));
}

export function acceptSubmission(submissions: TriviaSubmission[], submission: TriviaSubmission) {
  if (submissions.some((entry) => entry.userId === submission.userId && entry.questionId === submission.questionId)) {
    throw new Error("Answer already submitted.");
  }
  if (!Number.isInteger(submission.optionIndex) || submission.optionIndex < 0 || submission.optionIndex > 3) {
    throw new Error("Invalid answer.");
  }
  return [...submissions, submission];
}
