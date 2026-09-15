"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";

type Task = { id: string; title: string };
type Reminder = { id: string; task_id: string; scheduled_at: string; active: boolean; delivered_at: string | null };

export function ReminderPanel() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [taskId, setTaskId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const [taskResponse, reminderResponse] = await Promise.all([fetch("/api/tasks?limit=50"), fetch("/api/reminders")]);
    if (!taskResponse.ok || !reminderResponse.ok) { setMessage("Unable to load reminder data."); return; }
    setTasks((await taskResponse.json() as { tasks: Task[] }).tasks);
    setReminders((await reminderResponse.json() as { reminders: Reminder[] }).reminders);
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!taskId || !date || !time) { setMessage("Choose a task, date, and time."); return; }
    const response = await fetch("/api/reminders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskId, scheduledAt: new Date(`${date}T${time}`).toISOString(), active: true }) });
    if (!response.ok) { setMessage("Unable to save reminder."); return; }
    setTaskId(""); setDate(""); setTime(""); setMessage("Reminder saved. Talkingston will notify you in the app at the selected local time."); await load();
  };
  const update = async (id: string, active: boolean) => {
    const response = await fetch(`/api/reminders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active }) });
    if (response.ok) await load(); else setMessage("Unable to update reminder.");
  };
  const remove = async (id: string) => {
    const response = await fetch(`/api/reminders/${id}`, { method: "DELETE" });
    if (response.ok) await load(); else setMessage("Unable to delete reminder.");
  };
  return <Card><h2 className="font-semibold">Reminders</h2><p className="mt-1 text-sm text-muted">Choose a local date and time. Talkingston will create an in-app notification when it is due.</p><form onSubmit={save} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto_auto]"><label className="grid gap-2 text-sm text-slate-300">Task<select aria-label="Reminder task" value={taskId} onChange={(event) => setTaskId(event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-white/[.04] px-3 text-slate-100"><option value="">Choose a task</option>{tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label><label className="grid gap-2 text-sm text-slate-300">Date<input aria-label="Reminder date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-white/[.04] px-3 text-slate-100" /></label><label className="grid gap-2 text-sm text-slate-300">Time<input aria-label="Reminder time" type="time" value={time} onChange={(event) => setTime(event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-white/[.04] px-3 text-slate-100" /></label><Button type="submit" className="self-end">Save reminder</Button></form>{message && <p role="status" className="mt-3 text-sm text-amber-200">{message}</p>}<div className="mt-4 grid gap-2">{reminders.map((reminder) => <div key={reminder.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 p-3 text-sm"><span className="min-w-0 flex-1">{tasks.find((task) => task.id === reminder.task_id)?.title ?? "Task"} · {new Date(reminder.scheduled_at).toLocaleString()} {reminder.delivered_at ? "· Delivered" : reminder.active ? "· Active" : "· Inactive"}</span><Button variant="secondary" onClick={() => void update(reminder.id, !reminder.active)}>{reminder.active ? "Deactivate" : "Activate"}</Button><Button variant="ghost" onClick={() => void remove(reminder.id)}>Delete</Button></div>)}</div></Card>;
}
