import type { Workout } from "./schema.js";

export function daysBetween(later: string, earlier: string) {
  return Math.round(
    (Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / 86_400_000
  );
}

export function isInTrainingWindow(date: string, asOf: string) {
  const age = daysBetween(asOf, date);
  return age >= 0 && age < 7;
}

export function getRecordedStrengthSets(block: Workout["blocks"][number], exerciseIndex: number) {
  if (block.type !== "strength" && block.type !== "accessory") return [];
  return block.exercises[exerciseIndex].sets.filter((set) => set.kind !== "warmup");
}

export function exerciseViewId(workout: Workout, blockIndex: number, exerciseIndex: number) {
  const exercise = workout.blocks[blockIndex].exercises[exerciseIndex];
  return `${workout.id}-${blockIndex}-${exerciseIndex}-${exercise.exercise_id ?? exercise.name}`;
}
