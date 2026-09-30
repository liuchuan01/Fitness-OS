import type { DashboardResponse } from "../../api/client";
import { HudCard } from "./HudCard";
import "./overview-hud.css";

type OverviewHudProps = { dashboard: DashboardResponse["projection"] | null };

export function OverviewHud({ dashboard }: OverviewHudProps) {
  const latest = dashboard?.recentWorkouts.find(
    (workout) => workout.date === dashboard.lastWorkoutDate
  );
  const groups = dashboard?.muscleSetDistribution ?? [];
  const recent = dashboard?.recentWorkouts.slice(0, 3) ?? [];
  return (
    <>
      <HudCard
        anchored
        position="recovery"
        label="距上次训练"
        detail={
          <>
            <span className="hud-kicker">
              最近一次 · {dashboard?.lastWorkoutDate ?? "暂无记录"}
            </span>
            <p className="hud-record-title">{latest?.title ?? "记录一次训练，开始积累身体档案"}</p>
            {latest && (
              <div className="hud-fact-row">
                <span>全部分区记录</span>
                <b>{latest.totalSets} 组</b>
              </div>
            )}
            <p className="hud-footnote">训练间隔来自真实记录，不代表身体恢复程度。</p>
          </>
        }
      >
        <strong>
          {dashboard?.daysSinceLastWorkout ?? "—"}
          <small>天</small>
        </strong>
      </HudCard>
      <HudCard
        anchored
        position="load"
        label="近 7 日训练"
        detail={
          <>
            <div className="hud-fact-row">
              <span>已记录时长</span>
              <b>{dashboard?.weeklyTrainingMinutes ?? "—"} 分钟</b>
            </div>
            <span className="hud-kicker">最近训练记录</span>
            <ol className="hud-records">
              {recent.map((workout) => (
                <li key={workout.id}>
                  <time>{workout.date.slice(5).replace("-", ".")}</time>
                  <span>{workout.title}</span>
                </li>
              ))}
            </ol>
            {!recent.length && <p>暂无训练记录</p>}
            <p className="hud-footnote">
              次数与时长统计截至 {dashboard?.date ?? "—"} 的近 7 日；下方记录按历史日期展示。
            </p>
          </>
        }
      >
        <strong>
          {dashboard?.weeklyTrainingSessions ?? "—"}
          <small>次</small>
        </strong>
      </HudCard>
      <HudCard
        anchored
        position="volume"
        label="力量训练"
        detail={
          <>
            <div className="hud-fact-row">
              <span>平均 RPE</span>
              <b>{dashboard?.weeklyAverageRpe ?? "未填写"}</b>
            </div>
            <div className="hud-fact-row">
              <span>统计范围</span>
              <b>近 7 日</b>
            </div>
            <p className="hud-footnote">
              包含力量与补充分区，排除明确标记的热身组。未标记组仍计入记录，不等同于有效组。
            </p>
            <p className="hud-footnote">RPE 仅汇总已填写的主观用力程度。</p>
          </>
        }
      >
        <strong>
          {dashboard?.weeklyStrengthSets ?? "—"}
          <small>组</small>
        </strong>
      </HudCard>
      <HudCard
        anchored
        position="stimulus"
        label="肌群训练分布"
        detail={
          <>
            <span className="hud-kicker">近 7 日 · 肌群折算组</span>
            <ol className="hud-group-bars">
              {groups.map((group) => (
                <li key={group.groupId}>
                  <div>
                    <span>{group.labelZh}</span>
                    <b>
                      {group.sets}
                      <small>组</small>
                    </b>
                  </div>
                  <meter
                    aria-label={`${group.labelZh}折算组`}
                    min={0}
                    max={Math.max(groups[0]?.sets ?? 0, 1)}
                    value={group.sets}
                  />
                </li>
              ))}
            </ol>
            {!groups.length && <p>近 7 日暂无力量训练记录</p>}
            <p className="hud-footnote">
              主练计 1，参与计 0.5。同组可能涉及多个肌群，分布不代表恢复或训练效果。
            </p>
          </>
        }
      >
        <strong className="hud-distribution-summary" data-empty={!groups.length}>
          {groups[0]?.labelZh ?? "暂无记录"}
          {groups[0] && <small>{groups[0].sets} 组</small>}
        </strong>
      </HudCard>
    </>
  );
}
