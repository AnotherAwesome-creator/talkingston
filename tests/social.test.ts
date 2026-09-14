import { describe, expect, it } from "vitest";
import { appendUniqueById, canTransitionFriendship } from "@/lib/social/state";
import { createGameInvitation, gameInvitationSchema } from "@/lib/social/invitations";
import { isMissingAuthSession } from "@/lib/social/server";

describe("social state boundaries", () => {
  it("prevents invalid friendship transitions", () => {
    expect(canTransitionFriendship(null, "send")).toBe(true);
    expect(canTransitionFriendship(null, "accept")).toBe(false);
    expect(canTransitionFriendship("pending", "accept")).toBe(true);
    expect(canTransitionFriendship("accepted", "accept")).toBe(false);
    expect(canTransitionFriendship("blocked", "unblock")).toBe(true);
    expect(canTransitionFriendship("accepted", "block")).toBe(true);
  });

  it("prevents duplicate realtime messages", () => {
    const message = { id: "message-1", content: "hello" };
    expect(appendUniqueById([message], message)).toHaveLength(1);
    expect(appendUniqueById([], message)).toEqual([message]);
  });

  it("treats an absent auth session as unauthenticated", () => {
    expect(isMissingAuthSession({ name: "AuthSessionMissingError" })).toBe(true);
    expect(isMissingAuthSession({ name: "AuthApiError" })).toBe(false);
    expect(isMissingAuthSession(null)).toBe(false);
  });

  it("validates game invitation foundations without implementing game logic", () => {
    const invitation = createGameInvitation({
      inviterId: "00000000-0000-0000-0000-000000000001",
      recipientId: "00000000-0000-0000-0000-000000000002",
      gameType: "whot",
      expiresAt: "2026-09-14T20:00:00.000Z",
    });
    expect(invitation.status).toBe("pending");
    expect(gameInvitationSchema.safeParse({ ...invitation, recipientId: undefined, groupId: undefined }).success).toBe(false);
  });
});
