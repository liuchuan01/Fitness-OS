import type { DailyWorkout, DashboardResponse, TodayPlan } from "../api/client";

export type AppMode = "overview" | "day" | "exercise" | "plan";

export const modeLabels: Record<AppMode, string> = {
  overview: "Overview",
  day: "Day",
  exercise: "Exercise",
  plan: "Plan"
};

export function formatDisplayDate(date?: string | null) {
  if (!date) return "正在同步";
  return date.replace(/-/g, ".");
}

export function getCanvasTitle(mode: AppMode, workoutTitle?: string, exerciseName?: string) {
  if (mode === "exercise") return exerciseName ?? "动作刺激";
  if (mode === "day") return workoutTitle ?? "恢复日";
  return "当前身体状态";
}

export function getCompactInsight(
  mode: AppMode,
  dashboard: DashboardResponse["projection"] | null,
  workout: DailyWorkout | null,
  todayPlan?: TodayPlan | null,
  exerciseName?: string
) {
  if (mode === "exercise") return exerciseName ?? "查看动作刺激";
  if (mode === "day") {
    return workout
      ? `${workout.totalSets} 组 · ${workout.blocks.flatMap((block) => block.exercises).length} 个动作`
      : "恢复日";
  }
  return todayPlan ? todayPlan.title : (dashboard?.coachInsight ?? "正在读取身体状态");
}
