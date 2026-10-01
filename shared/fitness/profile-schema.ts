import { z } from "zod";

export const calendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Invalid calendar date");
const text = z.string().trim().min(1);
const confirmationSchema = z
  .object({
    confirmed_at: z.string().datetime(),
    source: z.enum(["user_confirmed", "migration"])
  })
  .strict();
const userSchema = z
  .object({
    name: text.optional(),
    sex: text.optional(),
    height_cm: z.number().positive().optional(),
    birth_date: calendarDateSchema.optional(),
    age_years: z.number().int().nonnegative().optional(),
    age_as_of: calendarDateSchema.optional(),
    training_experience: text.optional()
  })
  .strict();
const goalsSchema = z
  .object({
    primary: z.union([text, z.object({ type: text }).passthrough()]),
    secondary: z.array(text).optional()
  })
  .passthrough();
const constraintsSchema = z
  .object({
    preferred_strength_days: z.array(text).optional(),
    sessions_per_week: z.number().int().min(1).max(7).optional(),
    max_session_min: z.number().positive().optional(),
    equipment: z.array(text).optional(),
    location: text.optional(),
    no_current_pain_or_injury: z.boolean().optional(),
    reported_limitations: z.array(text).optional()
  })
  .passthrough();

export const profileDraftSchema = z
  .object({
    schema_version: z.literal(1),
    user: userSchema.optional(),
    goals: goalsSchema.optional(),
    training_constraints: constraintsSchema.optional(),
    preferences: z.record(text, z.unknown()).optional(),
    unknowns: z.array(text).optional(),
    confirmation: confirmationSchema.optional()
  })
  .strict();
// Historical profiles remain readable; only the submission schema requires confirmation.
export const profileSchema = profileDraftSchema.extend({ goals: goalsSchema });
export const confirmedProfileSchema = profileSchema
  .extend({ confirmation: confirmationSchema })
  .superRefine((value, context) => {
    if (value.user?.age_years !== undefined && !value.user.age_as_of) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["user", "age_as_of"],
        message: "Age requires an observation date"
      });
    }
  });
export const programSchema = z
  .object({
    schema_version: z.literal(1),
    id: text.regex(/^[a-zA-Z0-9_-]+$/),
    name: text,
    start_date: calendarDateSchema,
    end_date: calendarDateSchema,
    outcome: z
      .record(text, z.unknown())
      .refine((value) => Object.keys(value).length > 0, "Program requires an outcome"),
    weekly_schedule: z
      .array(
        z
          .object({
            day_of_week: z.enum([
              "monday",
              "tuesday",
              "wednesday",
              "thursday",
              "friday",
              "saturday",
              "sunday"
            ]),
            slot_id: text,
            type: text,
            direction: text
          })
          .strict()
      )
      .min(1),
    confirmation: confirmationSchema.optional(),
    profile_revision: text.optional(),
    strength_budget: z.record(z.unknown()).optional(),
    progression: z.record(z.unknown()).optional(),
    nutrition_and_habits: z.record(z.unknown()).optional(),
    daily_plan_generation: z.record(z.unknown()).optional(),
    review: text.optional(),
    constraints: z.array(text).optional()
  })
  .strict()
  .refine((value) => value.start_date <= value.end_date, {
    path: ["end_date"],
    message: "Program end precedes start"
  });
const bodyMeasurementSchema = z
  .object({
    date: calendarDateSchema,
    bodyweight_kg: z.number().positive().optional(),
    waist_cm: z.number().positive().optional(),
    body_fat_percent: z.number().min(0).max(100).optional(),
    target_weight_kg: z.number().positive().optional(),
    measurement_context: text.optional(),
    source: z.enum(["user_reported", "user_confirmed", "import"]).optional()
  })
  .strict()
  .refine(
    (value) =>
      value.bodyweight_kg !== undefined ||
      value.waist_cm !== undefined ||
      value.body_fat_percent !== undefined,
    "Measurement requires a measured value"
  );
export const bodyMetricsSchema = z
  .object({
    schema_version: z.literal(1),
    measurements: z.array(bodyMeasurementSchema),
    notes: z.array(text).optional()
  })
  .strict();
export const cardioMetricsSchema = z
  .object({
    schema_version: z.literal(1),
    sessions: z.array(
      z
        .object({
          date: calendarDateSchema,
          type: text,
          distance_km: z.number().nonnegative().optional(),
          duration_min: z.number().positive().optional(),
          average_heart_rate: z.number().positive().optional(),
          pace_min_per_km: z.number().positive().optional(),
          rpe: z.number().min(1).max(10).optional(),
          session_style: text.optional()
        })
        .strict()
        .refine(
          (value) => value.distance_km !== undefined || value.duration_min !== undefined,
          "Cardio requires distance or duration"
        )
    ),
    notes: z.array(text).optional()
  })
  .strict();
export const nutritionMetricsSchema = z
  .object({
    schema_version: z.literal(1),
    date: calendarDateSchema,
    energy_kcal: z.number().nonnegative().optional(),
    protein_g: z.number().nonnegative().optional(),
    fat_g: z.number().nonnegative().optional(),
    carbohydrate_g: z.number().nonnegative().optional(),
    notes: z.array(text).optional(),
    source: z.enum(["user_reported", "user_confirmed", "import"])
  })
  .strict()
  .refine(
    (value) =>
      [value.energy_kcal, value.protein_g, value.fat_g, value.carbohydrate_g].some(
        (item) => item !== undefined
      ),
    "Nutrition requires a reported value"
  );
export type Program = z.infer<typeof programSchema>;
export const onboardingStateSchema = z.object({
  stage: z.enum([
    "empty",
    "draft",
    "profile_confirmed",
    "program_confirmed",
    "plan_ready",
    "training_started"
  ]),
  profileStatus: z.enum(["missing", "draft", "confirmed"]),
  hasProgram: z.boolean(),
  hasPlan: z.boolean(),
  hasDraft: z.boolean(),
  profileConfirmed: z.boolean(),
  profileRevision: z.string().nullable(),
  activeProgramId: z.string().nullable(),
  firstPlanDate: z.string().nullable(),
  hasWorkout: z.boolean()
});
export type OnboardingState = z.infer<typeof onboardingStateSchema>;
