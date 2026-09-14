import { getExerciseTargets } from "./calculation.js";
import { exerciseLabels } from "./exercise-labels.js";
import type { MuscleHistory } from "./muscle-history-schema.js";
import { muscleLabels, type MuscleId, type MuscleMap, type Workout } from "./schema.js";
import { exerciseViewId, getRecordedStrengthSets, isInTrainingWindow } from "./training-records.js";

export function buildMuscleHistory(params: {
  muscleId: MuscleId;
  date: string;
  workouts: Workout[];
  muscleMap: MuscleMap;
}): MuscleHistory {
  const { muscleId, date, muscleMap } = params;
  const workouts = params.workouts
    .filter((workout) => workout.date <= date)
    .sort((left, right) => right.date.localeCompare(left.date) || left.id.localeCompare(right.id));
  const history: MuscleHistory["history"] = [];
  const weekly = { sessions: 0, primarySets: 0, secondarySets: 0, unclassifiedSets: 0 };
  for (const workout of workouts) {
    const exercises: MuscleHistory["history"][number]["exercises"] = [];
    workout.blocks.forEach((block, blockIndex) =>
      block.exercises.forEach((exercise, index) => {
        const targets = getExerciseTargets(exercise, muscleMap);
        const relation = targets.primary[muscleId]
          ? "primary"
          : targets.secondary[muscleId]
            ? "secondary"
            : null;
        const sets = getRecordedStrengthSets(block, index);
        if (!relation || !sets.length) return;
        exercises.push({
          viewId: exerciseViewId(workout, blockIndex, index),
          exerciseId: exercise.exercise_id ?? exercise.name,
          name: exercise.name,
          relation,
          sets
        });
        if (isInTrainingWindow(workout.date, date)) {
          weekly[relation === "primary" ? "primarySets" : "secondarySets"] += sets.length;
          weekly.unclassifiedSets += sets.filter((set) => set.kind == null).length;
        }
      })
    );
    if (!exercises.length) continue;
    history.push({ workoutId: workout.id, date: workout.date, title: workout.title, exercises });
    if (isInTrainingWindow(workout.date, date)) weekly.sessions += 1;
  }

  const relatedExercises: MuscleHistory["relatedExercises"] = [];
  for (const [exerciseId, targets] of Object.entries(muscleMap)) {
    const relation = targets.primary[muscleId]
      ? "primary"
      : targets.secondary[muscleId]
        ? "secondary"
        : null;
    if (!relation) continue;
    const last = history.find((entry) =>
      entry.exercises.some((exercise) => exercise.exerciseId === exerciseId)
    );
    const recordedName = last?.exercises.find(
      (exercise) => exercise.exerciseId === exerciseId
    )?.name;
    relatedExercises.push({
      exerciseId,
      name: recordedName ?? exerciseLabels[exerciseId] ?? "未命名动作",
      relation,
      primaryMuscles: Object.keys(targets.primary) as MuscleId[],
      secondaryMuscles: (Object.keys(targets.secondary) as MuscleId[]).filter(
        (id) => !targets.primary[id]
      ),
      lastTrainedDate: last?.date ?? null
    });
  }
  relatedExercises.sort(
    (left, right) =>
      Number(right.lastTrainedDate != null) - Number(left.lastTrainedDate != null) ||
      (right.lastTrainedDate ?? "").localeCompare(left.lastTrainedDate ?? "") ||
      Number(right.relation === "primary") - Number(left.relation === "primary") ||
      left.exerciseId.localeCompare(right.exerciseId)
  );
  const start = new Date(`${date}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 6);
  return {
    muscleId,
    labelZh: muscleLabels[muscleId],
    asOf: date,
    windowStart: start.toISOString().slice(0, 10),
    lastTrainedDate: history[0]?.date ?? null,
    lastPrimaryDate:
      history.find((entry) => entry.exercises.some((exercise) => exercise.relation === "primary"))
        ?.date ?? null,
    weekly,
    history,
    relatedExercises
  };
}
