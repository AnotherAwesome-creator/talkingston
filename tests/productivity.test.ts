import { describe, expect, it } from "vitest";
import {
  isReminderDue,
  notificationPreferencesSchema,
  privacySchema,
  taskSchema,
  unreadNotificationCount,
} from "@/lib/productivity/state";

describe("Pass 7 productivity boundaries", () => {
  it("validates task ownership-facing input and due dates", () => {
    expect(taskSchema.safeParse({ title: "Review notes", priority: "high", dueAt: "2026-09-14T12:00:00.000Z" }).success).toBe(true);
    expect(taskSchema.safeParse({ title: "", priority: "high" }).success).toBe(false);
    expect(taskSchema.safeParse({ title: "Review", priority: "urgent" }).success).toBe(false);
  });

  it("keeps reminder due-state deterministic", () => {
    expect(isReminderDue("2026-09-14T12:00:00.000Z", new Date("2026-09-14T12:01:00.000Z"))).toBe(true);
    expect(isReminderDue("2026-09-14T12:00:00.000Z", new Date("2026-09-14T11:59:00.000Z"))).toBe(false);
  });

  it("validates privacy and notification preferences", () => {
    expect(privacySchema.safeParse({ profileVisibility: "friends" }).success).toBe(true);
    expect(privacySchema.safeParse({ profileVisibility: "team" }).success).toBe(false);
    expect(notificationPreferencesSchema.safeParse({ friendRequests: true, friendAccepted: true, groupInvites: true, directMessages: false, reminders: true }).success).toBe(true);
  });

  it("counts only unread notifications", () => {
    expect(unreadNotificationCount([{ read_at: null }, { read_at: "2026-09-14T12:00:00.000Z" }, { read_at: null }])).toBe(2);
  });
});
