import { useState } from "react";
import { ArrowLeft, ArrowUpRight, ChevronDown, ChevronUp, RotateCw } from "lucide-react";
import type { MuscleHistory } from "../../../shared/fitness/muscle-history-schema";
import { muscleLabels } from "../../../shared/muscle-taxonomy";
import type { useMuscleHistory } from "./useMuscleHistory";

type MuscleHistoryPanelProps = {
  label: string;
  date?: string;
  query: ReturnType<typeof useMuscleHistory>;
  onBack: () => void;
  onHistorySelect: (date: string, exerciseViewId: string) => void;
  previewExerciseId: string | null;
  onExercisePreview: (exerciseId: string | null) => void;
};

export function MuscleHistoryPanel({
  label,
  date,
  query,
  onBack,
  onHistorySelect,
  onExercisePreview,
  previewExerciseId
}: MuscleHistoryPanelProps) {
  return (
    <div className="context-content muscle-history" aria-label="肌肉训练档案">
      <button className="back-button" type="button" onClick={onBack}>
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
        返回原视图
      </button>
      <div className="context-heading">
        <p className="eyebrow">训练档案 · 截至 {date}</p>
        <h2>{label}</h2>
      </div>
      {query.state.status === "loading" ? (
        <p role="status">正在读取相关训练…</p>
      ) : query.state.status === "error" ? (
        <div role="alert">
          <p>训练档案暂时不可用。</p>
          <button className="back-button" type="button" onClick={query.retry}>
            <RotateCw size={16} strokeWidth={1.75} aria-hidden="true" />
            重新加载
          </button>
        </div>
      ) : (
        <HistoryContent
          key={`${query.state.data.muscleId}:${date}`}
          data={query.state.data}
          onHistorySelect={onHistorySelect}
          onExercisePreview={onExercisePreview}
          previewExerciseId={previewExerciseId}
        />
      )}
    </div>
  );
}

function HistoryContent({
  data,
  onHistorySelect,
  onExercisePreview,
  previewExerciseId
}: {
  data: MuscleHistory;
  onHistorySelect: MuscleHistoryPanelProps["onHistorySelect"];
  onExercisePreview: MuscleHistoryPanelProps["onExercisePreview"];
  previewExerciseId: string | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const history = showAll ? data.history : data.history.slice(0, 3);
  return (
    <>
      <div className="muscle-last-training">
        <span>最近涉及该肌肉</span>
        <strong>{data.lastTrainedDate ?? "暂无训练记录"}</strong>
        <small>最近主练：{data.lastPrimaryDate ?? "暂无记录"}</small>
      </div>
      <section className="muscle-week" aria-label="肌肉近七日统计">
        <h3>近 7 日 · {data.weekly.sessions} 次训练</h3>
        <p>
          {data.windowStart} — {data.asOf}
        </p>
        <div>
          <strong>
            {data.weekly.primarySets}
            <small> 主练记录组</small>
          </strong>
          <strong>
            {data.weekly.secondarySets}
            <small> 参与记录组</small>
          </strong>
        </div>
        <p>按动作映射归类，不代表实际刺激效果。已排除明确热身组。</p>
        {data.weekly.unclassifiedSets > 0 && (
          <p>{data.weekly.unclassifiedSets} 组未标记热身／工作类型，暂按记录计数。</p>
        )}
      </section>
      <section aria-label="关联训练历史">
        <h3>以前怎么练的</h3>
        {data.history.length === 0 && (
          <p>截至这一天，没有关联力量训练记录。没有记录不代表从未练过。</p>
        )}
        {history.map((entry) => (
          <article className="muscle-history-entry" key={entry.workoutId}>
            <p>
              <time dateTime={entry.date}>{entry.date}</time> · {entry.title}
            </p>
            {entry.exercises.map((exercise) => (
              <div key={exercise.viewId}>
                <button
                  className="muscle-history-link"
                  type="button"
                  onClick={() => onHistorySelect(entry.date, exercise.viewId)}
                >
                  <strong>
                    {exercise.name}
                    <ArrowUpRight size={16} strokeWidth={1.75} aria-hidden="true" />
                  </strong>
                  <span>
                    {exercise.relation === "primary" ? "主练" : "参与"} · {exercise.sets.length} 组
                  </span>
                </button>
                <ol className="muscle-set-list">
                  {exercise.sets.map((set, index) => (
                    <li key={index}>{formatRecordedSet(set)}</li>
                  ))}
                </ol>
              </div>
            ))}
          </article>
        ))}
        {data.history.length > 3 && (
          <button
            className="back-button"
            type="button"
            aria-expanded={showAll}
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? (
              <ChevronUp size={16} strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" />
            )}
            {showAll ? "收起历史" : `查看全部 ${data.history.length} 次训练`}
          </button>
        )}
      </section>
      <section className="muscle-next" aria-label="相关动作选择">
        <h3>下一步 · 了解相关动作</h3>
        <p>优先展示你练过的动作。点击查看涉及部位；是否适合下次训练，还需结合计划和当日感受。</p>
        {data.relatedExercises.length === 0 && <p>动作库暂未建立该肌肉的关联。</p>}
        {data.relatedExercises.map((exercise) => (
          <div className="muscle-related" key={exercise.exerciseId}>
            <button
              type="button"
              aria-pressed={previewExerciseId === exercise.exerciseId}
              onClick={() => {
                onExercisePreview(
                  previewExerciseId === exercise.exerciseId ? null : exercise.exerciseId
                );
              }}
            >
              <strong>{exercise.name}</strong>
              <small>
                {exercise.relation === "primary" ? "主练" : "参与"} ·{" "}
                {exercise.lastTrainedDate ? `最近 ${exercise.lastTrainedDate}` : "暂无完成记录"}
              </small>
            </button>
            {previewExerciseId === exercise.exerciseId && (
              <p>
                主要：{exercise.primaryMuscles.map((id) => muscleLabels[id]).join("、") || "未标注"}
                <br />
                参与：
                {exercise.secondaryMuscles.map((id) => muscleLabels[id]).join("、") || "未标注"}
              </p>
            )}
          </div>
        ))}
      </section>
    </>
  );
}

function formatRecordedSet(
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
