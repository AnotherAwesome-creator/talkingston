import { NextResponse } from "next/server";
import { extractText, MAX_DOCUMENT_BYTES, validateDocument } from "@/lib/games/document-quiz";
import { getSocialUser } from "@/lib/social/server";

export async function POST(request: Request) {
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !validateDocument(file)) return NextResponse.json({ error: `Upload a PDF, TXT, or Markdown file up to ${Math.round(MAX_DOCUMENT_BYTES / (1024 * 1024))} MB.` }, { status: 400 });
  const text = extractText(Buffer.from(await file.arrayBuffer()), file.type);
  const path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error: uploadError } = await supabase.storage.from("private-documents").upload(path, Buffer.from(text), { contentType: file.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: "Unable to store document." }, { status: 500 });
  const { data, error } = await supabase.from("user_documents").insert({ owner_id: user.id, name: file.name, mime_type: file.type, storage_path: path, extracted_text: text }).select("id, name, mime_type").single();
  if (error) return NextResponse.json({ error: "Unable to save document." }, { status: 500 });
  return NextResponse.json({ document: data }, { status: 201 });
}
