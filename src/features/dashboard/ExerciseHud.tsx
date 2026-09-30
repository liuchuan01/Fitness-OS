import type { ExerciseViewModel } from "../../../shared/fitness/projection";
import { muscleLabels } from "../../../shared/muscle-taxonomy";
import { HudCard } from "./HudCard";

type ExerciseHudProps = { exercise: ExerciseViewModel; date?: string };

export function ExerciseHud({ exercise, date }: ExerciseHudProps) {
  return (
    <>
      <HudCard anchored position="recovery" label="训练日期" detail={exercise.name}>
        <strong className="hud-date">{date?.replace(/-/g, ".") ?? "暂无记录"}</strong>
      </HudCard>
      <HudCard
        anchored
        position="load"
        label="动作记录"
        detail="当前动作的实际记录组数，含热身；每组参数见训练详情。"
      >
        <strong>
          {exercise.sets.length}
          <small>组</small>
        </strong>
      </HudCard>
      <HudCard
        anchored
        position="volume"
        label="主练部位"
        detail={exercise.primaryMuscles.map((id) => muscleLabels[id]).join("、") || "暂无映射"}
      >
        <strong>
          {exercise.primaryMuscles.length}
          <small>处</small>
        </strong>
      </HudCard>
      <HudCard
        anchored
        position="stimulus"
        label="参与部位"
        detail={exercise.secondaryMuscles.map((id) => muscleLabels[id]).join("、") || "暂无映射"}
      >
        <strong>
          {exercise.secondaryMuscles.length}
          <small>处</small>
        </strong>
      </HudCard>
    </>
  );
}
