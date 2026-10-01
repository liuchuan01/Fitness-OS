import { z } from "zod";
import { muscleIds, muscleLabels } from "../muscle-taxonomy.js";
import { calendarDateSchema } from "./profile-schema.js";
import type { MuscleId } from "../muscle-taxonomy.js";

export { muscleIds, muscleLabels };
export type { MuscleId };

const muscleIdSchema = z.enum(muscleIds);
const readinessFieldsSchema = z.object({
  fatigue: z.number().min(0).max(10).optional(),
  sleep_quality: z.number().min(0).max(10).optional(),
  soreness: z.number().min(0).max(10).optional(),
  mood: z.number().min(0).max(10).optional()
});
const aiStimulusIntentSchema = z.object({
  target: z.record(muscleIdSchema, z.enum(["low", "medium", "high"]).optional()).optional(),
  avoid: z
    .record(muscleIdSchema, z.enum(["low", "medium", "high", "high_load"]).optional())
    .optional()
});

const setFieldsSchema = z.object({
  kind: z.enum(["warmup", "work"]).optional(),
  weight_kg: z.number().nonnegative().optional(),
  reps: z.number().int().positive().optional(),
  rpe: z.number().min(1).max(10).optional(),
  bodyweight_factor: z.number().positive().optional(),
  duration_sec: z.number().int().positive().optional()
});
const hasRepsOrDuration = (set: { reps?: number; duration_sec?: number }) =>
  set.reps != null || set.duration_sec != null;
export const setSchema = setFieldsSchema
  .strict()
  .refine(hasRepsOrDuration, { message: "A set requires reps or duration_sec" });
export const planSetSchema = setFieldsSchema
  .extend({
    prescription: z
      .object({
        load_selection: z.string().min(1).optional(),
        target_rpe: z.number().min(1).max(10).optional(),
        target_rir: z.number().int().min(0).max(10).optional()
      })
      .strict()
      .optional()
  })
  .strict()
  .refine(hasRepsOrDuration, { message: "A set requires reps or duration_sec" });

export const exerciseSchema = z.object({
  name: z.string().min(1),
  exercise_id: z.string().min(1).optional(),
  sets: z.array(setSchema).default([])
});

export const workoutBlockSchema = z.object({
  type: z.string().min(1),
  name: z.string().min(1),
  exercises: z.array(exerciseSchema).default([])
});

export const planBlockSchema = workoutBlockSchema.extend({
  exercises: z
    .array(exerciseSchema.extend({ sets: z.array(planSetSchema).default([]) }))
    .default([])
});

export const workoutSchema = z.object({
  schema_version: z.literal(1).optional(),
  id: z.string().min(1),
  date: calendarDateSchema,
  title: z.string().min(1),
  bodyweight_kg: z.number().positive().optional(),
  duration_min: z.number().int().positive().optional(),
  user_note: z.string().optional(),
  goals: z.array(z.string().min(1)).optional(),
  source_import_file: z.string().optional(),
  readiness: readinessFieldsSchema.default({}),
  blocks: z.array(workoutBlockSchema).default([]),
  source_plan_file: z.string().optional(),
  computed: z
    .object({
      total_sets: z.number().int().nonnegative(),
      total_volume_kg: z.number().nonnegative().nullable(),
      estimation_missing_sets: z.number().int().positive().optional(),
      stimulus: z.record(muscleIdSchema, z.number().min(0).max(100)),
      recovery_load: z.record(muscleIdSchema, z.number().min(0).max(100))
    })
    .optional()
});

export const planSchema = workoutSchema
  .omit({
    computed: true,
    source_import_file: true,
    source_plan_file: true
  })
  .extend({
    blocks: z.array(planBlockSchema).default([]),
    profile_revision: z.string().min(1).optional(),
    source: z.string().min(1).optional(),
    user_intent: z.string().optional(),
    ai_stimulus_intent: aiStimulusIntentSchema.optional(),
    computed_expected_stimulus: z.record(muscleIdSchema, z.number().min(0).max(100)).optional()
  });

export const planDraftSchema = z
  .object({
    schema_version: z.literal(1).optional(),
    id: z.string().min(1).optional(),
    date: calendarDateSchema.optional(),
    title: z.string().min(1),
    bodyweight_kg: z.number().positive().optional(),
    duration_min: z.number().int().positive().optional(),
    user_note: z.string().optional(),
    goals: z.array(z.string().min(1)).optional(),
    readiness: readinessFieldsSchema.default({}),
    blocks: z.array(planBlockSchema).default([]),
    profile_revision: z.string().min(1).optional(),
    source: z.string().min(1).optional(),
    user_intent: z.string().optional(),
    ai_stimulus_intent: aiStimulusIntentSchema.optional()
  })
  .strict();

export const muscleMapSchema = z.record(
  z.string().min(1),
  z.object({
    primary: z.record(muscleIdSchema, z.number().positive()).default({}),
    secondary: z.record(muscleIdSchema, z.number().positive()).default({})
  })
);

export const readinessSchema = z.object({
  schema_version: z.literal(1).optional(),
  fatigue: z.number().min(0).max(10),
  sleep_quality: z.number().min(0).max(10),
  soreness: z.number().min(0).max(10),
  mood: z.number().min(0).max(10)
});

export const stimulusRulesSchema = z.object({
  schema_version: z.literal(1).optional(),
  rpe_base: z.number().nonnegative().default(0.6),
  rpe_step: z.number().nonnegative().default(0.09),
  default_rpe: z.number().min(1).max(10).default(7),
  default_bodyweight_factor: z.number().positive().default(0.65),
  secondary_stimulus_factor: z.number().positive().default(0.75),
  primary_recovery_factor: z.number().positive().default(0.65),
  secondary_recovery_factor: z.number().positive().default(0.45),
  stimulus_normalization_divisor: z.number().positive().default(20),
  recovery_normalization_divisor: z.number().positive().default(25)
});

export type Workout = z.infer<typeof workoutSchema>;
export type Plan = z.infer<typeof planSchema>;
export type MuscleMap = z.infer<typeof muscleMapSchema>;
export type Readiness = z.infer<typeof readinessSchema>;
export type StimulusRules = z.infer<typeof stimulusRulesSchema>;

export type StimulusResult = {
  total_sets: number;
  total_volume_kg: number | null;
  estimation_missing_sets?: number;
  stimulus: Record<MuscleId, number>;
  recovery_load: Record<MuscleId, number>;
};

export type RecoveryResult = {
  overall_score: number | null;
  muscles: Record<MuscleId, number | null>;
  warnings: string[];
};
