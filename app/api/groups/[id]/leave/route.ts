import { NextResponse } from "next/server";
import { getSocialUser, isGroupMember } from "@/lib/social/server";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await isGroupMember(supabase, id, user.id);
  if (!membership) return NextResponse.json({ error: "Group membership not found." }, { status: 404 });
  if (membership.role === "owner") return NextResponse.json({ error: "The owner must delete the group or transfer ownership first." }, { status: 409 });
  const { error } = await supabase.from("group_members").delete().eq("group_id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Unable to leave group." }, { status: 500 });
  return NextResponse.json({ success: true });
}
