import { z } from "zod";

const selectionSchema = z.object({
  provider: z.string(),
  model: z.string(),
  reasoningEffort: z.string().optional()
});
export const modelPreferencesResponseSchema = z.object({
  ok: z.literal(true),
  preferences: z.object({
    writable: z.boolean(),
    revision: z.number().int().nonnegative(),
    selection: selectionSchema,
    models: z.array(
      z.object({
        provider: z.string(),
        id: z.string(),
        name: z.string(),
        efforts: z.array(z.object({ id: z.string(), name: z.string() })),
        defaultEffort: z.string().optional()
      })
    ),
    catalogIncomplete: z.boolean()
  })
});
export type ModelSelection = z.infer<typeof selectionSchema>;
export type ModelPreferences = z.infer<typeof modelPreferencesResponseSchema>["preferences"];
