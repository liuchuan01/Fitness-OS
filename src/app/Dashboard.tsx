import { DashboardHeader } from "./DashboardHeader";
import { lazy, Suspense, useMemo, useState } from "react";
import { DashboardMetrics } from "../features/dashboard/DashboardMetrics";
import { useDashboardData } from "../features/dashboard/useDashboardData";
import { WorkoutTimeline } from "../features/timeline/WorkoutTimeline";
import { InsightsPanel } from "../features/workouts/InsightsPanel";
import { TodayPlanDetail } from "../features/workouts/TodayPlanDetail";
import type { TodayPlan } from "../api/client";
import { muscleLabels, type MuscleId } from "../../shared/muscle-taxonomy";
import { useMuscleHistory } from "../features/muscles/useMuscleHistory";
import { MuscleHistoryPanel } from "../features/muscles/MuscleHistoryPanel";
import { getCanvasTitle, getCompactInsight, modeLabels } from "./view-helpers";
import type { AppMode } from "./view-helpers";
import { AgentChat } from "../features/chat/AgentChat";

import { OnboardingEntry } from "../features/onboarding/OnboardingEntry";

const BodyViewer3D = lazy(async () => {
  const module = await import("../features/body-3d/BodyViewer3D");
  return { default: module.BodyViewer3D };
});

