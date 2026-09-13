import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export interface CookieToSet {
  name: string;
  value: string;
  options?: CookieOptions;
}

/**
 * Talkingston V1 — Supabase SSR Session Refresh Utility
 *
 * Provides a minimal, technical utility for refreshing expired Supabase auth tokens
 * in Next.js middleware and passing updated cookies to downstream routes.
 *
 * NOTE: This utility contains ZERO product authorization or redirect logic.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase environment is not configured, pass through transparently
  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refresh auth token silently if expired
  await supabase.auth.getUser();

  return response;
}
