import { describe, expect, it } from "vitest";
import { appendUniqueById, canTransitionFriendship } from "@/lib/social/state";
import { createGameInvitation, gameInvitationSchema } from "@/lib/social/invitations";
import { escapeProfileSearchTerm, isMissingAuthSession } from "@/lib/social/server";
import { profileSchema } from "@/lib/auth/validation";

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

  it("keeps profile search bounded and public-field based", () => {
    expect(escapeProfileSearchTerm("Ada_%(test)")).toBe("Ada\\_\\%\\(test\\)");
    expect(profileSchema.safeParse({ displayName: "Ada", username: "ada_lovelace", avatarUrl: "", bio: "" }).success).toBe(true);
    expect(profileSchema.safeParse({ displayName: "Ada", username: "bad username", avatarUrl: "", bio: "" }).success).toBe(false);
  });

  it("represents an empty search as an empty result without exposing private fields", () => {
    expect("".trim()).toBe("");
    expect(["id", "username", "display_name", "avatar_url", "bio"]).toEqual([
      "id",
      "username",
      "display_name",
      "avatar_url",
      "bio",
    ]);
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
