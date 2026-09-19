import { createClient } from "@/lib/supabase/server";
import type { AiMessage } from "@/lib/ai/providers";
import { assembleContext, type Personality, type Proactivity } from "@/lib/ai/context";
import { extractMemoryCandidates } from "@/lib/ai/memory";
import { isMissingAuthSession } from "@/lib/social/server";

export async function getChatUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error && !isMissingAuthSession(error)) throw new Error(`Unable to verify your session: ${error.message}`);
  if (!user) return { supabase, user: null };
  return { supabase, user };
}

export async function buildConversationContext(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, conversationId: string, message: string, projectId?: string) {
  const [{ data: profile }, { data: settings }, { data: memories }, { data: history }, { data: project }] = await Promise.all([
    supabase.from("profiles").select("display_name, username, interests").eq("id", userId).maybeSingle(),
    supabase.from("companion_settings").select("personality, proactivity").eq("user_id", userId).maybeSingle(),
    supabase.from("user_memories").select("content, category, importance").eq("user_id", userId).order("importance", { ascending: false }).limit(20),
    supabase.from("messages").select("sender, content").eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(30),
    projectId
      ? supabase.from("projects").select("id, name, description, color_code").eq("id", projectId).eq("user_id", userId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const conversationHistory: AiMessage[] = (history ?? []).map((item: { sender: string; content: string }) => ({ role: item.sender === "assistant" ? "assistant" : "user", content: item.content }));
  return assembleContext({
    profile: profile ?? {},
    preferences: {},
    personality: (settings?.personality ?? "Balanced") as Personality,
    proactivity: (settings?.proactivity ?? "Normal") as Proactivity,
    relevantMemories: memories ?? [],
    conversationHistory,
    projectContext: project ?? null,
    activeActivityGameContext: null,
    permissions: { canReadMemories: true, canWriteMemories: true, canUseTools: false },
  }, message);
}

export async function saveExtractedMemories(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, message: string) {
  // Extraction only runs inside a user-initiated turn, never in the background.
  // It is skipped entirely when the user has asked Talkingston to be maximally
  // passive (proactivity "Off"), so no memory is written without consent.
  const { data: settings } = await supabase.from("companion_settings").select("proactivity").eq("user_id", userId).maybeSingle();
  if (settings?.proactivity === "Off") return;
  const candidates = extractMemoryCandidates(message);
  if (candidates.length === 0) return;
  await supabase.from("user_memories").upsert(candidates.map((candidate) => ({ user_id: userId, ...candidate, updated_at: new Date().toISOString() })), { onConflict: "user_id,content" });
}
