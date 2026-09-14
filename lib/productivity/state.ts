import { z } from "zod";

export const taskPriorityValues = ["low", "medium", "high"] as const;
export const taskStatusValues = ["open", "completed"] as const;
export const profileVisibilityValues = ["public", "friends", "private"] as const;

export const taskSchema = z.object({
  title: z.string().trim().min(1).max(160),
  notes: z.string().trim().max(4000).nullable().optional(),
  dueAt: z.string().datetime({ offset: true }).nullable().optional(),
  priority: z.enum(taskPriorityValues).default("medium"),
  projectId: z.string().uuid().nullable().optional(),
}).strict();

export const taskUpdateSchema = taskSchema.partial().extend({
  status: z.enum(taskStatusValues).optional(),
}).strict();

export const reminderSchema = z.object({
  taskId: z.string().uuid(),
  scheduledAt: z.string().datetime({ offset: true }),
  active: z.boolean().default(true),
}).strict();

export const reminderUpdateSchema = reminderSchema.partial().strict();

export const notificationPreferencesSchema = z.object({
  friendRequests: z.boolean(),
  friendAccepted: z.boolean(),
  groupInvites: z.boolean(),
  directMessages: z.boolean(),
  reminders: z.boolean(),
}).strict();

export const privacySchema = z.object({
  profileVisibility: z.enum(profileVisibilityValues),
}).strict();

export function isReminderDue(scheduledAt: string, now = new Date()) {
  return new Date(scheduledAt).getTime() <= now.getTime();
}

export function unreadNotificationCount(notifications: Array<{ read_at: string | null }>) {
  return notifications.filter((notification) => notification.read_at === null).length;
}
