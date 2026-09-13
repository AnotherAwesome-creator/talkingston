import { createBrowserClient } from "@supabase/ssr";

/**
 * Talkingston V1 — Browser Supabase Client
 *
 * Safe for client-side React components (Client Components).
 * Uses strictly the public Supabase URL and public anonymous key.
 * Never accesses or exposes the SUPABASE_SERVICE_ROLE_KEY.
 */
export function createClient(
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase client environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be defined."
    );
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
