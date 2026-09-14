import { NextResponse } from "next/server";
import { z } from "zod";
import { escapeProfileSearchTerm, getSocialUser, publicProfileFields, publicProfileRelation } from "@/lib/social/server";

const querySchema = z.object({
  q: z.string().trim().max(50).default(""),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

export async function GET(request: Request) {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Search must contain at least two characters." }, { status: 400 });
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { q, page, limit } = parsed.data;
  if (!q) return NextResponse.json({ users: [], page, limit });
  const from = (page - 1) * limit;
  const search = escapeProfileSearchTerm(q);
  const { data, error } = await supabase.from(publicProfileRelation).select(publicProfileFields)
    .neq("id", user.id).or(`username.ilike.%${search}%,display_name.ilike.%${search}%`)
    .order("username").range(from, from + limit - 1);
  if (error) return NextResponse.json({ error: "Unable to search users." }, { status: 500 });
  return NextResponse.json({ users: data ?? [], page, limit });
}
