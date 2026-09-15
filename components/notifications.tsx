"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Check, Trash2 } from "lucide-react";
import { Button, Card, StateCard } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type Notification = { id: string; title: string; body: string; target_route: string | null; read_at: string | null; created_at: string };

export function NotificationsExperience() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/notifications?limit=50");
    if (!response.ok) { setError("Unable to load notifications."); setLoading(false); return; }
    const data = await response.json() as { notifications: Notification[] };
    setItems(data.notifications); setLoading(false);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    const client = createClient();
    const channel = client.channel("notifications").on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => void load()).subscribe();
    return () => { void client.removeChannel(channel); };
  }, [load]);
  async function mark(id?: string) {
    const response = await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(id ? { action: "read", notificationId: id } : { action: "all_read" }) });
    if (!response.ok) { setError("Unable to update notifications."); return; }
    setItems((current) => id ? current.map((item) => item.id === id ? { ...item, read_at: new Date().toISOString() } : item) : current.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })));
  }
  async function remove(id: string) {
    const response = await fetch("/api/notifications", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notificationId: id }) });
    if (!response.ok) { setError("Unable to delete notification."); return; }
    setItems((current) => current.filter((item) => item.id !== id));
  }
  return <div className="grid gap-6"><header className="flex items-end justify-between gap-4"><div><p className="text-sm font-semibold text-indigo-300">UPDATES</p><h1 className="mt-2 text-3xl font-semibold">Notifications</h1><p className="mt-2 text-muted">A quiet record of things that need your attention.</p></div><Button variant="secondary" onClick={() => void mark()}><Check className="h-4 w-4" />Mark all read</Button></header>{error && <p role="alert" className="text-sm text-red-300">{error}</p>}{loading ? <Card><div className="animate-pulse text-sm text-muted">Loading notifications...</div></Card> : items.length === 0 ? <StateCard title="All caught up" description="New updates will appear here." action={<Bell className="mx-auto h-10 w-10 text-indigo-300/60" />} /> : <div className="grid gap-3">{items.map((item) => <Card key={item.id} className={item.read_at ? "opacity-70" : "border-indigo-400/30"}><div className="flex items-start gap-3"><Bell className="mt-1 h-5 w-5 text-indigo-300" /><div className="flex-1"><h2 className="font-semibold">{item.title}</h2><p className="mt-1 text-sm text-muted">{item.body}</p><p className="mt-2 text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</p></div>{!item.read_at && <Button variant="ghost" onClick={() => void mark(item.id)}>Read</Button>}<Button variant="ghost" aria-label={`Delete ${item.title}`} onClick={() => void remove(item.id)}><Trash2 className="h-4 w-4" /></Button></div></Card>)}</div>}</div>;
}
