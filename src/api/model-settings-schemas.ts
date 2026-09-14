import { z } from "zod";

export const modelSettingsResponseSchema = z.object({
  ok: z.literal(true),
  settings: z.object({
    provider: z.string(),
    configured: z.boolean(),
    writable: z.boolean(),
    source: z.string().optional()
  })
});

export type ModelSettings = z.infer<typeof modelSettingsResponseSchema>["settings"];
