"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Circle, Plus, Trash2 } from "lucide-react";
import { Button, Card, Input, StateCard } from "@/components/ui";
import { ReminderPanel } from "@/components/reminder-panel";

type Task = { id: string; title: string; notes: string | null; due_at: string | null; priority: "low" | "medium" | "high"; status: "open" | "completed"; project_id: string | null; };
type Project = { id: string; name: string };

export function TasksExperience() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("medium");
  const [priorityFilter, setPriorityFilter] = useState<Task["priority"] | "">("");
  const [projectId, setProjectId] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<"open" | "completed" | "">("open");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const filters = new URLSearchParams({ limit: "20", page: String(page) });
    if (status) filters.set("status", status);
    if (priorityFilter) filters.set("priority", priorityFilter);
    const response = await fetch(`/api/tasks?${filters.toString()}`);
    if (!response.ok) { setError("Unable to load tasks."); setLoading(false); return; }
    const data = await response.json() as { tasks: Task[]; total: number };
    setTasks(data.tasks); setTotal(data.total); setLoading(false);
  }, [page, priorityFilter, status]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetch("/api/projects").then(async (response) => response.ok ? response.json() as Promise<{ projects: Project[] }> : { projects: [] }).then((data) => setProjects(data.projects));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    const response = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, notes: notes || null, dueAt: dueAt ? new Date(dueAt).toISOString() : null, priority, projectId: projectId || null }) });
    if (!response.ok) { setError("Unable to create task."); setSaving(false); return; }
    const data = await response.json() as { task: Task };
    setTasks((current) => [data.task, ...current]); setTitle(""); setNotes(""); setDueAt(""); setProjectId(""); setMessage("Task created."); setSaving(false);
  }

  async function update(id: string, changes: Record<string, unknown>) {
    const response = await fetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) });
    if (!response.ok) { setError("Unable to update task."); return; }
    const data = await response.json() as { task: Task };
    setTasks((current) => current.map((task) => task.id === id ? data.task : task));
  }
  async function editTitle(task: Task) {
    const nextTitle = window.prompt("Task title", task.title)?.trim();
    if (nextTitle && nextTitle !== task.title) await update(task.id, { title: nextTitle });
  }
  async function remove(id: string) {
    if (!window.confirm("Delete this task?")) return;
    const response = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (!response.ok) { setError("Unable to delete task."); return; }
    setTasks((current) => current.filter((task) => task.id !== id)); setMessage("Task deleted.");
  }
  return <div className="grid gap-6"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-indigo-300">PRODUCTIVITY</p><h1 className="mt-2 text-3xl font-semibold">Tasks</h1><p className="mt-2 text-muted">Keep the next useful thing within reach.</p></div><div className="flex flex-wrap gap-2"><select aria-label="Task status filter" value={status} onChange={(event) => { setPage(1); setStatus(event.target.value as "open" | "completed" | ""); }} className="min-h-11 rounded-xl border border-white/10 bg-white/[.04] px-3 text-slate-100"><option value="">All tasks</option><option value="open">Open</option><option value="completed">Completed</option></select><select aria-label="Task priority filter" value={priorityFilter} onChange={(event) => { setPage(1); setPriorityFilter(event.target.value as Task["priority"] | ""); }} className="min-h-11 rounded-xl border border-white/10 bg-white/[.04] px-3 text-slate-100"><option value="">All priorities</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div></header><Card><form onSubmit={create} className="grid gap-3 md:grid-cols-[1fr_auto]"><Input label="New task" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What would help today?" required /><select aria-label="Task priority" value={priority} onChange={(event) => setPriority(event.target.value as Task["priority"])} className="min-h-11 self-end rounded-xl border border-white/10 bg-white/[.04] px-3 text-slate-100"><option value="low">Low priority</option><option value="medium">Medium priority</option><option value="high">High priority</option></select><label className="grid gap-2 text-sm text-slate-300">Project<select aria-label="Task project" value={projectId} onChange={(event) => setProjectId(event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-white/[.04] px-3 text-slate-100"><option value="">No project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label className="grid gap-2 text-sm text-slate-300">Due date<input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-white/[.04] px-3 text-slate-100" /></label><label className="grid gap-2 text-sm text-slate-300 md:col-span-2">Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={4000} className="min-h-20 rounded-xl border border-white/10 bg-white/[.04] p-3 text-slate-100" /></label><Button type="submit" loading={saving}><Plus className="h-4 w-4" />Add task</Button></form></Card><ReminderPanel />{error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}{message && <p role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200">{message}</p>}{loading ? <Card><div className="animate-pulse text-sm text-muted">Loading tasks...</div></Card> : tasks.length === 0 ? <StateCard title="No tasks here" description="Add a small, clear next step." /> : <><div className="grid gap-3">{tasks.map((task) => <Card key={task.id} className={task.status === "completed" ? "opacity-60" : ""}><div className="flex items-start gap-3"><button onClick={() => void update(task.id, { status: task.status === "completed" ? "open" : "completed" })} aria-label={task.status === "completed" ? `Reopen ${task.title}` : `Complete ${task.title}`} className="mt-1 text-indigo-300">{task.status === "completed" ? <Check className="h-5 w-5" /> : <Circle className="h-5 w-5" />}</button><div className="min-w-0 flex-1"><h2 className="font-semibold">{task.title}</h2>{task.notes && <p className="mt-1 text-sm text-muted">{task.notes}</p>}<p className="mt-2 text-xs uppercase tracking-wide text-slate-500">{task.priority} priority{task.project_id ? " · project linked" : ""}{task.due_at ? ` · due ${new Date(task.due_at).toLocaleString()}` : ""}</p></div><Button variant="secondary" onClick={() => void editTitle(task)}>Edit</Button><Button variant="danger" onClick={() => void remove(task.id)} aria-label={`Delete ${task.title}`}><Trash2 className="h-4 w-4" /></Button></div></Card>)}</div><div className="flex items-center justify-between text-sm text-muted"><span>Page {page} of {Math.max(1, Math.ceil(total / 20))}</span><div className="flex gap-2"><Button variant="secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button><Button variant="secondary" disabled={page * 20 >= total} onClick={() => setPage((current) => current + 1)}>Next</Button></div></div></>}</div>;
}
