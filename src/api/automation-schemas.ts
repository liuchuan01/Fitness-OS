import { z } from "zod";

const automationScheduleSchema = z.object({
  schema_version: z.literal(1),
  daily_plan: z.object({
    enabled: z.boolean(),
    local_time: z.string(),
    time_zone: z.string(),
    missed_run_policy: z.literal("run_once")
  })
});
const automationRunSchema = z.object({
  run_id: z.string(),
  trigger_type: z.enum(["scheduled", "manual"]),
  status: z.enum(["running", "succeeded", "failed"]),
  finished_at: z.string().optional(),
  outcome: z.object({ code: z.string() }).passthrough().optional(),
  error: z.string().optional()
});
const automationStateSchema = z.object({
  schema_version: z.literal(2),
  daily_plan: z.object({ last_run: automationRunSchema.optional() }).passthrough()
});
export const automationResponseSchema = z.object({
  ok: z.literal(true),
  schedule: automationScheduleSchema,
  state: automationStateSchema,
  next_run_at: z.string().optional()
});
export const saveAutomationResponseSchema = z.object({
  ok: z.literal(true),
  schedule: automationScheduleSchema
});
export const runAutomationResponseSchema = z.object({
  ok: z.boolean(),
  state: automationStateSchema
});
export type AutomationResponse = z.infer<typeof automationResponseSchema>;
