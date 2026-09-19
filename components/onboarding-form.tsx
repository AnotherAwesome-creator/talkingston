"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveCompanionSetup } from "@/app/actions/profile";
import { interestValues, personalityValues, proactivityValues } from "@/lib/auth/validation";
import { Button, Card } from "@/components/ui";

const interestLabels: Record<string, string> = { art: "Art", food: "Food", movies: "Movies", career: "Career", entertainment: "Entertainment", technology: "Technology" };
const choiceDescriptions: Record<string, string> = {
  Quiet: "Gentle and low-key.",
  Balanced: "A thoughtful middle ground.",
  Friendly: "Warm, supportive, and approachable.",
  Witty: "Light and clever when it fits.",
  "Very Playful": "More energy and initiative.",
  Off: "Gentle and low-key.",
  Low: "Occasional helpful suggestions.",
  Normal: "Helpful initiative at a comfortable pace.",
  High: "More energy and initiative.",
};
export function OnboardingForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [interests, setInterests] = useState<string[]>([]);
  const [personality, setPersonality] = useState<(typeof personalityValues)[number]>("Balanced");
  const [proactivity, setProactivity] = useState<(typeof proactivityValues)[number]>("Normal");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const next = () => { setError(""); if (step === 0 && interests.length === 0) return setError("Choose at least one interest."); setStep((current) => current + 1); };
  const finish = async () => { setSaving(true); setError(""); const result = await saveCompanionSetup({ interests: interests as (typeof interestValues)[number][], personality, proactivity }); if (!result.ok) setError(result.error); else router.push("/home"); setSaving(false); };
  return <Card className="w-full max-w-2xl"><div className="mb-8 flex items-center justify-between"><div><p className="text-sm font-semibold text-indigo-300">CUSTOMIZE TALKINGSTON</p><h1 className="mt-2 text-2xl font-semibold">Shape your companion</h1><p className="mt-2 text-sm text-muted">Your name and username come from your Profile and aren't asked again here.</p></div><span className="text-sm text-muted">{step + 1} / 3</span></div><div className="mb-8 flex gap-1">{[0,1,2].map((item) => <span key={item} className={`h-1.5 flex-1 rounded-full ${item <= step ? "bg-indigo-400" : "bg-white/10"}`} />)}</div>{step === 0 && <div className="grid gap-4"><h2 className="text-xl font-semibold">What lights you up?</h2><p className="text-sm text-muted">Pick interests to help your companion understand your world.</p><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{interestValues.map((interest) => <button type="button" key={interest} onClick={() => setInterests((current) => current.includes(interest) ? current.filter((item) => item !== interest) : [...current, interest])} aria-pressed={interests.includes(interest)} className={`rounded-xl border p-4 text-left text-sm transition ${interests.includes(interest) ? "border-indigo-400 bg-indigo-500/15 text-indigo-100" : "border-white/10 bg-white/[.03] text-slate-300 hover:bg-white/[.07]"}`}>{interestLabels[interest]}</button>)}</div></div>}{step === 1 && <ChoiceStep title="What kind of companion feels right?" options={personalityValues} value={personality} setValue={setPersonality} />}{step === 2 && <ChoiceStep title="How proactive should Talkingston be?" options={proactivityValues} value={proactivity} setValue={setProactivity} />}{error && <p role="alert" className="mt-6 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}<div className="mt-8 flex justify-between gap-3"><Button variant="ghost" onClick={() => step === 0 ? router.back() : setStep((current) => current - 1)}>Back</Button>{step < 2 ? <Button onClick={next}>Continue</Button> : <Button onClick={finish} loading={saving}>Finish setup</Button>}</div></Card>;
}
function ChoiceStep<T extends string>({ title, options, value, setValue }: { title: string; options: readonly T[]; value: T; setValue: (value: T) => void }) { return <div className="grid gap-4"><h2 className="text-xl font-semibold">{title}</h2><div className="grid gap-3">{options.map((option) => <button type="button" key={option} onClick={() => setValue(option)} aria-pressed={value === option} className={`rounded-xl border p-4 text-left transition ${value === option ? "border-indigo-400 bg-indigo-500/15" : "border-white/10 bg-white/[.03] hover:bg-white/[.07]"}`}><span className="font-semibold">{option}</span><span className="mt-1 block text-sm text-muted">{choiceDescriptions[option] ?? option}</span></button>)}</div></div>; }