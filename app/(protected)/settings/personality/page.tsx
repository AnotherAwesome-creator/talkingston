import Link from "next/link";
import { CompanionSettingsForm } from "@/components/settings-forms";
import { createClient } from "@/lib/supabase/server";

export default async function PersonalitySettingsPage() {
  let settings: { personality?: "Quiet" | "Balanced" | "Friendly" | "Witty" | "Very Playful"; proactivity?: "Off" | "Low" | "Normal" | "High" } | null = null;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const result = await supabase.from("companion_settings").select("personality, proactivity").eq("user_id", user.id).maybeSingle();
      settings = result.data;
    }
  }
  return <div className="grid gap-6"><Link href="/settings" className="text-sm text-indigo-300 hover:text-indigo-200">← Back to settings</Link><header><h1 className="text-3xl font-semibold">Personality</h1><p className="mt-2 text-muted">Tune the tone and initiative of your companion.</p></header><CompanionSettingsForm initialPersonality={settings?.personality} initialProactivity={settings?.proactivity} /></div>;
}
