"use client";

import { useState } from "react";
import { Button, Card, StateCard } from "@/components/ui";

type Quiz = { id: string; document_id: string; created_at: string };
type Question = { id: string; question: string; options: string[]; correctOptionIndex: number; explanation: string; category: string; difficulty: string };

export function DocumentQuiz() {
  const [documentId, setDocumentId] = useState("");
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [documentName, setDocumentName] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const upload = async (file: File) => {
    setBusy(true);
    setStatus("Extracting document...");
    try {
      const form = new FormData();
      form.set("file", file);
      const uploaded = await fetch("/api/documents", { method: "POST", body: form });
      const body = await uploaded.json();
      if (!uploaded.ok) throw new Error(body.error ?? "Upload failed.");
      setDocumentId(body.document.id);
      setDocumentName(body.document.name);
      setStatus("Generating quiz...");
      const generated = await fetch(`/api/documents/${body.document.id}/quiz`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ count: 5 }) });
      const generatedBody = await generated.json();
      if (!generated.ok) throw new Error(generatedBody.error ?? "Quiz generation failed.");
      setQuiz(generatedBody.quiz);
      setQuestions(generatedBody.questions);
      setStatus(`Generated ${generatedBody.questions.length} questions.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to create quiz.");
    } finally {
      setBusy(false);
    }
  };
  async function regenerate() {
    if (!documentId) return;
    setBusy(true);
    setStatus("Regenerating quiz...");
    try {
      const generated = await fetch(`/api/documents/${documentId}/quiz`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ count: 5 }) });
      const generatedBody = await generated.json();
      if (!generated.ok) throw new Error(generatedBody.error ?? "Quiz generation failed.");
      setQuiz(generatedBody.quiz);
      setQuestions(generatedBody.questions);
      setStatus(`Generated ${generatedBody.questions.length} questions.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to regenerate quiz.");
    } finally {
      setBusy(false);
    }
  }
  return <div className="grid max-w-2xl gap-6"><header><p className="text-sm font-semibold text-cyan-300">DOCUMENT QUIZ</p><h1 className="mt-2 text-3xl font-semibold">Study from a document</h1><p className="mt-2 text-muted">Upload a private PDF, TXT, or Markdown document to generate a validated quiz.</p></header><Card><label className="grid gap-3 text-sm font-medium">Choose a document<input type="file" accept=".pdf,.txt,.md,text/plain,text/markdown,application/pdf" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} /></label>{status && <p role="status" className="mt-4 text-sm text-slate-300">{status}</p>}</Card>{quiz ? <><Card><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">Quiz ready</p><p className="mt-2 text-sm text-muted">{documentName} · saved privately · {questions.length} questions</p></div><div className="flex gap-2"><Button variant="secondary" loading={busy} onClick={() => void regenerate()}>Regenerate</Button><Button onClick={() => { setQuiz(null); setQuestions([]); }}>Generate another</Button></div></div></Card><div className="grid gap-4">{questions.map((item, index) => <Card key={item.id}><p className="text-xs uppercase tracking-wide text-cyan-300">Question {index + 1} · {item.difficulty}</p><h2 className="mt-2 font-semibold">{item.question}</h2><ol className="mt-3 grid gap-2 text-sm text-slate-300">{item.options.map((option, optionIndex) => <li key={option} className={optionIndex === item.correctOptionIndex ? "rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-2" : "rounded-lg border border-white/10 p-2"}>{option}</li>)}</ol><p className="mt-3 text-sm text-muted">{item.explanation}</p></Card>)}</div></> : !documentId && <StateCard title="No quiz yet" description="Your generated quiz will appear here after processing." />}</div>;
}
