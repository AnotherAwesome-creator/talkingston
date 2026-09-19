import { describe, expect, it, vi } from "vitest";
import { bootstrapProfile } from "@/lib/auth/profile-bootstrap";

const user = {
  id: "guest-id",
  email: null,
  user_metadata: {},
} as never;

function createProfileClient(existing: unknown) {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn(() => ({
    select: () => ({
      eq: () => ({
        maybeSingle: vi.fn().mockResolvedValue({ data: existing, error: null }),
      }),
    }),
  }));
  return { client: { from }, admin: { from: vi.fn(() => ({ insert })) }, insert };
}

describe("profile bootstrap", () => {
  it("creates a missing profile and is idempotent", async () => {
    const first = createProfileClient(null);
    await bootstrapProfile(first.client as never, user, first.admin as never);
    expect(first.insert).toHaveBeenCalledOnce();
    expect(first.insert.mock.calls[0][0]).toMatchObject({ id: "guest-id", display_name: "Friend" });

    const second = createProfileClient({ id: "guest-id" });
    await bootstrapProfile(second.client as never, user, second.admin as never);
    expect(second.insert).not.toHaveBeenCalled();
  });

  it("does not modify an existing profile", async () => {
    const setup = createProfileClient({ id: "guest-id" });
    await bootstrapProfile(setup.client as never, user, setup.admin as never);
    expect(setup.insert).not.toHaveBeenCalled();
  });
});
