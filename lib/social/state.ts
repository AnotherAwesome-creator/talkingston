import { z } from "zod";

export const friendshipStatusSchema = z.enum(["pending", "accepted", "blocked"]);
export type FriendshipStatus = z.infer<typeof friendshipStatusSchema>;

export function canTransitionFriendship(
  current: FriendshipStatus | null,
  action: "send" | "accept" | "decline" | "cancel" | "remove" | "block" | "unblock",
) {
  if (action === "send") return current === null;
  if (action === "accept" || action === "decline" || action === "cancel") return current === "pending";
  if (action === "remove") return current === "accepted";
  if (action === "block") return current !== "blocked";
  return current === "blocked";
}

export function appendUniqueById<T extends { id: string }>(items: T[], next: T) {
  return items.some((item) => item.id === next.id) ? items : [...items, next];
}
