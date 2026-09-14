"use client";

import { useState } from "react";
import { saveCompanionSettings, savePrivacySettings, saveProfile } from "@/app/actions/profile";
import { personalityValues, proactivityValues } from "@/lib/auth/validation";
import { profileVisibilityValues } from "@/lib/productivity/state";
import { Button, Card, Input } from "@/components/ui";

export function ProfileForm({ initialName = "", initialUsername = "", initialAvatar = "", initialBio = "", initialVisibility = "public" }: { initialName?: string; initialUsername?: string; initialAvatar?: string; initialBio?: string; initialVisibility?: (typeof profileVisibilityValues)[number] }) {
  const [displayName, setDisplayName] = useState(initialName);
  const [username, setUsername] = useState(initialUsername);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatar);
  const [bio, setBio] = useState(initialBio);
  const [visibility, setVisibility] = useState(initialVisibility);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setSaving(true); setStatus(""); setError(""); const result = await saveProfile({ displayName, username, avatarUrl, bio }); if (!result.ok) { setError(result.error); setSaving(false); return; } const privacy = await savePrivacySettings({ profileVisibility: visibility }); if (privacy.ok) setStatus("Profile saved."); else setError(privacy.error); setSaving(false); };
  return <Card><form onSubmit={submit} className="grid max-w-xl gap-4"><Input label="Display name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required /><Input label="Username" value={username} onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} required /><Input label="Avatar URL (optional)" type="url" value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} placeholder="https://..." /><label className="grid gap-2 text-sm font-medium text-slate-200">Bio<textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={500} rows={4} className="rounded-xl border border-white/10 bg-white/[.04] px-3 py-2 text-slate-100 outline-none focus:border-indigo-400" /></label><label className="grid gap-2 text-sm font-medium text-slate-200">Profile visibility<select value={visibility} onChange={(event) => setVisibility(event.target.value as (typeof profileVisibilityValues)[number])} className="min-h-11 rounded-xl border border-white/10 bg-white/[.04] px-3 text-slate-100"><option value="public">Everyone</option><option value="friends">Friends only</option><option value="private">Only me</option></select></label>{error && <p role="alert" className="text-sm text-red-300">{error}</p>}{status && <p role="status" className="text-sm text-emerald-300">{status}</p>}<Button type="submit" loading={saving}>Save profile</Button></form></Card>;
}

export function CompanionSettingsForm({ initialPersonality = "Balanced", initialProactivity = "Normal" }: { initialPersonality?: (typeof personalityValues)[number]; initialProactivity?: (typeof proactivityValues)[number] }) {
  const [personality, setPersonality] = useState(initialPersonality); const [proactivity, setProactivity] = useState(initialProactivity); const [status, setStatus] = useState(""); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setSaving(true); setStatus(""); setError(""); const result = await saveCompanionSettings({ personality, proactivity }); if (result.ok) setStatus("Companion settings saved."); else setError(result.error); setSaving(false); };
  return <Card><form onSubmit={submit} className="grid max-w-xl gap-6"><fieldset><legend className="mb-3 text-sm font-semibold">Personality</legend><div className="grid gap-2">{personalityValues.map((option) => <label key={option} className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 p-3 text-sm hover:bg-white/[.04]"><input type="radio" name="personality" checked={personality === option} onChange={() => setPersonality(option)} />{option}</label>)}</div></fieldset><fieldset><legend className="mb-3 text-sm font-semibold">Proactivity</legend><select value={proactivity} onChange={(event) => setProactivity(event.target.value as (typeof proactivityValues)[number])} className="min-h-11 w-full rounded-xl border border-white/10 bg-white/[.04] px-3 text-slate-100"><option className="bg-slate-900">Off</option><option className="bg-slate-900">Low</option><option className="bg-slate-900">Normal</option><option className="bg-slate-900">High</option></select></fieldset>{error && <p role="alert" className="text-sm text-red-300">{error}</p>}{status && <p role="status" className="text-sm text-emerald-300">{status}</p>}<Button type="submit" loading={saving}>Save settings</Button></form></Card>;
}
