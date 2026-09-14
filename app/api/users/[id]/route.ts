import { NextResponse } from "next/server";
import { z } from "zod";
import { getSocialUser, publicProfileFields, publicProfileRelation } from "@/lib/social/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid user." }, { status: 400 });
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabase.from(publicProfileRelation).select(publicProfileFields).eq("id", id).single();
  if (error) return NextResponse.json({ error: "User not found." }, { status: 404 });
  return NextResponse.json({ user: data });
}
