"use client";

import { useState } from "react";
import { Button, Card, StateCard } from "@/components/ui";

type Quiz = { id: string; document_id: string; created_at: string };

export function DocumentQuiz() {
  const [documentId, setDocumentId] = useState("");
  const [quiz, setQuiz] = useState<Quiz | null>(null);
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
      setStatus("Generating quiz...");
      const generated = await fetch(`/api/documents/${body.document.id}/quiz`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ count: 5 }) });
      const generatedBody = await generated.json();
      if (!generated.ok) throw new Error(generatedBody.error ?? "Quiz generation failed.");
      setQuiz(generatedBody.quiz);
      setStatus(`Generated ${generatedBody.questions.length} questions.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to create quiz.");
    } finally {
      setBusy(false);
    }
  };
  return <div className="grid max-w-2xl gap-6"><header><p className="text-sm font-semibold text-cyan-300">DOCUMENT QUIZ</p><h1 className="mt-2 text-3xl font-semibold">Study from a document</h1><p className="mt-2 text-muted">Upload a private PDF, TXT, or Markdown document to generate a validated quiz.</p></header><Card><label className="grid gap-3 text-sm font-medium">Choose a document<input type="file" accept=".pdf,.txt,.md,text/plain,text/markdown,application/pdf" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} /></label>{status && <p role="status" className="mt-4 text-sm text-slate-300">{status}</p>}</Card>{quiz ? <Card><p className="font-semibold">Quiz ready</p><p className="mt-2 text-sm text-muted">Quiz {quiz.id.slice(0, 8)} is saved privately to your account.</p><Button className="mt-4" onClick={() => setQuiz(null)}>Generate another</Button></Card> : !documentId && <StateCard title="No quiz yet" description="Your generated quiz will appear here after processing." />}</div>;
}
