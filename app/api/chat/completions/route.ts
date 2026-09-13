import { NextResponse } from "next/server";
import { z } from "zod";
import { buildConversationContext, getChatUser, saveExtractedMemories } from "@/lib/chat/server";

const chatSchema = z.object({ conversationId: z.string().uuid(), message: z.string().trim().min(1).max(4000), projectId: z.string().uuid().optional() }).strict();

export async function POST(request: Request) {
  const parsed = chatSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "A valid conversation and message are required." }, { status: 400 });
  const { supabase, user } = await getChatUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { conversationId, message, projectId } = parsed.data;
  const { data: conversation } = await supabase.from("conversations").select("id, project_id").eq("id", conversationId).eq("user_id", user.id).maybeSingle();
  if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  if (projectId && conversation.project_id !== projectId) return NextResponse.json({ error: "Conversation is not associated with that project." }, { status: 403 });
  const { error: userMessageError } = await supabase.from("messages").insert({ conversation_id: conversationId, sender: "user", content: message });
  if (userMessageError) return NextResponse.json({ error: "Unable to save your message." }, { status: 500 });
  try {
    const context = await buildConversationContext(supabase, user.id, conversationId, message, projectId ?? conversation.project_id ?? undefined);
    const encoder = new TextEncoder();
    let complete = "";
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const { aiProviderRouter } = await import("@/lib/ai/router");
          for await (const result of aiProviderRouter.streamText({ task: "companion_chat", messages: context.messages })) {
            complete += result.chunk;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: result.chunk })}\n\n`));
          }
          const { error } = await supabase.from("messages").insert({ conversation_id: conversationId, sender: "assistant", content: complete });
          if (error) throw new Error("Unable to save assistant response.");
          await saveExtractedMemories(supabase, user.id, message);
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) { controller.error(error); }
      },
    });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
  } catch {
    return NextResponse.json({ error: "Talkingston is unavailable right now. Please try again." }, { status: 502 });
  }
}
