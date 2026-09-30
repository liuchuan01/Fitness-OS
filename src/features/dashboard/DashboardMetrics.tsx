import { useHudFocusTransition } from "./useHudFocusTransition";
import { HudCard } from "./HudCard";
import { OverviewHud } from "./OverviewHud";
import type { DailyWorkout, DashboardResponse } from "../../api/client";
import type { MuscleHistory } from "../../../shared/fitness/muscle-history-schema";
import "./body-hud.css";

type DashboardMetricsProps = {
  mode: string;
  dashboard: DashboardResponse["projection"] | null;
  dailyWorkout: DailyWorkout | null;
  focus?: {
    label: string;
    history: MuscleHistory | null;
    status: "loading" | "ready" | "error";
  } | null;
};

export function DashboardMetrics({ mode, dashboard, dailyWorkout, focus }: DashboardMetricsProps) {
  const hudRef = useHudFocusTransition(Boolean(focus));
  const history = focus?.history;
  const placeholder = focus?.status === "error" ? "暂不可用" : "读取中";
  return (
    <div
      ref={hudRef}
      className={`dashboard-hud body-hud ${focus ? "body-hud-focused" : mode === "overview" ? "body-hud-overview" : ""}`}
      aria-label={focus ? "肌肉概览 HUD" : mode === "overview" ? "首页身体数据" : "当日训练 HUD"}
    >
      {focus ? (
        <>
          <HudCard position="recovery" label="最近涉及训练" detail={focus.label}>
            <strong className="hud-date">
              {history ? (history.lastTrainedDate?.replace(/-/g, ".") ?? "暂无记录") : placeholder}
            </strong>
          </HudCard>
          <HudCard position="load" label="近 7 日训练" detail="关联该肌肉的训练次数">
            <strong>
              {history?.weekly.sessions ?? "—"}
              <small>次</small>
            </strong>
          </HudCard>
          <HudCard position="volume" label="主练 / 参与" detail="近 7 日 · 记录组数">
            <strong>
              {history?.weekly.primarySets ?? "—"}
              <em>/</em>
              {history?.weekly.secondarySets ?? "—"}
              <small>组</small>
            </strong>
          </HudCard>
          <HudCard
            position="stimulus"
            label="上次怎么练"
            detail={
              history?.history[0]?.exercises[0]
                ? `${history.history[0].exercises[0].sets.length} 组 · 完整记录见右侧详情`
                : "历史依据 · 从一次训练开始"
            }
          >
            <strong className="hud-action-name">
              {history ? (history.history[0]?.exercises[0]?.name ?? "尚无关联动作") : placeholder}
            </strong>
          </HudCard>
        </>
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
