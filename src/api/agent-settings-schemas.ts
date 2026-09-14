import { z } from "zod";

export const agentSettingsSchema = z.object({
  schema_version: z.literal(1),
  instructions: z.string().min(1).max(12_000)
});

export const agentSettingsResponseSchema = z.object({
  ok: z.literal(true),
  settings: agentSettingsSchema
});

export type AgentSettings = z.infer<typeof agentSettingsSchema>;
