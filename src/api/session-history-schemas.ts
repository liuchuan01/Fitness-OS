import { z } from "zod";

export const sessionHistoryEventSchema = z.object({
  v: z.literal(1),
  type: z.literal("fitness.history.state"),
  open: z.boolean(),
  current: z.string().optional(),
  loading: z.boolean(),
  error: z.string(),
  items: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      updatedAt: z.number().finite().min(0).max(8_640_000_000_000_000),
      running: z.boolean()
    })
  )
});
export type SessionHistoryState = z.infer<typeof sessionHistoryEventSchema>;
