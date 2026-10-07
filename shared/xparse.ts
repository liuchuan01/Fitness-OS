import { z } from "zod";

export const xparseSettingsSchema = z
  .object({
    enabled: z.boolean(),
    allowPaid: z.boolean()
  })
  .strict();
export type XparseSettings = z.infer<typeof xparseSettingsSchema>;
export const xparseSettingsResponseSchema = z.object({
  ok: z.literal(true),
  settings: xparseSettingsSchema
});
export const xparseCredentialsResponseSchema = z.object({
  ok: z.literal(true),
  credentials: z.object({ configured: z.boolean(), writable: z.boolean() }).strict()
});
export type XparseCredentials = z.infer<typeof xparseCredentialsResponseSchema>["credentials"];
