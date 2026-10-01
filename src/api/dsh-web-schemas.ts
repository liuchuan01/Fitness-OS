import { z } from "zod";

export const dshWebResponseSchema = z.discriminatedUnion("status", [
  z.object({ ok: z.literal(true), status: z.literal("starting") }),
  z.object({ ok: z.literal(true), status: z.literal("ready"), url: z.string().url() }),
  z.object({ ok: z.literal(false), status: z.literal("failed"), error: z.string() })
]);
