import { useEffect, useRef, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { muscleLabels } from "../../../shared/muscle-taxonomy";
import { Metric } from "../../components/Metric";
import type { MuscleVisualState } from "../../../shared/fitness/index";
import type { MuscleId } from "../../../shared/muscle-taxonomy";
import type { DailyWorkout, DashboardResponse, TodayPlan } from "../../api/client";
import { TodayPlanSummary } from "./PlanSummaryCards";
import { TodayPlanContext } from "./TodayPlanDetail";

type InsightsPanelProps = {
  muscleContent?: ReactNode;
  activeExerciseId: string | null;
  attentionMuscles: MuscleVisualState[];
  dashboard: DashboardResponse["projection"] | null;
  focusedPlan: TodayPlan | null;
  isLoading: boolean;
  isOpen: boolean;
  mode: "overview" | "day" | "exercise" | "plan";
  onClose: () => void;
  onExerciseSelect: (id: string) => void;
  onOverview: () => void;
  onPlanOpen: (plan: TodayPlan) => void;
  selectedDate: string;
  todayPlan: TodayPlan | null;
  workout: DailyWorkout | null;
};

export function InsightsPanel({
  muscleContent,
  activeExerciseId,
  attentionMuscles,
  dashboard,
  focusedPlan,
  isLoading,
  isOpen,
  mode,
  onClose,
  onExerciseSelect,
  onOverview,
  onPlanOpen,
  selectedDate,
  todayPlan,
  workout
}: InsightsPanelProps) {
  return (
    <aside className={`insights ${isOpen ? "sheet-open" : ""}`} aria-label="Training insights">
      <button aria-label="关闭详情" className="sheet-handle" onClick={onClose} type="button">
        <span />
      </button>
      {muscleContent ??
        (mode === "plan" && focusedPlan ? (
          <TodayPlanContext plan={focusedPlan} />
        ) : mode === "overview" ? (
          <OverviewPanel
            attentionMuscles={attentionMuscles}
            dashboard={dashboard}
            onPlanOpen={onPlanOpen}
            todayPlan={todayPlan}
          />
        ) : (
          <DailyWorkoutPanel
            activeExerciseId={activeExerciseId}
            loading={isLoading}
            onExerciseSelect={onExerciseSelect}
            onOverview={onOverview}
            selectedDate={selectedDate}
            workout={workout}
          />
        ))}
    </aside>
  );
}

function OverviewPanel({
  attentionMuscles,
  dashboard,
  onPlanOpen,
  todayPlan
}: {
  attentionMuscles: MuscleVisualState[];
  dashboard: DashboardResponse["projection"] | null;
  onPlanOpen: (plan: TodayPlan) => void;
  todayPlan: TodayPlan | null;
}) {
  return (
    <div className="context-content">
      <div className="context-heading">
        <p className="eyebrow">Training rhythm</p>
        <h2>今天的身体状态</h2>
      </div>
      <div className="hero-metric">
        <strong>{dashboard?.daysSinceLastWorkout ?? "—"}</strong>
        <span>
          <b>天</b>
          距上次训练
        </span>
      </div>
      <div className="insight-card glass-card">
        <span>当前判断</span>
        <strong>{dashboard?.coachInsight ?? "正在读取身体状态…"}</strong>
        <p>{getTrainingRhythmCopy(dashboard?.daysSinceLastWorkout)}</p>
      </div>
      {attentionMuscles.length > 0 ? (
        <section className="attention-list">
          <div className="section-heading">
            <h3>近期训练涉及</h3>
            <span>{attentionMuscles.length} 项</span>
          </div>
          <p className="attention-list-note">近 7 日负荷估算 · 不代表恢复状态</p>
          {attentionMuscles.map((muscle) => (
            <div className="attention-row" key={muscle.muscleId}>
              <i aria-hidden="true" className={`state-dot ${muscle.status}`} />
              <span>
                <strong>{muscle.labelZh}</strong>
              </span>
            </div>
          ))}
        </section>
      ) : null}
      <TodayPlanSummary onOpen={onPlanOpen} plan={todayPlan} />
    </div>
  );
}

function DailyWorkoutPanel({
  activeExerciseId,
  loading,
  onExerciseSelect,
  onOverview,
  selectedDate,
  workout
}: {
  activeExerciseId: string | null;
  loading: boolean;
  onExerciseSelect: (id: string) => void;
  onOverview: () => void;
  selectedDate: string;
  workout: DailyWorkout | null;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    contentRef.current
      ?.querySelector('[aria-pressed="true"]')
      ?.scrollIntoView?.({ block: "nearest" });
  }, [activeExerciseId, workout]);
  if (loading) {
    return (
      <p className="loading-state" role="status">
        正在读取 {selectedDate}…
      </p>
    );
  }

  return (
    <div className="context-content" ref={contentRef}>
      <button className="back-button" onClick={onOverview} type="button">
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
        返回身体概览
      </button>
      <div className="context-heading">
        <p className="eyebrow">Daily workout · {selectedDate}</p>
        <h2>{workout?.title ?? "恢复日"}</h2>
      </div>
      {!workout ? (
        <div className="daily-empty" role="status">
          <strong>当天没有训练记录</strong>
          <span>身体将按恢复日继续计算。</span>
        </div>
      ) : (
        <>
          <div className="summary-metrics">
            <Metric label="记录组数" value={workout.totalSets} suffix=" 组" />
            <Metric
              label="动作数量"
              value={workout.blocks.flatMap((block) => block.exercises).length}
              suffix=" 个"
            />
          </div>
          {workout.blocks.map((block) => (
            <section className="workout-block" key={`${block.type}-${block.name}`}>
              <div className="section-heading">
                <h3>{block.name}</h3>
                <span>{block.exercises.length} 个动作</span>
              </div>
              {block.exercises.map((exercise) => (
                <button
                  aria-pressed={activeExerciseId === exercise.id}
                  className={`exercise-card glass-card ${activeExerciseId === exercise.id ? "active" : ""}`}
                  key={exercise.id}
                  onClick={() => onExerciseSelect(exercise.id)}
                  type="button"
                >
                  <span className="exercise-title">
                    <strong>{exercise.name}</strong>
                    <small>{formatSetSummary(exercise)}</small>
                  </span>
                  {exercise.primaryMuscles.length > 0 ? (
                    <span className="exercise-targets">
                      <b>主练</b> {formatMuscles(exercise.primaryMuscles)}
                    </span>
                  ) : (
                    <span className="exercise-targets secondary">
                      {exercise.source?.system === "ai-motion-coach"
                        ? "摄像头动作记录，未估算肌肉刺激"
                        : "恢复 / 活动动作，不计肌肉刺激"}
                    </span>
                  )}
                  {exercise.secondaryMuscles.length > 0 ? (
                    <span className="exercise-targets secondary">
                      <b>参与</b> {formatMuscles(exercise.secondaryMuscles)}
                    </span>
                  ) : null}
                </button>
              ))}
            </section>
          ))}
        </>
      )}
    </div>
  );
}

