import { NextResponse } from "next/server";
import { getChatUser } from "@/lib/chat/server";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const { supabase, user } = await getChatUser(); if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { error } = await supabase.from("user_memories").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Unable to delete memory." }, { status: 500 });
  return NextResponse.json({ success: true });
}
