"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageCircle, UserPlus, UserRound, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, Button, Card, Input, StateCard } from "@/components/ui";
import { appendUniqueById } from "@/lib/social/state";

type Profile = { id: string; username: string; display_name: string; avatar_url?: string | null; bio?: string | null };
type Friendship = { id: string; status: string; direction: string; profile: Profile | null };

async function requestJson(url: string, options?: RequestInit) {
  const response = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Something went wrong.");
  return body;
}

function ProfileCard({ profile, action }: { profile: Profile; action?: React.ReactNode }) {
  return <Card className="flex items-center gap-3"><Avatar name={profile.display_name} src={profile.avatar_url} /><div className="min-w-0 flex-1"><p className="font-semibold">{profile.display_name}</p><p className="text-sm text-muted">@{profile.username}</p></div>{action}</Card>;
}

export function FriendsHub() {
  const [query, setQuery] = useState(""); const [results, setResults] = useState<Profile[]>([]);
  const [friends, setFriends] = useState<Friendship[]>([]); const [requests, setRequests] = useState<Friendship[]>([]);
  const [blocked, setBlocked] = useState<Friendship[]>([]); const [error, setError] = useState("");
  const load = useCallback(async () => { try { const [accepted, incoming, blockedResult] = await Promise.all([requestJson("/api/friends?status=accepted"), requestJson("/api/friends?status=pending"), requestJson("/api/friends?status=blocked")]); setFriends(accepted.friendships); setRequests(incoming.friendships.filter((item: Friendship) => item.direction === "incoming")); setBlocked(blockedResult.friendships); } catch (err) { setError(err instanceof Error ? err.message : "Unable to load friends."); } }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => { const timer = window.setTimeout(async () => { if (query.trim().length < 2) return setResults([]); try { setResults((await requestJson(`/api/users/search?q=${encodeURIComponent(query.trim())}`)).users); } catch (err) { setError(err instanceof Error ? err.message : "Search failed."); } }, 300); return () => window.clearTimeout(timer); }, [query]);
  const act = async (url: string, body: object) => { try { await requestJson(url, { method: "POST", body: JSON.stringify(body) }); await load(); } catch (err) { setError(err instanceof Error ? err.message : "Unable to update friendship."); } };
  return <div className="grid gap-6"><header><p className="text-sm font-semibold text-emerald-300">SOCIAL HUB</p><h1 className="mt-2 text-3xl font-semibold">Friends</h1><p className="mt-2 text-muted">Find your people, make plans, and stay connected.</p></header><Input aria-label="Search people" placeholder="Search by username or display name" value={query} onChange={(event) => setQuery(event.target.value)} /><div className="grid gap-3">{results.map((profile) => <ProfileCard key={profile.id} profile={profile} action={<Button variant="secondary" onClick={() => void act("/api/friends", { targetUserId: profile.id })}><UserPlus className="h-4 w-4" />Add</Button>} />)}</div>{error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}<section><h2 className="mb-3 text-xl font-semibold">Pending requests</h2>{requests.length ? <div className="grid gap-3">{requests.map((item) => item.profile && <ProfileCard key={item.id} profile={item.profile} action={<div className="flex gap-2"><Button onClick={() => void act("/api/friends/respond", { requestId: item.id, action: "accept" })}>Accept</Button><Button variant="ghost" onClick={() => void act("/api/friends/respond", { requestId: item.id, action: "decline" })}>Decline</Button></div>} />)}</div> : <StateCard title="No pending requests" description="New friend requests will appear here." />}</section><section><h2 className="mb-3 text-xl font-semibold">Friends</h2>{friends.length ? <div className="grid gap-3 md:grid-cols-2">{friends.map((item) => item.profile && <ProfileCard key={item.id} profile={item.profile} action={<div className="flex gap-2"><Link href={`/messages/${item.profile.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-500 px-4 text-sm font-semibold text-white"><MessageCircle className="h-4 w-4" />Message</Link><Button variant="danger" onClick={() => void act(`/api/friends/${item.id}`, { action: "remove" })}>Remove</Button></div>} />)}</div> : <StateCard title="Your circle starts here" description="Search for someone above to send your first request." action={<UserRound className="mx-auto h-10 w-10 text-emerald-300/60" />} />}</section>{blocked.length > 0 && <section><h2 className="mb-3 text-xl font-semibold">Blocked</h2><div className="grid gap-3">{blocked.map((item) => item.profile && <ProfileCard key={item.id} profile={item.profile} action={<Button variant="ghost" onClick={() => void act(`/api/friends/${item.id}`, { action: "unblock" })}>Unblock</Button>} />)}</div></section>}</div>;
}

type Message = { id: string; sender_id: string; recipient_id?: string; content: string; created_at: string };
function useRealtime(table: "direct_messages" | "group_messages", filter: string, onMessage: (message: Message) => void) {
  useEffect(() => {
    let client: ReturnType<typeof createClient> | null = null;
    try {
      client = createClient();
      const channel = client.channel(`social:${table}:${filter}`).on("postgres_changes", { event: "INSERT", schema: "public", table, filter }, (payload) => onMessage(payload.new as Message)).subscribe();
      return () => { void client?.removeChannel(channel); };
    } catch {
      return undefined;
    }
  }, [table, filter, onMessage]);
}

function MessageComposer({ onSend, placeholder }: { onSend: (content: string) => Promise<void>; placeholder: string }) {
  const [content, setContent] = useState(""); const [sending, setSending] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (!content.trim() || sending) return; setSending(true); try { await onSend(content.trim()); setContent(""); } finally { setSending(false); } };
  return <form onSubmit={submit} className="flex gap-2"><input className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[.04] px-3 text-sm text-slate-100 outline-none focus:border-indigo-400" value={content} onChange={(event) => setContent(event.target.value)} placeholder={placeholder} /><Button loading={sending}>Send</Button></form>;
}

export function DirectMessageView({ userId }: { userId: string }) {
  const [messages, setMessages] = useState<Message[]>([]); const [recipient, setRecipient] = useState<Profile | null>(null); const [error, setError] = useState("");
  const load = useCallback(async () => { try { const body = await requestJson(`/api/messages/direct?userId=${userId}`); setMessages(body.messages); setRecipient(body.recipient); } catch (err) { setError(err instanceof Error ? err.message : "Unable to load messages."); } }, [userId]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  const onRealtime = useMemo(() => (message: Message) => setMessages((current) => appendUniqueById(current, message)), []);
  useRealtime("direct_messages", `recipient_id=eq.${userId}`, onRealtime);
  const send = async (content: string) => { try { const body = await requestJson("/api/messages/direct", { method: "POST", body: JSON.stringify({ recipientId: userId, content }) }); setMessages((current) => current.some((item) => item.id === body.message.id) ? current : [...current, body.message]); } catch (err) { setError(err instanceof Error ? err.message : "Unable to send message."); } };
  if (error && !recipient) return <StateCard title="Conversation unavailable" description={error} />;
  return <div className="grid gap-4"><Link href="/friends" className="text-sm text-indigo-300">← Back to friends</Link><Card><div className="flex items-center gap-3"><Avatar name={recipient?.display_name} src={recipient?.avatar_url} /><div><h1 className="text-xl font-semibold">{recipient?.display_name ?? "Conversation"}</h1><p className="text-sm text-muted">@{recipient?.username}</p></div></div><div className="my-6 grid min-h-96 content-start gap-3">{messages.length ? messages.map((message) => <div key={message.id} className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${message.sender_id === userId ? "bg-white/[.06]" : "ml-auto bg-indigo-500/20"}`}>{message.content}<p className="mt-1 text-[10px] text-slate-500">{new Date(message.created_at).toLocaleTimeString()}</p></div>) : <StateCard title="Start the conversation" description="Say hello and make a plan." />}</div><MessageComposer onSend={send} placeholder="Write a message..." /></Card></div>;
}

export function GroupsHub() {
  const [groups, setGroups] = useState<Array<{ id: string; name: string; description?: string | null }>>([]); const [name, setName] = useState(""); const [error, setError] = useState("");
  const load = useCallback(async () => { try { setGroups((await requestJson("/api/groups")).groups); } catch (err) { setError(err instanceof Error ? err.message : "Unable to load groups."); } }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  const create = async (event: React.FormEvent) => { event.preventDefault(); try { await requestJson("/api/groups", { method: "POST", body: JSON.stringify({ name }) }); setName(""); await load(); } catch (err) { setError(err instanceof Error ? err.message : "Unable to create group."); } };
  return <div className="grid gap-6"><header><p className="text-sm font-semibold text-violet-300">PRIVATE GROUPS</p><h1 className="mt-2 text-3xl font-semibold">Groups</h1><p className="mt-2 text-muted">Small, private spaces for the people you trust.</p></header><Card><form onSubmit={create} className="flex gap-2"><Input className="min-w-0 flex-1" aria-label="Group name" placeholder="New group name" value={name} onChange={(event) => setName(event.target.value)} required /><Button><Users className="h-4 w-4" />Create group</Button></form></Card>{error && <p role="alert" className="text-sm text-red-300">{error}</p>}{groups.length ? <div className="grid gap-3 md:grid-cols-2">{groups.map((group) => <Link href={`/groups/${group.id}`} key={group.id}><Card className="transition hover:border-violet-300/40"><h2 className="font-semibold">{group.name}</h2><p className="mt-1 text-sm text-muted">{group.description || "Private group chat"}</p></Card></Link>)}</div> : <StateCard title="No groups yet" description="Create a private group for your circle." />}</div>;
}

export function GroupView({ groupId }: { groupId: string }) {
  const [group, setGroup] = useState<{ name: string; description?: string | null } | null>(null); const [messages, setMessages] = useState<Message[]>([]); const [error, setError] = useState("");
  const load = useCallback(async () => { try { const [details, messageBody] = await Promise.all([requestJson(`/api/groups/${groupId}`), requestJson(`/api/groups/${groupId}/messages`)]); setGroup(details.group); setMessages(messageBody.messages); } catch (err) { setError(err instanceof Error ? err.message : "Unable to load group."); } }, [groupId]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  const onRealtime = useMemo(() => (message: Message) => setMessages((current) => appendUniqueById(current, message)), []);
  useRealtime("group_messages", `group_id=eq.${groupId}`, onRealtime);
  const send = async (content: string) => { try { const body = await requestJson(`/api/groups/${groupId}/messages`, { method: "POST", body: JSON.stringify({ content }) }); setMessages((current) => current.some((item) => item.id === body.message.id) ? current : [...current, body.message]); } catch (err) { setError(err instanceof Error ? err.message : "Unable to send message."); } };
  if (!group) return <StateCard title="Group unavailable" description={error || "Loading group..."} />;
  return <div className="grid gap-4"><Link href="/groups" className="text-sm text-indigo-300">← Back to groups</Link><Card><h1 className="text-xl font-semibold">{group.name}</h1><p className="text-sm text-muted">{group.description}</p><div className="my-6 grid min-h-96 content-start gap-3">{messages.map((message) => <div key={message.id} className="rounded-2xl bg-white/[.06] px-4 py-3 text-sm">{message.content}</div>)}</div><MessageComposer onSend={send} placeholder="Message the group..." /></Card></div>;
}
