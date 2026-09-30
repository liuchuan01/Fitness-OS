import { setSchema, planSetSchema } from "../../shared/fitness/schema";
import { motionCoachSourceSchema } from "../../shared/fitness/motion-coach";
import { z } from "zod";
import { muscleIds } from "../../shared/muscle-taxonomy";

export const healthSchema = z.object({
  ok: z.literal(true),
  service: z.literal("local-app-service"),
  version: z.string()
});

const muscleVisualStateSchema = z.object({
  muscleId: z.enum(muscleIds),
  labelZh: z.string(),
  intensity: z.number().min(0).max(100),
  recoveryScore: z.number().min(0).max(100).nullable(),
  selected: z.boolean(),
  hovered: z.boolean(),
  status: z.enum(["gray", "blue", "orange", "red", "purple"])
});

const workoutSummarySchema = z.object({
  id: z.string(),
  date: z.string(),
  title: z.string(),
  totalSets: z.number(),
  totalVolumeKg: z.number().nullable()
});

export { setSchema } from "../../shared/fitness/schema";

const timelineWorkoutSchema = workoutSummarySchema.extend({
  intensity: z.number().min(0).max(100),
  group: z.enum(["today", "yesterday", "this_week", "earlier"])
});

const exerciseSchema = z.object({
  id: z.string(),
  name: z.string(),
  sets: z.array(setSchema),
  source: motionCoachSourceSchema.optional(),
  primaryMuscles: z.array(muscleVisualStateSchema.shape.muscleId),
  secondaryMuscles: z.array(muscleVisualStateSchema.shape.muscleId)
});

const dailyWorkoutSchema = workoutSummarySchema.extend({
  bodyweightKg: z.number().optional(),
  readiness: z.object({
    fatigue: z.number().optional(),
    sleep_quality: z.number().optional(),
    soreness: z.number().optional(),
    mood: z.number().optional()
  }),
  blocks: z.array(
    z.object({
      type: z.string(),
      name: z.string(),
      exercises: z.array(exerciseSchema)
    })
  ),
  bodyProjection: z.array(muscleVisualStateSchema)
});

const planExerciseSchema = z.object({
  name: z.string(),
  exercise_id: z.string().optional(),
  sets: z.array(planSetSchema)
});

const planSchema = z.object({
  schema_version: z.literal(1).optional(),
  id: z.string(),
  date: z.string(),
  title: z.string(),
  source: z.string().optional(),
  user_intent: z.string().optional(),
  bodyweight_kg: z.number().optional(),
  duration_min: z.number().optional(),
  user_note: z.string().optional(),
  goals: z.array(z.string()).optional(),
  readiness: z.object({
    fatigue: z.number().optional(),
    sleep_quality: z.number().optional(),
    soreness: z.number().optional(),
    mood: z.number().optional()
  }),
  ai_stimulus_intent: z
    .object({
      target: z.record(z.enum(muscleIds), z.enum(["low", "medium", "high"]).optional()).optional(),
      avoid: z
        .record(z.enum(muscleIds), z.enum(["low", "medium", "high", "high_load"]).optional())
        .optional()
    })
    .optional(),
  computed_expected_stimulus: z.record(z.enum(muscleIds), z.number()).optional(),
  blocks: z.array(
    z.object({
      type: z.string(),
      name: z.string(),
      exercises: z.array(planExerciseSchema)
    })
  )
});

const planPreviewSchema = workoutSummarySchema.extend({
  computedExpectedStimulus: z.record(z.enum(muscleIds), z.number()),
  warnings: z.array(z.string())
});

const dashboardSchema = z.object({
  date: z.string(),
  hasTrainingData: z.boolean(),
  lastWorkoutDate: z.string().nullable(),
  daysSinceLastWorkout: z.number().int().nonnegative().nullable(),
  weeklyTrainingSessions: z.number().int().nonnegative(),
  weeklyTrainingMinutes: z.number().int().nonnegative(),
  weeklyStrengthSets: z.number().int().nonnegative(),
  weeklyAverageRpe: z.number().min(1).max(10).nullable(),
  muscleSetDistribution: z.array(
    z.object({
      groupId: z.string(),
      labelZh: z.string(),
      sets: z.number().nonnegative()
    })
  ),
  bodyProjection: z.array(muscleVisualStateSchema),
  recentWorkouts: z.array(workoutSummarySchema),
  coachInsight: z.string(),
  computedStimulus: z.record(z.string(), z.number()),
  computedRecoveryLoad: z.record(z.string(), z.number())
});

export const dashboardResponseSchema = z.object({
  ok: z.literal(true),
  projection: dashboardSchema
});

export const timelineResponseSchema = z.object({
  ok: z.literal(true),
  timeline: z.array(timelineWorkoutSchema)
});

export const dailyWorkoutResponseSchema = z.object({
  ok: z.literal(true),
  workout: dailyWorkoutSchema
});

export const planResponseSchema = z.object({
  ok: z.literal(true),
  plan: planSchema,
  preview: planPreviewSchema,
  sourcePlanFile: z.string()
});

export type HealthResponse = z.infer<typeof healthSchema>;
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;
export type TimelineWorkout = z.infer<typeof timelineWorkoutSchema>;
export type DailyWorkout = z.infer<typeof dailyWorkoutSchema>;
export type PlanResponse = z.infer<typeof planResponseSchema>;
export type TodayPlan = PlanResponse["plan"];
