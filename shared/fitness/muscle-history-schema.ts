import { z } from "zod";
import { muscleIds, setSchema } from "./schema.js";

export const calendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((date) => {
    const timestamp = Date.parse(`${date}T00:00:00Z`);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === date;
  }, "Invalid calendar date");

export const muscleHistoryQuerySchema = z.object({
  muscleId: z.enum(muscleIds),
  date: calendarDateSchema
});

const relationSchema = z.enum(["primary", "secondary"]);
const historyExerciseSchema = z.object({
  viewId: z.string(),
  exerciseId: z.string(),
  name: z.string(),
  relation: relationSchema,
  sets: z.array(setSchema)
});

export const muscleHistorySchema = z.object({
  muscleId: z.enum(muscleIds),
  labelZh: z.string(),
  asOf: calendarDateSchema,
  windowStart: calendarDateSchema,
  lastTrainedDate: calendarDateSchema.nullable(),
  lastPrimaryDate: calendarDateSchema.nullable(),
  weekly: z.object({
    sessions: z.number().int().nonnegative(),
    primarySets: z.number().int().nonnegative(),
    secondarySets: z.number().int().nonnegative(),
    unclassifiedSets: z.number().int().nonnegative()
  }),
  history: z.array(
    z.object({
      workoutId: z.string(),
      date: calendarDateSchema,
      title: z.string(),
      exercises: z.array(historyExerciseSchema)
    })
  ),
  relatedExercises: z.array(
    z.object({
      exerciseId: z.string(),
      name: z.string(),
      relation: relationSchema,
      primaryMuscles: z.array(z.enum(muscleIds)),
      secondaryMuscles: z.array(z.enum(muscleIds)),
      lastTrainedDate: calendarDateSchema.nullable()
    })
  )
});

export const muscleHistoryResponseSchema = z.object({
  ok: z.literal(true),
  muscle: muscleHistorySchema
});

export type MuscleHistory = z.infer<typeof muscleHistorySchema>;
