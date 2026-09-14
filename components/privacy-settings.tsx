"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";

type Preferences = { friend_requests: boolean; friend_accepted: boolean; group_invites: boolean; direct_messages: boolean; reminders: boolean };

export function PrivacySettings() {
  const [preferences, setPreferences] = useState<Preferences>({ friend_requests: true, friend_accepted: true, group_invites: true, direct_messages: true, reminders: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetch("/api/settings/privacy").then(async (response) => {
        if (!response.ok) throw new Error("Unable to load notification preferences.");
        const data = await response.json() as { notificationPreferences: Preferences };
        setPreferences(data.notificationPreferences);
        setLoading(false);
      }).catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "Unable to load notification preferences.");
        setLoading(false);
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  async function save() {
    setSaving(true); setError(""); setMessage("");
    const response = await fetch("/api/settings/privacy", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ friendRequests: preferences.friend_requests, friendAccepted: preferences.friend_accepted, groupInvites: preferences.group_invites, directMessages: preferences.direct_messages, reminders: preferences.reminders }) });
    if (!response.ok) { setError("Unable to save notification preferences."); setSaving(false); return; }
    setMessage("Notification preferences saved."); setSaving(false);
  }
  if (loading) return <Card><div className="animate-pulse text-sm text-muted">Loading preferences...</div></Card>;
  return <Card><div className="grid max-w-xl gap-4"><div><h2 className="font-semibold">Notification preferences</h2><p className="mt-1 text-sm text-muted">Choose which in-app updates appear in your notification list.</p></div>{(Object.keys(preferences) as Array<keyof Preferences>).map((key) => <label key={key} className="flex items-center justify-between gap-4 rounded-xl border border-white/10 p-3 text-sm text-slate-200"><span>{key.split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ")}</span><input type="checkbox" checked={preferences[key]} onChange={(event) => setPreferences((current) => ({ ...current, [key]: event.target.checked }))} /></label>)}{error && <p role="alert" className="text-sm text-red-300">{error}</p>}{message && <p role="status" className="text-sm text-emerald-300">{message}</p>}<Button onClick={() => void save()} loading={saving}>Save preferences</Button></div></Card>;
}
