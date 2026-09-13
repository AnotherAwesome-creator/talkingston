import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export interface CookieToSet {
  name: string;
  value: string;
  options?: CookieOptions;
}

/**
 * Talkingston V1 — Server Supabase Client
 *
 * Designed for Next.js App Router Server Components, Server Actions, and Route Handlers.
 * Uses HTTP-only cookie storage for authenticated user sessions.
 * Strictly uses the public anon key with user session context — NOT the service-role key.
 */
export async function createClient(
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase server environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be defined."
    );
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // In Server Components, mutating cookies throws an error.
          // This can be ignored if session refresh is handled by middleware.
        }
      },
    },
  });
}
