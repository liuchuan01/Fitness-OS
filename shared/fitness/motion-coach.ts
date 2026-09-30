import { z } from "zod";
import { calendarDateSchema } from "./profile-schema.js";
import type { Workout } from "./schema.js";

const exerciseNames = {
  squat: "深蹲",
  pushup: "俯卧撑",
  plank: "平板支撑",
  russian_twist: "俄罗斯转体",
  reverse_crunch: "反向卷腹"
} as const;
const exerciseSchema = z.enum(["squat", "pushup", "plank", "russian_twist", "reverse_crunch"]);

const repRecordSchema = z.object({
  durationMs: z.number().finite().nonnegative(),
  minAngle: z.number().finite(),
  valid: z.boolean(),
  issue: z.enum(["shallow", "fast"]).nullable()
});

const holdSchema = z.object({
  heldMs: z.number().finite().nonnegative(),
  bestMs: z.number().finite().nonnegative(),
  breaks: z.number().int().nonnegative(),
  timerMode: z.enum(["manual", "auto", "assisted"]).optional()
});

export const motionCoachSessionSchema = z.object({
  id: z.string().min(1).max(200),
  exercise: exerciseSchema,
  localDate: calendarDateSchema,
  endedAt: z.number().int().nonnegative(),
  durationMs: z.number().finite().nonnegative(),
  repCount: z.number().int().nonnegative(),
  attemptCount: z.number().int().nonnegative(),
  records: z.array(repRecordSchema),
  countMode: z.literal("completed").optional(),
  twistCountUnit: z.literal("sides").optional(),
  legacyTwistPairs: z.boolean().optional(),
  hold: holdSchema.optional()
}).superRefine((session, context) => {
  if (session.exercise === "plank" && !session.hold)
    context.addIssue({ code: "custom", message: "Plank record requires hold duration" });
  if (session.exercise === "russian_twist" && session.twistCountUnit !== "sides")
    context.addIssue({ code: "custom", message: "Russian twist count unit must be sides" });
});

export const motionCoachExportSchema = z.object({
  format: z.literal("ai-motion-coach-history"),
  schemaVersion: z.literal(1),
  exportedAt: z.string().datetime(),
  sessions: z.array(motionCoachSessionSchema).max(10_000)
});

export const motionCoachSourceSchema = z.object({
  system: z.literal("ai-motion-coach"),
  record_id: z.string().min(1),
  exercise: exerciseSchema,
  ended_at_ms: z.number().int().nonnegative(),
  duration_ms: z.number().finite().nonnegative(),
  rep_count: z.number().int().nonnegative(),
  attempt_count: z.number().int().nonnegative(),
  count_mode: z.literal("completed").optional(),
  twist_count_unit: z.literal("sides").optional(),
  legacy_twist_pairs: z.boolean().optional(),
  hold: holdSchema.optional(),
  records: z.array(repRecordSchema)
});

export type MotionCoachSession = z.infer<typeof motionCoachSessionSchema>;

export function motionCoachExercise(session: MotionCoachSession): Workout["blocks"][number]["exercises"][number] {
  const sets = session.exercise === "plank"
    ? session.hold && session.hold.heldMs > 0
      ? [{ kind: "work" as const, duration_sec: session.hold.heldMs / 1000 }]
      : []
    : session.repCount > 0
      ? [{ kind: "work" as const, reps: session.repCount }]
      : [];
  return {
    name: exerciseNames[session.exercise],
    sets,
    source: {
      system: "ai-motion-coach",
      record_id: session.id,
      exercise: session.exercise,
      ended_at_ms: session.endedAt,
      duration_ms: session.durationMs,
      rep_count: session.repCount,
      attempt_count: session.attemptCount,
      count_mode: session.countMode,
      twist_count_unit: session.twistCountUnit,
      legacy_twist_pairs: session.legacyTwistPairs,
      hold: session.hold,
      records: session.records
    }
  };
}
