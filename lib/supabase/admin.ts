import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Talkingston V1 — Server-Only Admin Supabase Client
 *
 * Designed exclusively for trusted background workers or administrative scripts.
 * Uses the elevated SUPABASE_SERVICE_ROLE_KEY to bypass Row Level Security.
 *
 * SECURITY:
 * - Must NEVER be imported or executed in client/browser components.
 * - Runtime guard throws immediately if executed in a browser environment.
 */
export function createAdminClient(
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
) {
  if (typeof window !== "undefined") {
    throw new Error(
      "SECURITY VIOLATION: createAdminClient can only be invoked in a server runtime. Never expose SUPABASE_SERVICE_ROLE_KEY to the browser."
    );
  }

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase admin environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be defined."
    );
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
