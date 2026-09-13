"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Archive, FolderKanban, Plus, Trash2 } from "lucide-react";
import { Button, Card, Input, StateCard } from "@/components/ui";

type Project = { id: string; name: string; description: string | null; color_code: string; is_archived: boolean };

export function ProjectsExperience() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const response = await fetch("/api/projects");
    if (!response.ok) { setError("Unable to load projects."); setLoading(false); return; }
    const data = await response.json() as { projects: Project[] };
    setProjects(data.projects); setLoading(false);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  async function create(event: React.FormEvent) {
    event.preventDefault(); setError("");
    const response = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, description }) });
    if (!response.ok) { setError("Unable to create project."); return; }
    const data = await response.json() as { project: Project };
    setProjects((current) => [data.project, ...current]); setName(""); setDescription(""); setShowForm(false);
  }
  async function update(id: string, changes: Partial<Project>) {
    const response = await fetch(`/api/projects/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) });
    if (!response.ok) { setError("Unable to update project."); return; }
    const data = await response.json() as { project: Project };
    setProjects((current) => current.map((project) => project.id === id ? data.project : project));
  }
  async function remove(id: string) {
    if (!window.confirm("Delete this project? Conversations will remain available.")) return;
    const response = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (!response.ok) { setError("Unable to delete project."); return; }
    setProjects((current) => current.filter((project) => project.id !== id));
  }
  if (loading) return <Card><div className="animate-pulse text-sm text-muted">Loading projects…</div></Card>;
  return <div className="grid gap-6"><header className="flex items-end justify-between gap-4"><div><p className="text-sm font-semibold text-indigo-300">WORKSPACE</p><h1 className="mt-2 text-3xl font-semibold">Projects</h1><p className="mt-2 text-muted">Give your conversations a little more context.</p></div><Button onClick={() => setShowForm((value) => !value)}><Plus className="h-4 w-4" />New project</Button></header>{showForm && <Card><form onSubmit={create} className="grid max-w-xl gap-4"><Input label="Project name" value={name} onChange={(event) => setName(event.target.value)} required autoFocus /><label className="grid gap-2 text-sm text-slate-300">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} className="min-h-28 rounded-xl border border-white/10 bg-white/[.04] p-3 text-slate-100 outline-none focus:border-indigo-400" /></label><div className="flex gap-2"><Button type="submit">Create project</Button><Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button></div></form></Card>}{error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}{projects.length === 0 ? <StateCard title="No projects yet" description="Create a project to keep related conversations together." action={<FolderKanban className="mx-auto h-10 w-10 text-indigo-300/60" />} /> : <div className="grid gap-4 md:grid-cols-2">{projects.map((project) => <Card key={project.id} className={project.is_archived ? "opacity-60" : ""}><div className="flex items-start gap-4"><span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: project.color_code }} /><div className="min-w-0 flex-1"><Link href={`/projects/${project.id}`} className="font-semibold hover:text-indigo-200">{project.name}</Link><p className="mt-2 text-sm leading-6 text-muted">{project.description || "No description yet."}</p></div></div><div className="mt-5 flex gap-2"><Button variant="secondary" onClick={() => void update(project.id, { is_archived: !project.is_archived })}><Archive className="h-4 w-4" />{project.is_archived ? "Restore" : "Archive"}</Button><Button variant="danger" onClick={() => void remove(project.id)} aria-label={`Delete ${project.name}`}><Trash2 className="h-4 w-4" /></Button></div></Card>)}</div>}</div>;
}
