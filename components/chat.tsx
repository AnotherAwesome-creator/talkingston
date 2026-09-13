"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Plus, Send, Trash2, X } from "lucide-react";
import { Button, Card, Input, StateCard } from "@/components/ui";

type Conversation = { id: string; title: string; is_pinned: boolean };
type Message = { id?: string; sender: "user" | "assistant"; content: string };

export function ChatExperience() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    setLoading(true); setError("");
    const response = await fetch("/api/conversations");
    if (!response.ok) { setError("Unable to load conversations."); setLoading(false); return; }
    const data = await response.json() as { conversations: Conversation[] };
    setConversations(data.conversations);
    if (data.conversations[0]) {
      setActiveId(data.conversations[0].id);
      const firstResponse = await fetch(`/api/conversations/${data.conversations[0].id}`);
      if (firstResponse.ok) {
        const firstData = await firstResponse.json() as { messages: Message[] };
        setMessages(firstData.messages);
      }
    }
    setLoading(false);
  }, []);
  async function openConversation(id: string) {
    setActiveId(id);
    const response = await fetch(`/api/conversations/${id}`);
    if (!response.ok) { setError("Unable to open that conversation."); return; }
    const data = await response.json() as { messages: Message[] };
    setMessages(data.messages);
  }
  async function createConversation() {
    const response = await fetch("/api/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    if (!response.ok) { setError("Unable to create a conversation."); return; }
    const data = await response.json() as { conversation: Conversation };
    setConversations((current) => [data.conversation, ...current]); setActiveId(data.conversation.id); setMessages([]);
  }
  async function deleteConversation(id: string) {
    const response = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (!response.ok) { setError("Unable to delete that conversation."); return; }
    const next = conversations.filter((conversation) => conversation.id !== id);
    setConversations(next);
    if (id === activeId) { setActiveId(next[0]?.id ?? ""); setMessages([]); if (next[0]) await openConversation(next[0].id); }
  }
  async function renameConversation(id: string, title: string) {
    if (!title.trim()) return;
    const response = await fetch(`/api/conversations/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
    if (!response.ok) { setError("Unable to rename that conversation."); return; }
    setConversations((current) => current.map((conversation) => conversation.id === id ? { ...conversation, title } : conversation)); setEditingId("");
  }
  async function sendMessage(event: React.FormEvent) {
    event.preventDefault(); const message = input.trim();
    if (!message || !activeId || sending) return;
    setInput(""); setError(""); setSending(true); setMessages((current) => [...current, { sender: "user", content: message }, { sender: "assistant", content: "" }]);
    try {
      const response = await fetch("/api/chat/completions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: activeId, message }) });
      if (!response.ok || !response.body) throw new Error("Talkingston is unavailable right now.");
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
      while (true) {
        const result = await reader.read(); if (result.done) break;
        buffer += decoder.decode(result.value, { stream: true });
        for (const line of buffer.split("\n")) {
          if (!line.startsWith("data: ") || line.includes("[DONE]")) continue;
          const parsed = JSON.parse(line.slice(6)) as { chunk: string };
          setMessages((current) => { const copy = [...current]; copy[copy.length - 1] = { sender: "assistant", content: copy[copy.length - 1].content + parsed.chunk }; return copy; });
        }
        buffer = buffer.slice(buffer.lastIndexOf("\n") + 1);
      }
    } catch (caught) { setMessages((current) => current.slice(0, -1)); setError(caught instanceof Error ? caught.message : "Unable to send message."); } finally { setSending(false); }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadConversations(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadConversations]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  if (loading) return <Card><div className="animate-pulse text-sm text-muted">Loading your conversations…</div></Card>;
  return <div className="grid min-h-[calc(100vh-9rem)] gap-4 lg:grid-cols-[280px_1fr]"><Card className="hidden min-h-0 p-3 lg:block"><div className="flex items-center justify-between px-2"><span className="text-sm font-semibold">Conversations</span><button onClick={createConversation} className="rounded-lg p-2 text-indigo-300 hover:bg-white/[.06]" aria-label="New conversation"><Plus className="h-4 w-4" /></button></div><div className="mt-3 grid gap-1">{conversations.map((conversation) => <div key={conversation.id} className={`group flex items-center gap-1 rounded-xl ${activeId === conversation.id ? "bg-indigo-500/15" : "hover:bg-white/[.05]"}`}><button onClick={() => openConversation(conversation.id)} className="min-w-0 flex-1 truncate px-3 py-3 text-left text-sm text-slate-300">{editingId === conversation.id ? <input autoFocus defaultValue={conversation.title} onBlur={(event) => void renameConversation(conversation.id, event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void renameConversation(conversation.id, event.currentTarget.value); }} className="w-full bg-transparent outline-none" /> : conversation.title}</button><button onClick={() => setEditingId(conversation.id)} className="hidden p-2 text-xs text-slate-500 group-hover:block" aria-label={`Rename ${conversation.title}`}>Edit</button><button onClick={() => void deleteConversation(conversation.id)} className="hidden p-2 text-slate-500 group-hover:block" aria-label={`Delete ${conversation.title}`}><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div></Card><Card className="flex min-h-[70vh] flex-col p-0"><div className="flex items-center justify-between border-b border-white/10 p-4"><div className="flex items-center gap-3"><MessageCircle className="h-5 w-5 text-indigo-300" /><div><h1 className="font-semibold">{conversations.find((conversation) => conversation.id === activeId)?.title ?? "Your companion"}</h1><p className="text-xs text-muted">A private, thoughtful space</p></div></div><button onClick={() => void createConversation()} className="rounded-lg p-2 text-indigo-300 hover:bg-white/[.06] lg:hidden" aria-label="New conversation"><Plus className="h-5 w-5" /></button></div>{!activeId ? <div className="grid flex-1 place-items-center p-6"><StateCard title="Start a conversation" description="Say hello, ask a question, or share what is on your mind." action={<Button onClick={() => void createConversation()}>New conversation</Button>} /></div> : <><div className="scrollbar-thin flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">{messages.length === 0 && <div className="grid h-full place-items-center"><p className="text-center text-sm text-muted">I&apos;m here when you&apos;re ready. What would you like to talk about?</p></div>}{messages.map((message, index) => <div key={message.id ?? index} className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${message.sender === "user" ? "bg-indigo-500 text-white" : "border border-white/10 bg-white/[.04] text-slate-200"}`}>{message.content || <span className="animate-pulse">Thinking…</span>}</div></div>)}<div ref={bottomRef} /></div><div className="border-t border-white/10 p-4"><form onSubmit={sendMessage} className="flex gap-2"><Input aria-label="Message Talkingston" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Talk to Talkingston…" disabled={sending || !activeId} className="min-w-0 flex-1" /><Button type="submit" loading={sending} aria-label="Send message"><Send className="h-4 w-4" /><span className="hidden sm:inline">Send</span></Button></form>{error && <div className="mt-3 flex items-center justify-between rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-xs text-red-200" role="alert">{error}<button onClick={() => setError("")} aria-label="Dismiss error"><X className="h-4 w-4" /></button></div>}</div></>}</Card></div>;
}
