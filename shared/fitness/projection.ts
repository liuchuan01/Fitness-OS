import {
  daysBetween,
  exerciseViewId,
  getRecordedStrengthSets,
  isInTrainingWindow
} from "./training-records.js";
import {
  muscleGroup,
  muscleGroupIds,
  muscleGroupLabels,
  type MuscleGroupId
} from "./muscle-groups.js";
import type { z } from "zod";
import {
  calculateMuscleRecovery,
  calculateStimulus,
  calculateWorkoutTotals,
  clamp,
  defaultStimulusRules,
  getExerciseTargets,
  round,
  zeroMuscleScores
} from "./calculation.js";
import {
  muscleIds,
  muscleLabels,
  type MuscleId,
  type MuscleMap,
  type Plan,
  type StimulusRules,
  type Workout
} from "./schema.js";
import type { setSchema } from "./schema.js";

export type MuscleVisualState = {
  muscleId: MuscleId;
  labelZh: string;
  intensity: number;
  recoveryScore: number | null;
  selected: boolean;
  hovered: boolean;
  status: "gray" | "blue" | "orange" | "red" | "purple";
};

export type WorkoutSummary = {
  id: string;
  date: string;
  title: string;
  totalSets: number;
  totalVolumeKg: number | null;
};

export type TimelineGroup = "today" | "yesterday" | "this_week" | "earlier";
export type TimelineWorkout = WorkoutSummary & { intensity: number; group: TimelineGroup };
export type ExerciseViewModel = {
  id: string;
  name: string;
  sets: Array<z.infer<typeof setSchema>>;
  source?: Workout["blocks"][number]["exercises"][number]["source"];
  primaryMuscles: MuscleId[];
  secondaryMuscles: MuscleId[];
};
export type WorkoutBlockViewModel = {
  type: string;
  name: string;
  exercises: ExerciseViewModel[];
};
export type DailyWorkoutViewModel = WorkoutSummary & {
  bodyweightKg?: number;
  readiness: Workout["readiness"];
  blocks: WorkoutBlockViewModel[];
  bodyProjection: MuscleVisualState[];
};
export type PlanPreview = WorkoutSummary & {
  computedExpectedStimulus: Record<MuscleId, number>;
  warnings: string[];
};

export type DashboardViewModel = {
  date: string;
  hasTrainingData: boolean;
  lastWorkoutDate: string | null;
  daysSinceLastWorkout: number | null;
  weeklyTrainingSessions: number;
  weeklyTrainingMinutes: number;
  weeklyStrengthSets: number;
  weeklyAverageRpe: number | null;
  muscleSetDistribution: Array<{ groupId: MuscleGroupId; labelZh: string; sets: number }>;
  bodyProjection: MuscleVisualState[];
  recentWorkouts: WorkoutSummary[];
  coachInsight: string;
  computedStimulus: Record<MuscleId, number>;
  computedRecoveryLoad: Record<MuscleId, number>;
};

function muscleIntensity(score: number): MuscleVisualState["status"] {
  if (score >= 75) return "red";
  if (score >= 50) return "orange";
  if (score >= 20) return "blue";
  return "gray";
}

function workoutToSummary(
  workout: Workout,
  rules: StimulusRules = defaultStimulusRules
): WorkoutSummary {
  const totalSets = workout.blocks.reduce(
    (sum, block) =>
      sum +
      block.exercises.reduce((exerciseSum, exercise) => exerciseSum + exercise.sets.length, 0),
    0
  );
  return {
    id: workout.id,
    date: workout.date,
    title: workout.title,
    totalSets,
    totalVolumeKg:
      calculateWorkoutTotals(workout, rules).total_volume_kg == null
        ? null
        : round(calculateWorkoutTotals(workout, rules).total_volume_kg!)
  };
}

