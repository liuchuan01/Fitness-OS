import { z } from "zod";

export const dataSyncEventSchema = z.discriminatedUnion("type", [
  z.object({
    v: z.literal(1),
    type: z.literal("fitness.data-changed"),
    revision: z.string().min(1),
    changed: z.array(z.enum(["dashboard", "today-plan", "workouts"])),
    at: z.string()
  }),
  z.object({
    v: z.literal(1),
    type: z.literal("fitness.data-invalid"),
    message: z.string().optional(),
    at: z.string()
  })
]);

export type DataSyncEvent = z.infer<typeof dataSyncEventSchema>;
