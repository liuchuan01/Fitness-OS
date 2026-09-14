import type { z } from "zod";
import {
  muscleIds,
  stimulusRulesSchema,
  type MuscleId,
  type MuscleMap,
  type Readiness,
  type RecoveryResult,
  type StimulusResult,
  type StimulusRules,
  type Workout
} from "./schema.js";
import type { exerciseSchema } from "./schema.js";

export const defaultStimulusRules: StimulusRules = stimulusRulesSchema.parse({});

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number) {
  return Math.round(value);
}

export function zeroMuscleScores(): Record<MuscleId, number> {
  return Object.fromEntries(muscleIds.map((muscleId) => [muscleId, 0])) as Record<MuscleId, number>;
}

function rpeFactor(rpe: number | undefined, rules: StimulusRules = defaultStimulusRules) {
  return rules.rpe_base + clamp(rpe ?? rules.default_rpe, 1, 10) * rules.rpe_step;
}

function addMuscleLoad(target: Record<MuscleId, number>, muscleId: MuscleId, amount: number) {
  target[muscleId] = (target[muscleId] ?? 0) + amount;
}

export function getExerciseTargets(exercise: z.infer<typeof exerciseSchema>, muscleMap: MuscleMap) {
  const mapping = muscleMap[exercise.exercise_id ?? exercise.name];
  return {
    primary: mapping?.primary ?? {},
    secondary: mapping?.secondary ?? {}
  };
}

export function calculateStimulus(
  workout: Workout,
  muscleMap: MuscleMap,
  rules: StimulusRules = defaultStimulusRules
): StimulusResult {
  const stimulus = zeroMuscleScores();
  const recovery_load = zeroMuscleScores();
  let totalSets = 0;
  let totalVolumeKg = 0;
  let missingSets = 0;

  for (const block of workout.blocks) {
    for (const exercise of block.exercises) {
      const targets = getExerciseTargets(exercise, muscleMap);

      for (const set of exercise.sets) {
        totalSets += 1;

        if (
          ((block.type === "strength" || block.type === "accessory") &&
            set.reps != null &&
            set.weight_kg == null &&
            workout.bodyweight_kg == null) ||
          ("prescription" in set && set.weight_kg == null)
        ) {
          missingSets += 1;
          continue;
        }
        const intensity = rpeFactor(set.rpe, rules);
        const isBodyweight = set.weight_kg == null;
        const baseLoad = isBodyweight
          ? (workout.bodyweight_kg ?? 0) *
            (set.bodyweight_factor ?? rules.default_bodyweight_factor)
          : (set.weight_kg ?? 0);
        const loadKg = baseLoad * (set.reps ?? 0) * intensity;

        totalVolumeKg += loadKg;

        for (const [muscleId, weight] of Object.entries(targets.primary) as Array<
          [MuscleId, number]
        >) {
          addMuscleLoad(stimulus, muscleId, loadKg * weight);
          addMuscleLoad(recovery_load, muscleId, loadKg * weight * rules.primary_recovery_factor);
        }

        for (const [muscleId, weight] of Object.entries(targets.secondary) as Array<
          [MuscleId, number]
        >) {
          addMuscleLoad(stimulus, muscleId, loadKg * weight * rules.secondary_stimulus_factor);
          addMuscleLoad(recovery_load, muscleId, loadKg * weight * rules.secondary_recovery_factor);
        }
      }
    }
  }

  return {
    total_sets: totalSets,
    total_volume_kg: missingSets ? null : round(totalVolumeKg),
    ...(missingSets ? { estimation_missing_sets: missingSets } : {}),
    stimulus: normalizeScores(stimulus, rules.stimulus_normalization_divisor),
    recovery_load: normalizeScores(recovery_load, rules.recovery_normalization_divisor)
  };
}

