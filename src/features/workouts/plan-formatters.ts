import type { TodayPlan } from "../../api/client";

type PlanSet = TodayPlan["blocks"][number]["exercises"][number]["sets"][number];

export function countPlanExercises(plan: TodayPlan) {
  return plan.blocks.reduce((total, block) => total + block.exercises.length, 0);
}

export function countPlanSets(plan: TodayPlan) {
  return plan.blocks.reduce(
    (total, block) =>
      total +
      block.exercises.reduce((blockTotal, exercise) => blockTotal + exercise.sets.length, 0),
    0
  );
}

export function formatPlanSet(set: PlanSet) {
  const parts: string[] = [];

  if (set.duration_sec != null) {
    parts.push(`${set.duration_sec} 秒`);
  } else if (set.reps != null) {
    if (set.weight_kg != null) {
      parts.push(`${set.weight_kg} kg × ${set.reps}`);
    } else if (set.bodyweight_factor != null) {
      parts.push(`自重 ${Math.round(set.bodyweight_factor * 100)}% × ${set.reps}`);
    } else {
      parts.push(`${set.reps} 次 · 负重待选择`);
    }
  }

  if (set.prescription?.load_selection) parts.push(set.prescription.load_selection);
  if (set.prescription?.target_rpe != null) parts.push(`目标 RPE ${set.prescription.target_rpe}`);
  if (set.prescription?.target_rir != null)
    parts.push(`保留 ${set.prescription.target_rir} 次余力`);
  if (set.rpe != null) parts.push(`RPE ${set.rpe}`);
  return parts.length > 0 ? parts.join(" · ") : "按训练状态完成";
}

export function formatTodayPlanText(plan: TodayPlan) {
  const exerciseCount = countPlanExercises(plan);
  const setCount = countPlanSets(plan);
  const lines = [
    `今日训练计划｜${plan.date}`,
    plan.title,
    [
      plan.duration_min ? `${plan.duration_min} 分钟` : null,
      `${exerciseCount} 个动作`,
      `${setCount} 组`
    ]
      .filter(Boolean)
      .join(" · ")
  ];

  if (plan.goals?.length) lines.push(`目标：${plan.goals.join(" / ")}`);
  lines.push("");

  plan.blocks.forEach((block, blockIndex) => {
    lines.push(`${blockIndex + 1}. ${block.name}`);
    block.exercises.forEach((exercise) => {
      if (exercise.sets.length <= 1) {
        const summary = exercise.sets[0] ? formatPlanSet(exercise.sets[0]) : "未设置组次";
        lines.push(`- ${exercise.name}：${summary}`);
        return;
      }

      lines.push(`- ${exercise.name}`);
      exercise.sets.forEach((set, setIndex) => {
        lines.push(`  第 ${setIndex + 1} 组：${formatPlanSet(set)}`);
      });
    });
    lines.push("");
  });

  if (plan.user_note) lines.push(`训练提示：${plan.user_note}`);
  return lines.join("\n").trim();
}
