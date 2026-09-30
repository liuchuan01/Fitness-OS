import type { MuscleHistory } from "../../../shared/fitness/muscle-history-schema";

export function formatRecordedSet(
  set: MuscleHistory["history"][number]["exercises"][number]["sets"][number]
) {
  const load =
    set.weight_kg != null
      ? `${set.weight_kg} kg`
      : set.bodyweight_factor != null
        ? `自重承重比例 ${Math.round(set.bodyweight_factor * 100)}%`
        : "负重未记录";
  const amount = [
    set.reps != null ? `${set.reps} 次` : null,
    set.duration_sec != null ? `${set.duration_sec} 秒` : null
  ]
    .filter(Boolean)
    .join(" · ");
  return `${load} · ${amount}${set.rpe != null ? ` · RPE ${set.rpe}` : ""}`;
}