export function calculateWorkoutTotals(
  workout: Workout,
  rules: StimulusRules = defaultStimulusRules
) {
  let totalSets = 0;
  let totalVolumeKg = 0;
  let missingSets = 0;

  for (const block of workout.blocks) {
    for (const exercise of block.exercises) {
      for (const set of exercise.sets) {
        totalSets += 1;
        if (
          ((block.type === "strength" || block.type === "accessory") &&
            set.reps != null &&
            set.weight_kg == null &&
            workout.bodyweight_kg == null) ||
          ("prescription" in set && set.weight_kg == null)
        ) {
          missingSets += 1;
          continue;
        }
        const intensity = rpeFactor(set.rpe, rules);
        const loadKg =
          (set.weight_kg ?? workout.bodyweight_kg ?? 0) *
          (set.reps ?? 0) *
          intensity *
          (set.weight_kg == null ? (set.bodyweight_factor ?? rules.default_bodyweight_factor) : 1);
        totalVolumeKg += loadKg;
      }
    }
  }

  return { total_sets: totalSets, total_volume_kg: missingSets ? null : totalVolumeKg };
}

export function calculateRecovery(params: {
  recentWorkouts: Array<{ workout: Workout; stimulus: StimulusResult; daysAgo: number }>;
  readiness: Readiness;
  constraints?: { lower_back_sensitive?: boolean };
}): RecoveryResult {
  const muscles = calculateMuscleRecovery(params.recentWorkouts);
  const muscleScores = recentLoadScores(params.recentWorkouts);
  const readinessPenalty =
    params.readiness.fatigue * 4 +
    params.readiness.soreness * 3 +
    (10 - params.readiness.sleep_quality) * 2.5 +
    (10 - params.readiness.mood) * 1.5;
  const averageRecentLoad =
    muscleIds.reduce((sum, muscleId) => sum + muscleScores[muscleId], 0) / muscleIds.length;
  const warnings: string[] = [];

  if (
    params.constraints?.lower_back_sensitive &&
    muscleScores.erector_spinae_lower + muscleScores.quadratus_lumborum >= 20
  ) {
    warnings.push("lower_back_sensitive");
  }
  if (params.readiness.soreness >= 7) warnings.push("high_soreness");
  if (params.readiness.sleep_quality <= 4) warnings.push("low_sleep_quality");

  return {
    overall_score:
      params.recentWorkouts.length === 0 ||
      params.recentWorkouts.some(({ stimulus }) => stimulus.estimation_missing_sets)
        ? null
        : clamp(round(100 - readinessPenalty - averageRecentLoad * 1.8), 0, 100),
    muscles:
      params.recentWorkouts.length === 0 ||
      params.recentWorkouts.some(({ stimulus }) => stimulus.estimation_missing_sets)
        ? (Object.fromEntries(muscleIds.map((id) => [id, null])) as Record<MuscleId, null>)
        : muscles,
    warnings
  };
}

export function calculateMuscleRecovery(
  recentWorkouts: Array<{ stimulus: StimulusResult; daysAgo: number }>
) {
  const muscleScores = recentLoadScores(recentWorkouts);
  return Object.fromEntries(
    muscleIds.map((muscleId) => [muscleId, clamp(round(100 - muscleScores[muscleId]), 0, 100)])
  ) as Record<MuscleId, number>;
}

function normalizeScores(scores: Record<MuscleId, number>, divisor: number) {
  return Object.fromEntries(
    muscleIds.map((muscleId) => [muscleId, clamp(round((scores[muscleId] ?? 0) / divisor), 0, 100)])
  ) as Record<MuscleId, number>;
}

function recentLoadScores(recentWorkouts: Array<{ stimulus: StimulusResult; daysAgo: number }>) {
  const scores = zeroMuscleScores();
  for (const { stimulus, daysAgo } of recentWorkouts) {
    const ageWeight = 1 / (1 + daysAgo / 7);
    for (const muscleId of muscleIds) {
      addMuscleLoad(scores, muscleId, stimulus.stimulus[muscleId] * ageWeight);
    }
  }
  return scores;
}
