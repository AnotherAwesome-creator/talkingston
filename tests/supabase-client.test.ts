// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { createAdminClient } from "@/lib/supabase/admin";

describe("Stage 2A — Supabase Client Foundation Tests", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Browser Client (lib/supabase/client.ts)", () => {
    it("throws descriptive error when public Supabase environment variables are missing", () => {
      expect(() => createBrowserClient()).toThrowError(
        /Missing Supabase client environment variables/
      );
    });

    it("initializes successfully when public credentials are provided explicitly", () => {
      const client = createBrowserClient(
        "https://example.supabase.co",
        "mock-anon-key"
      );

      expect(client).toBeDefined();
      expect(client.auth).toBeDefined();
      expect(typeof client.from).toBe("function");
    });

    it("initializes successfully when public credentials are in process.env", () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "mock-anon-key";

      const client = createBrowserClient();
      expect(client).toBeDefined();
      expect(client.auth).toBeDefined();
    });
  });

  describe("Admin Service-Role Client (lib/supabase/admin.ts)", () => {
    it("throws descriptive error when service role credentials are missing", () => {
      expect(() => createAdminClient()).toThrowError(
        /Missing Supabase admin environment variables/
      );
    });

    it("throws a security violation error if window is defined (browser environment)", () => {
      // Simulate browser window
      const globalObj = globalThis as { window?: unknown };
      globalObj.window = {};

      try {
        expect(() =>
          createAdminClient("https://example.supabase.co", "service-key")
        ).toThrowError(/SECURITY VIOLATION/);
      } finally {
        delete globalObj.window;
      }
    });

    it("initializes successfully in a server environment when credentials are provided", () => {
      const adminClient = createAdminClient(
        "https://example.supabase.co",
        "mock-service-role-key"
      );

      expect(adminClient).toBeDefined();
      expect(adminClient.auth).toBeDefined();
      expect(typeof adminClient.from).toBe("function");
    });
  });
});