function buildWeeklyTrainingSummary(workouts: Workout[], muscleMap: MuscleMap, date: string) {
  const weeklyWorkouts = workouts.filter((workout) => {
    return isInTrainingWindow(workout.date, date);
  });
  const distribution = Object.fromEntries(muscleGroupIds.map((groupId) => [groupId, 0])) as Record<
    MuscleGroupId,
    number
  >;
  const strengthSets: Array<z.infer<typeof setSchema>> = [];
  for (const workout of weeklyWorkouts)
    for (const block of workout.blocks) {
      for (const [index, exercise] of block.exercises.entries()) {
        const sets = getRecordedStrengthSets(block, index);
        strengthSets.push(...sets);
        const targets = getExerciseTargets(exercise, muscleMap);
        const primaryGroups = new Set(
          (Object.keys(targets.primary) as MuscleId[])
            .map(muscleGroup)
            .filter((group): group is MuscleGroupId => group !== null)
        );
        const secondaryGroups = new Set(
          (Object.keys(targets.secondary) as MuscleId[])
            .map(muscleGroup)
            .filter((group): group is MuscleGroupId => group !== null)
            .filter((group) => !primaryGroups.has(group))
        );
        for (const group of primaryGroups) distribution[group] += sets.length;
        for (const group of secondaryGroups) distribution[group] += sets.length * 0.5;
      }
    }
  const recordedRpes = strengthSets.flatMap((set) => (set.rpe == null ? [] : [set.rpe]));
  return {
    weeklyTrainingSessions: weeklyWorkouts.length,
    weeklyTrainingMinutes: weeklyWorkouts.reduce(
      (sum, workout) => sum + (workout.duration_min ?? 0),
      0
    ),
    weeklyStrengthSets: strengthSets.length,
    weeklyAverageRpe: recordedRpes.length
      ? Math.round((recordedRpes.reduce((sum, rpe) => sum + rpe, 0) / recordedRpes.length) * 10) /
        10
      : null,
    muscleSetDistribution: muscleGroupIds
      .map((groupId) => ({
        groupId,
        labelZh: muscleGroupLabels[groupId],
        sets: Math.round(distribution[groupId] * 10) / 10
      }))
      .filter((group) => group.sets > 0)
      .sort((left, right) => right.sets - left.sets)
  };
}

export function buildTimeline(
  workouts: Workout[],
  muscleMap: MuscleMap,
  rules: StimulusRules = defaultStimulusRules,
  today = new Date().toISOString().slice(0, 10)
): TimelineWorkout[] {
  return [...workouts]
    .sort((left, right) => right.date.localeCompare(left.date))
    .map((workout) => {
      const computed = workout.computed ?? calculateStimulus(workout, muscleMap, rules);
      const scores = Object.values(computed.stimulus).filter((score) => score > 0);
      const daysAgo = daysBetween(today, workout.date);
      return {
        ...workoutToSummary(workout, rules),
        intensity: scores.length
          ? round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
          : 0,
        group:
          daysAgo === 0
            ? "today"
            : daysAgo === 1
              ? "yesterday"
              : daysAgo <= 6
                ? "this_week"
                : "earlier"
      };
    });
}

export function buildDailyWorkoutView(
  workout: Workout,
  muscleMap: MuscleMap,
  rules: StimulusRules = defaultStimulusRules
): DailyWorkoutViewModel {
  const computed = workout.computed ?? calculateStimulus(workout, muscleMap, rules);
  return {
    ...workoutToSummary(workout, rules),
    bodyweightKg: workout.bodyweight_kg,
    readiness: workout.readiness,
    blocks: workout.blocks.map((block, blockIndex) => ({
      type: block.type,
      name: block.name,
      exercises: block.exercises.map((exercise, index) => {
        const targets = getExerciseTargets(exercise, muscleMap);
        return {
          id: exerciseViewId(workout, blockIndex, index),
          name: exercise.name,
          sets: exercise.sets,
          source: exercise.source,
          primaryMuscles: Object.keys(targets.primary) as MuscleId[],
          secondaryMuscles: Object.keys(targets.secondary) as MuscleId[]
        };
      })
    })),
    bodyProjection: muscleIds.map((muscleId) => {
      const intensity = computed.stimulus[muscleId] ?? 0;
      const recoveryLoad = computed.recovery_load[muscleId] ?? 0;
      return {
        muscleId,
        labelZh: muscleLabels[muscleId],
        intensity,
        recoveryScore: computed.estimation_missing_sets ? null : clamp(100 - recoveryLoad, 0, 100),
        selected: false,
        hovered: false,
        status: muscleIntensity(intensity)
      };
    })
  };
}

