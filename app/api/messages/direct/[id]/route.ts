import { NextResponse } from "next/server";
import { z } from "zod";
import { getSocialUser } from "@/lib/social/server";

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid message." }, { status: 400 });
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabase.from("direct_messages").update({ is_read: true }).eq("id", id).eq("recipient_id", user.id).select("id, is_read").single();
  if (error) return NextResponse.json({ error: "Message not found." }, { status: 404 });
  return NextResponse.json({ message: data });
}
