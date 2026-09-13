import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return <Card>Connect Supabase to open project context.</Card>;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();
  const { data: project } = await supabase.from("projects").select("id, name, description, color_code").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!project) notFound();
  const { data: conversations } = await supabase.from("conversations").select("id, title, updated_at").eq("project_id", id).eq("user_id", user.id).eq("is_archived", false).order("updated_at", { ascending: false });
  return <div className="grid gap-6"><Link href="/projects" className="text-sm text-indigo-300 hover:text-indigo-200">← Back to projects</Link><header><p className="text-sm font-semibold text-indigo-300">PROJECT CONTEXT</p><h1 className="mt-2 text-3xl font-semibold">{project.name}</h1><p className="mt-2 text-muted">{project.description || "No description yet."}</p></header><Card><h2 className="font-semibold">Conversations</h2>{conversations?.length ? <div className="mt-4 grid gap-2">{conversations.map((conversation) => <Link key={conversation.id} href={`/chat?conversation=${conversation.id}`} className="rounded-xl border border-white/10 p-3 text-sm hover:bg-white/[.05]">{conversation.title}</Link>)}</div> : <p className="mt-3 text-sm text-muted">No conversations are linked to this project yet.</p>}</Card></div>;
}
