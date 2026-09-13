import { z } from "zod";

export const gameInvitationSchema = z.object({
  inviterId: z.string().uuid(),
  recipientId: z.string().uuid().optional(),
  groupId: z.string().uuid().optional(),
  gameType: z.enum(["whot", "trivia"]),
  roomReference: z.string().trim().max(200).optional(),
  status: z.enum(["pending", "accepted", "declined", "expired"]).default("pending"),
  expiresAt: z.string().datetime(),
}).strict().refine((value) => Boolean(value.recipientId || value.groupId), {
  message: "An invitation needs a recipient or group.",
});

export type GameInvitation = z.infer<typeof gameInvitationSchema> & {
  id: string;
  createdAt: string;
};

export function createGameInvitation(input: z.input<typeof gameInvitationSchema>, id = crypto.randomUUID()): GameInvitation {
  return { ...gameInvitationSchema.parse(input), id, createdAt: new Date().toISOString() };
}
