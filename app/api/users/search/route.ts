import { NextResponse } from "next/server";
import { z } from "zod";
import { getSocialUser, publicProfileFields } from "@/lib/social/server";

const querySchema = z.object({
  q: z.string().trim().min(2).max(50),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

export async function GET(request: Request) {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Search must contain at least two characters." }, { status: 400 });
  const { supabase, user } = await getSocialUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { q, page, limit } = parsed.data;
  const from = (page - 1) * limit;
  const { data, error } = await supabase.from("profiles").select(publicProfileFields)
    .neq("id", user.id).or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
    .order("username").range(from, from + limit - 1);
  if (error) return NextResponse.json({ error: "Unable to search users." }, { status: 500 });
  return NextResponse.json({ users: data ?? [], page, limit });
}
