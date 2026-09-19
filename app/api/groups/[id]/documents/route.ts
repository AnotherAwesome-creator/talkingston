import { NextResponse } from "next/server";
import { MAX_DOCUMENT_BYTES, validateDocument } from "@/lib/games/document-quiz";
import { getSocialUser, isGroupMember } from "@/lib/social/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isGroupMember(supabase, id, user.id))) return NextResponse.json({ error: "Group not found." }, { status: 404 });

  const file = (await request.formData()).get("file");
  if (!(file instanceof File) || !validateDocument(file)) {
    return NextResponse.json({ error: `Upload a PDF, TXT, or Markdown file up to ${Math.round(MAX_DOCUMENT_BYTES / (1024 * 1024))} MB.` }, { status: 400 });
  }

  const original = Buffer.from(await file.arrayBuffer());
  const path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error: uploadError } = await supabase.storage
    .from("private-documents")
    .upload(path, original, { contentType: file.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: "Unable to store document." }, { status: 500 });

  const { data, error } = await supabase
    .from("user_documents")
    .insert({ owner_id: user.id, group_id: id, name: file.name, mime_type: file.type, storage_path: path, extracted_text: null })
    .select("id, name, mime_type, group_id, created_at")
    .single();
  if (error) return NextResponse.json({ error: "Unable to save document." }, { status: 500 });
  return NextResponse.json({ document: data }, { status: 201 });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isGroupMember(supabase, id, user.id))) return NextResponse.json({ error: "Group not found." }, { status: 404 });
  const { data, error } = await supabase
    .from("user_documents")
    .select("id, name, mime_type, group_id, created_at")
    .eq("group_id", id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Unable to load group documents." }, { status: 500 });
  return NextResponse.json({ documents: data ?? [] });
}
