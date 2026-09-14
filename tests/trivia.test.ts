import { describe, expect, it } from "vitest";
import { acceptSubmission, advanceQuestion, createTriviaState, rankScores, scoreAnswer, startQuestion, submitAnswer, triviaQuestionSchema, validateQuestions } from "@/lib/games/trivia";
import { extractText, validateDocument, validateGeneratedQuiz } from "@/lib/games/document-quiz";

const question = triviaQuestionSchema.parse({
  id: "q1", question: "Two plus two?", options: ["3", "4", "5", "6"], correctOptionIndex: 1,
  explanation: "Basic arithmetic.", category: "math", difficulty: "easy", timerMs: 10000, metadata: {},
});

describe("deterministic trivia", () => {
  it("validates questions and rejects malformed options", () => {
    expect(validateQuestions([question]).success).toBe(true);
    expect(validateQuestions([{ ...question, options: ["one"] }]).success).toBe(false);
  });
  it("scores correct answers deterministically and zeros late/wrong answers", () => {
    expect(scoreAnswer(question, 1, 1000, 0)).toEqual({ correct: true, points: 155, streak: 1 });
    expect(scoreAnswer(question, 0, 1000, 0).points).toBe(0);
    expect(scoreAnswer(question, 1, 10001, 0).streak).toBe(0);
  });
  it("prevents duplicate submissions and ranks scores", () => {
    const first = [{ userId: "a", questionId: "q1", optionIndex: 1, submittedAtMs: 1 }];
    expect(() => acceptSubmission(first, first[0])).toThrow("already");
    expect(rankScores({ a: 4, b: 9 })[0].userId).toBe("b");
  });
  it("locks, scores, advances, and finishes a room deterministically", () => {
    const started = startQuestion(createTriviaState(), 1000);
    const result = submitAnswer(started, question, { userId: "a", questionId: "q1", optionIndex: 1, submittedAtMs: 1000 });
    expect(result.state.locked).toBe(true);
    expect(result.score.points).toBe(155);
    expect(advanceQuestion(result.state, 1).finished).toBe(true);
  });
  it("accepts bounded TXT/Markdown/PDF extraction", () => {
    expect(validateDocument({ type: "text/plain", size: 4 })).toBe(true);
    expect(validateDocument({ type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 4 })).toBe(false);
    expect(extractText(Buffer.from("# Hello"), "text/markdown")).toBe("# Hello");
    expect(() => validateGeneratedQuiz([{ ...question, correctOptionIndex: 9 }])).toThrow("invalid");
  });
});
