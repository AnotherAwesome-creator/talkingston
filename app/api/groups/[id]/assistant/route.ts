import { NextResponse } from "next/server";
import { z } from "zod";
import { aiProviderRouter } from "@/lib/ai/router";
import { AiProviderError } from "@/lib/ai/providers";
import { getSocialUser, isGroupMember } from "@/lib/social/server";
import { extractDocumentText } from "@/lib/games/pdf-extraction";
import { createAdminClient } from "@/lib/supabase/admin";

const assistantSchema = z.object({
  action: z.enum(["summarize", "question", "document_summary"]),
  question: z.string().trim().min(1).max(1000).optional(),
  documentId: z.string().uuid().optional(),
}).strict().superRefine((value, context) => {
  if (value.action === "question" && !value.question) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["question"], message: "A question is required." });
  }
  if (value.action === "document_summary" && !value.documentId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["documentId"], message: "A document is required." });
  }
});

const MAX_MESSAGES = 30;
const MAX_CONTEXT_CHARACTERS = 12000;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 });
  }
  const parsed = assistantSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid assistant action and provide a question when required." }, { status: 400 });

  const { id } = await params;
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isGroupMember(supabase, id, user.id))) return NextResponse.json({ error: "Group not found." }, { status: 404 });

  if (parsed.data.action === "document_summary") {
    const { data: document, error: documentError } = await supabase
      .from("user_documents")
      .select("id, name, mime_type, storage_path")
      .eq("id", parsed.data.documentId)
      .eq("group_id", id)
      .single();
    if (documentError || !document) return NextResponse.json({ error: "Document not found in this group." }, { status: 404 });
    // Storage policies restrict reads to the uploader's folder. Membership was
    // verified above, so the server-only client enables authorized group members
    // who did not upload the document to use it.
    const { data: file, error: downloadError } = await createAdminClient()
      .storage.from("private-documents")
      .download(document.storage_path);
    if (downloadError || !file) return NextResponse.json({ error: "Unable to retrieve the document." }, { status: 500 });
    let documentText: string;
    try {
      documentText = await extractDocumentText(Buffer.from(await file.arrayBuffer()), document.mime_type);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to extract document text." }, { status: 422 });
    }
    try {
      const result = await aiProviderRouter.generateText({
        task: "companion_chat",
        messages: [
          { role: "system", content: "You are Talkingston assisting a group only when explicitly asked. Summarize the provided document accurately. Do not invent details, post messages, or take actions in the group." },
          { role: "user", content: `Summarize this document clearly, covering its main points and important details. Document name: ${document.name}\n\nDocument text:\n${documentText.slice(0, 80000)}` },
        ],
        options: { maxTokens: 1000 },
      });
      if (!result.text.trim()) return NextResponse.json({ error: "Talkingston returned an empty response." }, { status: 502 });
      return NextResponse.json({ answer: result.text, provider: result.provider, document: { id: document.id, name: document.name } });
    } catch (assistantError) {
      if (assistantError instanceof AiProviderError && ["invalid_request", "authentication"].includes(assistantError.kind)) {
        return NextResponse.json({ error: assistantError.message }, { status: 503 });
      }
      return NextResponse.json({ error: "Talkingston is unavailable right now. Please try again." }, { status: 502 });
    }
  }

  const { data: messages, error } = await supabase
    .from("group_messages")
    .select("sender_id, content, created_at")
    .eq("group_id", id)
    .order("created_at", { ascending: false })
    .limit(MAX_MESSAGES);
  if (error) return NextResponse.json({ error: "Unable to load group context." }, { status: 500 });

  const context = (messages ?? [])
    .reverse()
    .map((message) => `[${message.created_at}] ${message.sender_id}: ${message.content}`)
    .join("\n")
    .slice(-MAX_CONTEXT_CHARACTERS);
  if (!context) return NextResponse.json({ error: "There are no group messages to analyze yet." }, { status: 400 });

  const instruction = parsed.data.action === "summarize"
    ? "Summarize the recent group messages clearly. Mention key topics, decisions, and open questions. Do not invent details."
    : `Answer this question using only the recent group messages. If the answer is not present, say so clearly.\nQuestion: ${parsed.data.question}`;

  try {
    const result = await aiProviderRouter.generateText({
      task: "companion_chat",
      messages: [
        { role: "system", content: "You are Talkingston assisting a group only when explicitly asked. Do not post messages or take actions in the group." },
        { role: "user", content: `${instruction}\n\nRecent group messages:\n${context}` },
      ],
      options: { maxTokens: 800 },
    });
    if (!result.text.trim()) return NextResponse.json({ error: "Talkingston returned an empty response." }, { status: 502 });
    return NextResponse.json({ answer: result.text, provider: result.provider });
  } catch (assistantError) {
    if (assistantError instanceof AiProviderError && assistantError.kind === "invalid_request") {
      return NextResponse.json({ error: assistantError.message }, { status: 503 });
    }
    if (assistantError instanceof AiProviderError && assistantError.kind === "authentication") {
      return NextResponse.json({ error: assistantError.message }, { status: 503 });
    }
    return NextResponse.json({ error: "Talkingston is unavailable right now. Please try again." }, { status: 502 });
  }
}