export function buildPlanPreview(
  plan: Plan,
  muscleMap: MuscleMap,
  rules: StimulusRules = defaultStimulusRules
): PlanPreview {
  const expected = calculateStimulus(plan, muscleMap, rules);
  const knownIds = new Set(Object.keys(muscleMap));
  const warnings = [
    ...new Set(
      plan.blocks.flatMap((block) =>
        block.exercises
          .filter((exercise) => !knownIds.has(exercise.exercise_id ?? exercise.name))
          .map((exercise) => exercise.exercise_id ?? exercise.name)
      )
    )
  ].map((id) => `unknown_exercise_id:${id}`);
  return {
    ...workoutToSummary(plan, rules),
    computedExpectedStimulus: expected.stimulus,
    warnings: expected.estimation_missing_sets
      ? [...warnings, "load_estimate_unavailable"]
      : warnings
  };
}

export function buildEmptyDashboardProjection(params: { date: string }): DashboardViewModel {
  const empty = zeroMuscleScores();
  return {
    date: params.date,
    hasTrainingData: false,
    lastWorkoutDate: null,
    daysSinceLastWorkout: null,
    weeklyTrainingSessions: 0,
    weeklyTrainingMinutes: 0,
    weeklyStrengthSets: 0,
    weeklyAverageRpe: null,
    muscleSetDistribution: [],
    bodyProjection: muscleIds.map((muscleId) => ({
      muscleId,
      labelZh: muscleLabels[muscleId],
      intensity: 0,
      recoveryScore: null,
      selected: false,
      hovered: false,
      status: "gray"
    })),
    recentWorkouts: [],
    coachInsight: "暂无训练记录。选择恢复日，或完成一次训练后查看身体热力图。",
    computedStimulus: { ...empty },
    computedRecoveryLoad: { ...empty }
  };
}

export function buildDashboardProjection(params: {
  date: string;
  recentWorkouts: Workout[];
  currentWorkout: Workout;
  muscleMap: MuscleMap;
  stimulusRules?: StimulusRules;
  constraints?: { lower_back_sensitive?: boolean };
  coachInsight?: string;
}): DashboardViewModel {
  const rules = params.stimulusRules ?? defaultStimulusRules;
  const currentStimulus = calculateStimulus(params.currentWorkout, params.muscleMap, rules);
  const recentStimuli = params.recentWorkouts
    .map((workout) => ({
      workout,
      stimulus: calculateStimulus(workout, params.muscleMap, rules),
      daysAgo: Math.max(0, daysBetween(params.date, workout.date))
    }))
    .filter(({ daysAgo }) => daysAgo <= 6);
  const recovery = calculateMuscleRecovery(recentStimuli);
  const weeklySummary = buildWeeklyTrainingSummary(
    params.recentWorkouts,
    params.muscleMap,
    params.date
  );
  return {
    date: params.date,
    hasTrainingData: true,
    lastWorkoutDate: params.currentWorkout.date,
    daysSinceLastWorkout: Math.max(0, daysBetween(params.date, params.currentWorkout.date)),
    ...weeklySummary,
    bodyProjection: muscleIds.map((muscleId) => {
      const recoveryScore =
        recentStimuli.length === 0 ||
        recentStimuli.some(({ stimulus }) => stimulus.estimation_missing_sets)
          ? null
          : recovery[muscleId];
      const intensity = recoveryScore == null ? 0 : 100 - recoveryScore;
      return {
        muscleId,
        labelZh: muscleLabels[muscleId],
        intensity,
        recoveryScore,
        selected: false,
        hovered: false,
        status:
          recoveryScore !== null && recoveryScore <= 35 ? "purple" : muscleIntensity(intensity)
      };
    }),
    recentWorkouts: params.recentWorkouts.map((workout) => workoutToSummary(workout, rules)),
    coachInsight:
      params.coachInsight ??
      `近 7 日记录了 ${weeklySummary.weeklyTrainingSessions} 次训练、${weeklySummary.weeklyStrengthSets} 组力量训练。点击身体查看历史依据。`,
    computedStimulus: currentStimulus.stimulus,
    computedRecoveryLoad: currentStimulus.recovery_load
  };
}