export function Dashboard() {
  const [agentOpenRequest, setAgentOpenRequest] = useState(0);
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleId | null>(null);
  const [previewExerciseId, setPreviewExerciseId] = useState<string | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const {
    refreshVersion,
    focusedPlan,
    setFocusedPlan,
    clearWorkout,
    dailyWorkout,
    dashboard,
    isDailyWorkoutLoading,
    isServiceOffline,
    loadWorkout,
    dataSyncStatus,
    search,
    setSearch,
    todayPlan,
    timeline
  } = useDashboardData();

  async function selectDate(date: string, exerciseId?: string) {
    setSelectedMuscle(null);
    setPreviewExerciseId(null);
    setFocusedPlan(null);
    setSelectedDate(date);
    setActiveExerciseId(exerciseId ?? null);
    setSheetOpen(true);
    await loadWorkout(date);
  }

  function showOverview() {
    setSelectedMuscle(null);
    setPreviewExerciseId(null);
    setFocusedPlan(null);
    setSelectedDate(null);
    clearWorkout();
    setActiveExerciseId(null);
  }

  function showPlan(plan: TodayPlan) {
    setSelectedMuscle(null);
    setPreviewExerciseId(null);
    setSelectedDate(null);
    clearWorkout();
    setActiveExerciseId(null);
    setFocusedPlan(plan);
    setTimelineOpen(false);
    setSheetOpen(false);
  }

  const activeExercise = useMemo(
    () =>
      dailyWorkout?.blocks
        .flatMap((block) => block.exercises)
        .find((exercise) => exercise.id === activeExerciseId),
    [activeExerciseId, dailyWorkout]
  );

  const mode: AppMode = focusedPlan
    ? "plan"
    : activeExercise
      ? "exercise"
      : selectedDate
        ? "day"
        : "overview";

  const bodyProjection = dailyWorkout?.bodyProjection ?? dashboard?.bodyProjection ?? [];
  function selectMuscle(id: MuscleId | null) {
    setSelectedMuscle(id);
    setPreviewExerciseId(null);
    if (id) setSheetOpen(true);
  }

  const attentionMuscles = useMemo(
    () =>
      [...(dashboard?.bodyProjection ?? [])]
        .filter(
          (muscle) =>
            muscle.intensity >= 20 || (muscle.recoveryScore !== null && muscle.recoveryScore < 70)
        )
        .sort(
          (left, right) =>
            right.intensity -
            left.intensity +
            ((left.recoveryScore ?? 100) - (right.recoveryScore ?? 100)) * 0.35
        )
        .slice(0, 3),
    [dashboard]
  );

  const currentDate = focusedPlan?.date ?? selectedDate ?? dashboard?.date;
  const muscleQuery = useMuscleHistory(selectedMuscle, currentDate, refreshVersion);
  const exercisePreview =
    muscleQuery.state.status === "ready"
      ? muscleQuery.state.data.relatedExercises.find(
          (exercise) => exercise.exerciseId === previewExerciseId
        )
      : null;
  return (
    <main
      className={`shell ${sheetOpen ? "detail-open" : ""} ${selectedMuscle ? "muscle-focused" : ""} mode-${mode} ${timelineOpen ? "timeline-open" : ""}`}
    >
      <DashboardHeader
        mode={selectedMuscle ? "肌肉训练档案" : modeLabels[mode]}
        date={currentDate}
        timelineOpen={timelineOpen}
        onOverview={showOverview}
        onTimelineToggle={() => setTimelineOpen((open) => !open)}
      />

      <WorkoutTimeline
        currentDate={dashboard?.date}
        isOpen={timelineOpen}
        onDateSelect={(date) => void selectDate(date)}
        onOpenChange={setTimelineOpen}
        onSearchChange={setSearch}
        search={search}
        selectedDate={selectedDate}
        workouts={timeline}
      />

      <section
        className={mode === "plan" ? "plan-stage" : "body-stage"}
        aria-label={mode === "plan" ? "今日计划详情" : "Body dashboard"}
      >
        {dataSyncStatus !== "connected" ? (
          <p className="data-sync-notice glass-card" role="status">
            {dataSyncStatus === "invalid"
              ? "数据文件尚未通过校验，暂时保留上次显示结果。"
              : "数据同步连接已断开，正在重连…"}
          </p>
        ) : null}
        {mode === "plan" && focusedPlan ? (
          <TodayPlanDetail onBack={showOverview} plan={focusedPlan} />
        ) : (
          <>
            <Suspense
              fallback={
                <div className="body-3d-fallback" role="status">
                  正在加载 3D 身体模型…
                </div>
              }
            >
              <BodyViewer3D
                onExplorationChange={(open) => {
                  if (open) setSheetOpen(false);
                  else if (selectedMuscle) setSheetOpen(true);
                }}
                muscles={bodyProjection}
                selectedMuscle={selectedMuscle}
                onMuscleSelect={selectMuscle}
                exerciseTargets={exercisePreview ?? (selectedMuscle ? null : activeExercise)}
                exerciseName={exercisePreview?.name ?? (!selectedMuscle ? activeExercise?.name : undefined)}
                onResetFocus={() => { selectMuscle(null); setActiveExerciseId(null); }}
                projectionLabel={
                  mode === "overview" ? "近 7 日训练负荷估算 · 不代表恢复状态" : "当日训练刺激估算"
                }
              />
            </Suspense>

            <div className="canvas-context">
              <p>{selectedMuscle ? "训练档案" : modeLabels[mode]}</p>
              <strong>
                {selectedMuscle
                  ? muscleLabels[selectedMuscle]
                  : getCanvasTitle(mode, dailyWorkout?.title, activeExercise?.name)}
              </strong>
            </div>

            {dashboard && !dashboard.hasTrainingData && mode === "overview" && !selectedMuscle ? (
              <OnboardingEntry
                refreshVersion={refreshVersion}
                todayPlan={todayPlan}
                onPlan={showPlan}
                onAgent={() => setAgentOpenRequest((value) => value + 1)}
              />
            ) : null}

            {isServiceOffline ? (
              <div className="service-error glass-card" role="alert">
                身体数据暂时不可用，请检查本地服务后重试。
              </div>
            ) : null}

            <DashboardMetrics
              mode={mode}
              dashboard={dashboard}
              dailyWorkout={dailyWorkout}
              exercise={!selectedMuscle ? activeExercise : undefined}
              focus={
                selectedMuscle
                  ? {
                      label: muscleLabels[selectedMuscle],
                      history: muscleQuery.state.status === "ready" ? muscleQuery.state.data : null,
                      status: muscleQuery.state.status
                    }
                  : null
              }
            />

            <button
              aria-expanded={sheetOpen}
              className="mobile-insight-trigger glass-card"
              onClick={() => setSheetOpen(true)}
              type="button"
            >
              <span>
                {selectedMuscle ? "肌肉训练档案" : mode === "overview" ? "身体状态" : "训练详情"}
              </span>
              <strong>
                {selectedMuscle
                  ? muscleLabels[selectedMuscle]
                  : getCompactInsight(
                      mode,
                      dashboard,
                      dailyWorkout,
                      todayPlan,
                      activeExercise?.name
                    )}
              </strong>
            </button>
            <AgentChat openRequest={agentOpenRequest} />
          </>
        )}
      </section>

      <InsightsPanel
        key={selectedMuscle ?? selectedDate ?? mode}
        muscleContent={
          selectedMuscle ? (
            <MuscleHistoryPanel
              label={muscleLabels[selectedMuscle]}
              date={currentDate}
              query={muscleQuery}
              onBack={() => selectMuscle(null)}
              onHistorySelect={(date, id) => void selectDate(date, id)}
              onExercisePreview={setPreviewExerciseId}
              previewExerciseId={previewExerciseId}
            />
          ) : null
        }
        activeExerciseId={activeExerciseId}
        attentionMuscles={attentionMuscles}
        dashboard={dashboard}
        focusedPlan={focusedPlan}
        isLoading={isDailyWorkoutLoading}
        isOpen={sheetOpen}
        mode={mode}
        onClose={() => setSheetOpen(false)}
        onExerciseSelect={(id) => {
          setActiveExerciseId(id);
          setSheetOpen(true);
        }}
        onOverview={showOverview}
        onPlanOpen={showPlan}
        selectedDate={selectedDate ?? ""}
        todayPlan={todayPlan}
        workout={dailyWorkout}
      />
    </main>
  );
}