function formatMuscles(muscles: MuscleId[]) {
  return muscles.map((muscle) => muscleLabels[muscle]).join("、");
}

function formatSetSummary(exercise: DailyWorkout["blocks"][number]["exercises"][number]) {
  const source = exercise.source;
  if (source?.system === "ai-motion-coach") {
    if (source.exercise === "plank")
      return `保持 ${(source.hold?.heldMs ?? 0) / 1000} 秒 · 最长 ${(source.hold?.bestMs ?? 0) / 1000} 秒`;
    if (source.exercise === "dumbbell_curl")
      return `左手 ${source.arm_counts?.left ?? 0} 次 · 右手 ${source.arm_counts?.right ?? 0} 次 · 共 ${source.rep_count} 次（每只手各计一次） · 重量未记录`;
    const unit = source.twist_count_unit === "sides" ? "（左、右每侧各计一次）" : "";
    return `${source.rep_count} 次${unit} · ${source.attempt_count} 次尝试`;
  }
  const sets = exercise.sets;
  if (sets.length === 0) return "未记录组数";
  const first = sets[0];
  const load =
    first.weight_kg == null
      ? "自重"
      : first.weight_kg === 0
        ? "重量未记录"
        : `${first.weight_kg} kg`;
  const rpeValues = sets.flatMap((set) => (set.rpe == null ? [] : [set.rpe]));
  const averageRpe =
    rpeValues.length > 0
      ? ` · RPE ${(rpeValues.reduce((sum, value) => sum + value, 0) / rpeValues.length).toFixed(1)}`
      : "";
  const effort = first.reps != null ? `${load} × ${first.reps}` : `${first.duration_sec ?? 0} 秒`;
  return `${sets.length} 组 · ${effort}${averageRpe}`;
}

function getTrainingRhythmCopy(days?: number | null) {
  if (days == null) return "完成第一次训练后开始计算训练节奏。";
  if (days === 0) return "今天已经完成训练。";
  if (days === 1) return "上次训练在昨天，结合肌肉恢复分布安排今天。";
  return `已经休息 ${days} 天，可结合训练重点安排下一次训练。`;
}
