import { z } from "zod";

export const safeToolSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_]{1,40}$/),
  description: z.string().max(300),
  inputSchema: z.record(z.string(), z.unknown()),
  authorization: z.enum(["authenticated", "owner"]),
});

export type SafeTool = z.infer<typeof safeToolSchema>;

export const availableTools: SafeTool[] = [];

export function assertToolExecutionAllowed(tool: SafeTool, authenticatedUserId: string | null, ownerId?: string) {
  if (!authenticatedUserId) throw new Error("Authentication is required to use tools.");
  if (tool.authorization === "owner" && ownerId !== authenticatedUserId) throw new Error("You are not authorized to use this tool.");
}
