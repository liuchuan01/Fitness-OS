import { useHudFocusTransition } from "./useHudFocusTransition";
import { MuscleHud } from "./MuscleHud";
import { ExerciseHud } from "./ExerciseHud";
import type { ExerciseViewModel } from "../../../shared/fitness/projection";
import { HudCard } from "./HudCard";
import { OverviewHud } from "./OverviewHud";
import type { DailyWorkout, DashboardResponse } from "../../api/client";
import type { MuscleHistory } from "../../../shared/fitness/muscle-history-schema";
import "./body-hud.css";

type DashboardMetricsProps = {
  mode: string;
  dashboard: DashboardResponse["projection"] | null;
  dailyWorkout: DailyWorkout | null;
  exercise?: ExerciseViewModel;
  focus?: {
    label: string;
    history: MuscleHistory | null;
    status: "loading" | "ready" | "error";
  } | null;
};

export function DashboardMetrics({
  mode,
  dashboard,
  dailyWorkout,
  focus,
  exercise
}: DashboardMetricsProps) {
  const hudRef = useHudFocusTransition(Boolean(focus || exercise));
  return (
    <div
      ref={hudRef}
      className={`dashboard-hud body-hud ${focus || exercise ? "body-hud-focused" : mode === "overview" ? "body-hud-overview" : ""}`}
      aria-label={
        focus
          ? "肌肉概览 HUD"
          : exercise
            ? "动作概览 HUD"
            : mode === "overview"
              ? "首页身体数据"
              : "当日训练 HUD"
      }
    >
      {focus ? (
        <MuscleHud history={focus.history} status={focus.status} />
      ) : exercise ? (
        <ExerciseHud exercise={exercise} date={dailyWorkout?.date} />
      ) : mode === "overview" ? (
        <OverviewHud dashboard={dashboard} />
      ) : (
        <>
          <HudCard position="recovery" label="训练日期" detail="已完成的真实记录">
            <strong className="hud-date">
              {dailyWorkout?.date.replace(/-/g, ".") ?? "暂无记录"}
            </strong>
          </HudCard>
          <HudCard position="load" label="训练动作" detail="含热身与补充动作">
            <strong>
              {dailyWorkout?.blocks.flatMap((block) => block.exercises).length ?? "—"}
              <small>个</small>
            </strong>
          </HudCard>
          <HudCard position="volume" label="记录组数" detail="全部分区 · 完成记录">
            <strong>
              {dailyWorkout?.totalSets ?? "—"}
              <small>组</small>
            </strong>
          </HudCard>
          <HudCard position="stimulus" label="本次训练" detail="点击身体 · 追溯相关训练">
            <strong className="hud-action-name">{dailyWorkout?.title ?? "当天暂无训练"}</strong>
          </HudCard>
        </>
      )}
    </div>
  );
}
