"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, MessageCircle, UserPlus, UserRound, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, Button, Card, Input, StateCard } from "@/components/ui";
import { appendUniqueById } from "@/lib/social/state";
import { MAX_DOCUMENT_BYTES, supportedDocumentTypes } from "@/lib/games/document-quiz";

type Profile = { id: string; username: string; display_name: string; avatar_url?: string | null; bio?: string | null };
type Friendship = { id: string; status: string; direction: string; profile: Profile | null };

async function requestJson(url: string, options?: RequestInit) {
  const response = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Something went wrong.");
  return body;
}

function ProfileCard({ profile, action }: { profile: Profile; action?: React.ReactNode }) {
  return <Card className="flex items-center gap-3"><Link href={`/users/${profile.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400"><Avatar name={profile.display_name} src={profile.avatar_url} /><div className="min-w-0"><p className="font-semibold">{profile.display_name}</p><p className="text-sm text-muted">@{profile.username}</p></div></Link>{action}</Card>;
}

export function PublicProfileView({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const load = async () => {
      try {
        setProfile((await requestJson(`/api/users/${userId}`)).user);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load profile.");
      }
    };
    void load();
  }, [userId]);
  if (error) return <StateCard title="Profile unavailable" description={error} />;
  if (!profile) return <StateCard title="Loading profile" description="Fetching public profile details..." />;
  return <div className="grid max-w-2xl gap-6"><Link href="/friends" className="text-sm text-indigo-300">← Back to friends</Link><Card className="grid gap-4"><div className="flex items-center gap-4"><Avatar name={profile.display_name} src={profile.avatar_url} /><div><h1 className="text-2xl font-semibold">{profile.display_name}</h1><p className="text-sm text-muted">@{profile.username}</p></div></div>{profile.bio && <p className="text-slate-300">{profile.bio}</p>}<Link href={`/messages/${profile.id}`} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-500 px-4 text-sm font-semibold text-white">Message</Link></Card></div>;
}

export function FriendsHub() {
  const [shareCode, setShareCode] = useState("");
  const [myFriendCode, setMyFriendCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [friends, setFriends] = useState<Friendship[]>([]); const [requests, setRequests] = useState<Friendship[]>([]);
  const [blocked, setBlocked] = useState<Friendship[]>([]); const [error, setError] = useState("");
  const load = useCallback(async () => { try { const [accepted, incoming, blockedResult] = await Promise.all([requestJson("/api/friends?status=accepted"), requestJson("/api/friends?status=pending"), requestJson("/api/friends?status=blocked")]); setMyFriendCode(accepted.shareCode ?? incoming.shareCode ?? blockedResult.shareCode ?? ""); setFriends(accepted.friendships); setRequests(incoming.friendships.filter((item: Friendship) => item.direction === "incoming")); setBlocked(blockedResult.friendships); } catch (err) { setError(err instanceof Error ? err.message : "Unable to load friends."); } }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => {
    const client = createClient();
    const channel = client.channel("friends-list").on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => void load()).subscribe();
    return () => { void client.removeChannel(channel); };
  }, [load]);
  const act = async (url: string, body: object) => { try { await requestJson(url, { method: "POST", body: JSON.stringify(body) }); await load(); } catch (err) { setError(err instanceof Error ? err.message : "Unable to update friendship."); } };
  const addFriend = async (event: React.FormEvent) => { event.preventDefault(); await act("/api/friends", { shareCode: shareCode.trim() }); setShareCode(""); };
  const copyFriendCode = async () => { if (!myFriendCode) return; await navigator.clipboard.writeText(myFriendCode); setCopied(true); window.setTimeout(() => setCopied(false), 1800); };
  return <div className="grid gap-6"><header><p className="text-sm font-semibold text-emerald-300">SOCIAL HUB</p><h1 className="mt-2 text-3xl font-semibold">Friends</h1><p className="mt-2 text-muted">Add people using their unique Talkingston code.</p></header><Card><p className="text-sm font-semibold text-slate-200">Your Friend Code</p><div className="mt-3 flex flex-wrap items-center gap-3"><code className="rounded-xl bg-white/[.06] px-4 py-3 text-lg font-bold tracking-[.2em] text-indigo-200">{myFriendCode || "Loading..."}</code><Button type="button" variant="secondary" disabled={!myFriendCode} onClick={() => void copyFriendCode()}>{copied ? "Copied" : "Copy"}</Button></div><p className="mt-2 text-xs text-muted">Share this code with someone so they can add you.</p></Card><Card><form onSubmit={addFriend} className="grid gap-3 sm:flex sm:items-end"><Input aria-label="Friend unique code" label="Add Friend" placeholder="Enter unique code" value={shareCode} onChange={(event) => setShareCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 32))} required /><Button type="submit"><UserPlus className="h-4 w-4" />Add Friend</Button></form><p className="mt-2 text-xs text-muted">Ask your friend to share the code shown on their profile.</p></Card>{error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}<section><h2 className="mb-3 text-xl font-semibold">Pending requests</h2>{requests.length ? <div className="grid gap-3">{requests.map((item) => item.profile && <ProfileCard key={item.id} profile={item.profile} action={<div className="flex gap-2"><Button onClick={() => void act("/api/friends/respond", { requestId: item.id, action: "accept" })}>Accept</Button><Button variant="ghost" onClick={() => void act("/api/friends/respond", { requestId: item.id, action: "decline" })}>Decline</Button></div>} />)}</div> : <StateCard title="No pending requests" description="New friend requests will appear here." />}</section><section><h2 className="mb-3 text-xl font-semibold">Friends</h2>{friends.length ? <div className="grid gap-3 md:grid-cols-2">{friends.map((item) => item.profile && <ProfileCard key={item.id} profile={item.profile} action={<div className="flex gap-2"><Link href={`/messages/${item.profile.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-500 px-4 text-sm font-semibold text-white"><MessageCircle className="h-4 w-4" /><span>Message</span></Link><Button variant="danger" onClick={() => void act(`/api/friends/${item.id}`, { action: "remove" })}>Remove</Button></div>} />)}</div> : <StateCard title="Your circle starts here" description="Add someone with their unique code to get started." action={<UserRound className="mx-auto h-10 w-10 text-emerald-300/60" />} />}</section>{blocked.length > 0 && <section><h2 className="mb-3 text-xl font-semibold">Blocked</h2><div className="grid gap-3">{blocked.map((item) => item.profile && <ProfileCard key={item.id} profile={item.profile} action={<Button variant="ghost" onClick={() => void act(`/api/friends/${item.id}`, { action: "unblock" })}>Unblock</Button>} />)}</div></section>}</div>;
}

type Message = { id: string; sender_id: string; recipient_id?: string; content: string; created_at: string; profile?: Profile | null };
function useRealtime(table: "direct_messages" | "group_messages", filter: string, onMessage: (message: Message) => void) {
  useEffect(() => {
    let client: ReturnType<typeof createClient> | null = null;
    try {
      client = createClient();
      const channel = client.channel(`social:${table}:${filter || "all"}`).on("postgres_changes", { event: "INSERT", schema: "public", table, ...(filter ? { filter } : {}) }, (payload) => onMessage(payload.new as Message)).subscribe();
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

export function MessageInbox() {
  const [conversations, setConversations] = useState<Array<{ userId: string; partner: Profile; lastMessage: Message; unreadCount: number }>>([]);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try { setConversations((await requestJson("/api/messages/direct/inbox")).conversations); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to load messages."); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  if (error) return <StateCard title="Inbox unavailable" description={error} />;
  return <div className="grid gap-6"><header><p className="text-sm font-semibold text-indigo-300">DIRECT MESSAGES</p><h1 className="mt-2 text-3xl font-semibold">Inbox</h1><p className="mt-2 text-muted">Continue a private conversation with a friend.</p></header>{conversations.length ? <div className="grid gap-3">{conversations.map((conversation) => <Link href={`/messages/${conversation.userId}`} key={conversation.userId}><Card className="flex items-center gap-3 transition hover:border-indigo-300/40"><Avatar name={conversation.partner.display_name} src={conversation.partner.avatar_url} /><div className="min-w-0 flex-1"><p className="font-semibold">{conversation.partner.display_name}</p><p className="truncate text-sm text-muted">{conversation.lastMessage.content}</p></div>{conversation.unreadCount > 0 && <span className="rounded-full bg-indigo-500 px-2 py-1 text-xs font-semibold">{conversation.unreadCount}</span>}</Card></Link>)}</div> : <StateCard title="No direct messages yet" description="Start a conversation from your Friends list." action={<MessageCircle className="mx-auto h-10 w-10 text-indigo-300/60" />} />}</div>;
}

export function DirectMessageView({ userId }: { userId: string }) {
  const [messages, setMessages] = useState<Message[]>([]); const [recipient, setRecipient] = useState<Profile | null>(null); const [error, setError] = useState("");
  const load = useCallback(async () => { try { const body = await requestJson(`/api/messages/direct?userId=${userId}`); setMessages(body.messages); setRecipient(body.recipient); } catch (err) { setError(err instanceof Error ? err.message : "Unable to load messages."); } }, [userId]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  const onRealtime = useMemo(() => (message: Message) => {
    if (message.sender_id !== userId && message.recipient_id !== userId) return;
    setMessages((current) => appendUniqueById(current, message));
  }, [userId]);
  useRealtime("direct_messages", "", onRealtime);
  const send = async (content: string) => { try { const body = await requestJson("/api/messages/direct", { method: "POST", body: JSON.stringify({ recipientId: userId, content }) }); setMessages((current) => current.some((item) => item.id === body.message.id) ? current : [...current, body.message]); } catch (err) { setError(err instanceof Error ? err.message : "Unable to send message."); } };
  if (error && !recipient) return <StateCard title="Conversation unavailable" description={error} />;
  return <div className="grid gap-4"><Link href="/friends" className="text-sm text-indigo-300">← Back to friends</Link><Card><div className="flex items-center gap-3"><Avatar name={recipient?.display_name} src={recipient?.avatar_url} /><div><h1 className="text-xl font-semibold">{recipient?.display_name ?? "Conversation"}</h1><p className="text-sm text-muted">@{recipient?.username}</p></div></div><div className="my-6 grid min-h-96 content-start gap-3">{messages.length ? messages.map((message) => <div key={message.id} className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${message.sender_id === userId ? "bg-white/[.06]" : "ml-auto bg-indigo-500/20"}`}>{message.content}<p className="mt-1 text-[10px] text-slate-500">{new Date(message.created_at).toLocaleTimeString()}</p></div>) : <StateCard title="Start the conversation" description="Say hello and make a plan." />}</div><MessageComposer onSend={send} placeholder="Write a message..." /></Card></div>;
}

export function GroupsHub() {
  const [groups, setGroups] = useState<Array<{ id: string; name: string; description?: string | null; join_code?: string | null }>>([]); const [name, setName] = useState(""); const [joinCode, setJoinCode] = useState(""); const [error, setError] = useState("");
  const load = useCallback(async () => { try { setGroups((await requestJson("/api/groups")).groups); } catch (err) { setError(err instanceof Error ? err.message : "Unable to load groups."); } }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  const create = async (event: React.FormEvent) => { event.preventDefault(); setError(""); try { await requestJson("/api/groups", { method: "POST", body: JSON.stringify({ name }) }); setError(""); setName(""); await load(); } catch (err) { setError(err instanceof Error ? err.message : "Unable to create group."); } };
  const join = async (event: React.FormEvent) => { event.preventDefault(); try { await requestJson("/api/groups", { method: "PUT", body: JSON.stringify({ code: joinCode }) }); setJoinCode(""); await load(); } catch (err) { setError(err instanceof Error ? err.message : "Unable to join group."); } };
  return <div className="grid gap-6"><header><p className="text-sm font-semibold text-violet-300">PRIVATE GROUPS</p><h1 className="mt-2 text-3xl font-semibold">Groups</h1><p className="mt-2 text-muted">Small, private spaces for the people you trust.</p></header><Card><form onSubmit={create} className="flex gap-2"><Input className="min-w-0 flex-1" aria-label="Group name" placeholder="New group name" value={name} onChange={(event) => setName(event.target.value)} required /><Button><Users className="h-4 w-4" />Create group</Button></form><form onSubmit={join} className="mt-3 flex gap-2"><Input className="min-w-0 flex-1" aria-label="Group join code" placeholder="Enter group code" value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} minLength={6} maxLength={10} required /><Button variant="secondary">Join with code</Button></form></Card>{error && <p role="alert" className="text-sm text-red-300">{error}</p>}{groups.length ? <div className="grid gap-3 md:grid-cols-2">{groups.map((group) => <Link href={`/groups/${group.id}`} key={group.id}><Card className="transition hover:border-violet-300/40"><h2 className="font-semibold">{group.name}</h2><p className="mt-1 text-sm text-muted">{group.description || "Private group chat"}</p>{group.join_code && <p className="mt-2 text-xs text-violet-200">Join code: {group.join_code}</p>}</Card></Link>)}</div> : <StateCard title="No groups yet" description="Create a private group for your circle." />}</div>;
}

function GroupMembers({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [members, setMembers] = useState<Array<{ user_id: string; role: string; profile?: Profile }>>([]);
  const [friendId, setFriendId] = useState(""); const [error, setError] = useState("");
  const load = useCallback(async () => { try { setMembers((await requestJson(`/api/groups/${groupId}`)).members); } catch (err) { setError(err instanceof Error ? err.message : "Unable to load members."); } }, [groupId]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  const updateMember = async (method: "POST" | "DELETE", userId: string) => { try { await requestJson(`/api/groups/${groupId}/members`, { method, body: JSON.stringify({ userId }) }); setFriendId(""); await load(); } catch (err) { setError(err instanceof Error ? err.message : "Unable to update members."); } };
  const leave = async () => { try { await requestJson(`/api/groups/${groupId}/leave`, { method: "POST" }); router.push("/groups"); } catch (err) { setError(err instanceof Error ? err.message : "Unable to leave group."); } };
  return <Card><h2 className="font-semibold">Members</h2><div className="mt-3 grid gap-2">{members.map((member) => member.profile && <div key={member.user_id} className="flex items-center gap-3 rounded-xl border border-white/10 p-2"><Avatar name={member.profile.display_name} src={member.profile.avatar_url} size="sm" /><div className="min-w-0 flex-1"><p className="truncate text-sm">{member.profile.display_name}</p>{member.profile.username && <p className="truncate text-xs text-muted">@{member.profile.username}</p>}</div><span className="text-xs text-muted">{member.role}</span>{member.role !== "owner" && <Button variant="danger" onClick={() => void updateMember("DELETE", member.user_id)}>Remove</Button>}</div>)}</div><div className="mt-4 flex gap-2"><input className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[.04] px-3 text-sm text-slate-100 outline-none focus:border-indigo-400" value={friendId} onChange={(event) => setFriendId(event.target.value)} placeholder="Friend user ID to invite" aria-label="Friend user ID" /><Button disabled={!friendId} onClick={() => void updateMember("POST", friendId)}>Invite</Button><Button variant="ghost" onClick={() => void leave()}>Leave</Button></div>{error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}</Card>;
}

export function GroupView({ groupId }: { groupId: string }) {
  const [group, setGroup] = useState<{ name: string; description?: string | null; join_code?: string | null } | null>(null); const [messages, setMessages] = useState<Message[]>([]); const [memberProfiles, setMemberProfiles] = useState<Record<string, Profile>>({}); const [userId, setUserId] = useState(""); const [documents, setDocuments] = useState<Array<{ id: string; name: string; mime_type: string }>>([]); const [selectedDocument, setSelectedDocument] = useState(""); const [documentBusy, setDocumentBusy] = useState(false); const [documentError, setDocumentError] = useState(""); const [error, setError] = useState("");
  const [assistantQuestion, setAssistantQuestion] = useState(""); const [assistantAnswer, setAssistantAnswer] = useState(""); const [assistantBusy, setAssistantBusy] = useState(false); const [assistantError, setAssistantError] = useState("");
  const load = useCallback(async () => { try { const [details, messageBody, auth, documentBody] = await Promise.all([requestJson(`/api/groups/${groupId}`), requestJson(`/api/groups/${groupId}/messages`), createClient().auth.getUser(), requestJson(`/api/groups/${groupId}/documents`)]); setGroup(details.group); setMemberProfiles(Object.fromEntries(details.members.filter((member: { profile?: Profile | null }) => member.profile).map((member: { user_id: string; profile: Profile }) => [member.user_id, member.profile]))); setMessages(messageBody.messages); setUserId(auth.data.user?.id ?? ""); setDocuments(documentBody.documents); } catch (err) { setError(err instanceof Error ? err.message : "Unable to load group."); } }, [groupId]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  const onRealtime = useMemo(() => (message: Message) => { const profile = memberProfiles[message.sender_id]; if (profile) setMessages((current) => appendUniqueById(current, { ...message, profile })); else void requestJson(`/api/groups/${groupId}`).then((details) => { const nextProfiles = Object.fromEntries(details.members.filter((member: { profile?: Profile | null }) => member.profile).map((member: { user_id: string; profile: Profile }) => [member.user_id, member.profile])); setMemberProfiles(nextProfiles); setMessages((current) => appendUniqueById(current, { ...message, profile: nextProfiles[message.sender_id] ?? null })); }); }, [groupId, memberProfiles]);
  useRealtime("group_messages", `group_id=eq.${groupId}`, onRealtime);
  const send = async (content: string) => { try { const body = await requestJson(`/api/groups/${groupId}/messages`, { method: "POST", body: JSON.stringify({ content }) }); setMessages((current) => current.some((item) => item.id === body.message.id) ? current : [...current, body.message]); } catch (err) { setError(err instanceof Error ? err.message : "Unable to send message."); } };
  const askTalkingston = async (action: "summarize" | "question") => {
    setAssistantBusy(true); setAssistantError(""); setAssistantAnswer("");
    try {
      const body = await requestJson(`/api/groups/${groupId}/assistant`, { method: "POST", body: JSON.stringify({ action, ...(action === "question" ? { question: assistantQuestion } : {}) }) });
      setAssistantAnswer(body.answer);
    } catch (err) { setAssistantError(err instanceof Error ? err.message : "Unable to ask Talkingston."); }
    finally { setAssistantBusy(false); }
  };
  const uploadDocument = async (file: File) => {
    setDocumentError(""); setDocumentBusy(true);
    try {
      if (!supportedDocumentTypes.includes(file.type as typeof supportedDocumentTypes[number]) || file.size <= 0 || file.size > MAX_DOCUMENT_BYTES) throw new Error("Upload a PDF, TXT, or Markdown file up to 20 MB.");
      const form = new FormData(); form.append("file", file);
      const body = await requestJson(`/api/groups/${groupId}/documents`, { method: "POST", body: form, headers: {} });
      setDocuments((current) => [body.document, ...current]); setSelectedDocument(body.document.id);
    } catch (err) { setDocumentError(err instanceof Error ? err.message : "Unable to upload document."); }
    finally { setDocumentBusy(false); }
  };
  const summarizeDocument = async () => {
    if (!selectedDocument) return;
    setDocumentError(""); setDocumentBusy(true);
    try {
      const body = await requestJson(`/api/groups/${groupId}/assistant`, { method: "POST", body: JSON.stringify({ action: "document_summary", documentId: selectedDocument }) });
      setAssistantAnswer(body.answer);
    } catch (err) { setDocumentError(err instanceof Error ? err.message : "Unable to summarize document."); }
    finally { setDocumentBusy(false); }
  };
  if (!group) return <StateCard title="Group unavailable" description={error || "Loading group..."} />;
  return <div className="grid gap-4"><Link href="/groups" className="text-sm text-indigo-300">← Back to groups</Link><Card><h1 className="text-xl font-semibold">{group.name}</h1><p className="text-sm text-muted">{group.description}</p>{group.join_code && <p className="mt-2 text-sm text-violet-200">Join code: <strong>{group.join_code}</strong> <button type="button" className="ml-2 text-indigo-300" onClick={() => void navigator.clipboard?.writeText(group.join_code ?? "")}>Copy code</button></p>}<div className="my-6 grid min-h-96 content-start gap-3">{messages.map((message) => { const profile = message.profile ?? memberProfiles[message.sender_id]; const own = message.sender_id === userId; return <div key={message.id} className={`flex gap-3 rounded-2xl bg-white/[.06] px-4 py-3 text-sm ${own ? "border border-indigo-300/20" : ""}`}><Avatar name={profile?.display_name || "Guest"} src={profile?.avatar_url} size="sm" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline gap-2"><span className="font-semibold">{own ? "You" : profile?.display_name || "Guest"}</span>{profile?.username && <span className="text-xs text-muted">@{profile.username}</span>}<time className="text-xs text-muted" dateTime={message.created_at}>{new Date(message.created_at).toLocaleString()}</time></div><p className="mt-1 whitespace-pre-wrap">{message.content}</p></div></div>; })}</div><MessageComposer onSend={send} placeholder="Message the group..." /></Card><Card><div className="flex items-center gap-2"><FileText className="h-4 w-4 text-violet-300" /><h2 className="font-semibold">Group documents</h2></div><p className="mt-1 text-sm text-muted">Upload a PDF, TXT, or Markdown file up to 20 MB. Uploading does not run AI.</p><label className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-white/[.08] px-4 text-sm font-semibold"><FileText className="h-4 w-4" />Upload document<input className="sr-only" type="file" accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" disabled={documentBusy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void uploadDocument(file); }} /></label>{documents.length > 0 && <div className="mt-3 grid gap-2">{documents.map((document) => <label key={document.id} className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 p-2 text-sm"><input type="radio" name="group-document" checked={selectedDocument === document.id} onChange={() => setSelectedDocument(document.id)} /><span>{document.name}</span></label>)}</div>}<Button className="mt-3" variant="secondary" loading={documentBusy} disabled={!selectedDocument || documentBusy} onClick={() => void summarizeDocument()}>Ask Talkingston: Summarize document</Button>{documentError && <p role="alert" className="mt-3 text-sm text-red-300">{documentError}</p>}</Card><Card><h2 className="font-semibold">Ask Talkingston</h2><p className="mt-1 text-sm text-muted">Ask explicitly about this group. Talkingston will not post or act in the group.</p><div className="mt-3 flex flex-wrap gap-2"><Button loading={assistantBusy} onClick={() => void askTalkingston("summarize")}>Summarize recent messages</Button><Input className="min-w-60 flex-1" aria-label="Question for Talkingston" placeholder="Ask a question about the group..." value={assistantQuestion} onChange={(event) => setAssistantQuestion(event.target.value)} /><Button variant="secondary" disabled={!assistantQuestion.trim() || assistantBusy} onClick={() => void askTalkingston("question")}>Ask question</Button></div>{assistantError && <p role="alert" className="mt-3 text-sm text-red-300">{assistantError}</p>}{assistantAnswer && <p className="mt-4 whitespace-pre-wrap rounded-xl border border-indigo-300/20 bg-indigo-400/10 p-3 text-sm text-slate-200">{assistantAnswer}</p>}</Card><GroupMembers groupId={groupId} /></div>;
}
