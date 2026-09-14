import { useState } from "react";
import { ArrowLeft, Check, Copy } from "lucide-react";
import { muscleLabels } from "../../../shared/muscle-taxonomy";
import type { MuscleId } from "../../../shared/muscle-taxonomy";
import type { TodayPlan } from "../../api/client";
import {
  countPlanExercises,
  countPlanSets,
  formatPlanSet,
  formatTodayPlanText
} from "./plan-formatters";

type CopyState = "idle" | "success" | "error";

export function TodayPlanDetail({ onBack, plan }: { onBack: () => void; plan: TodayPlan }) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  let exerciseNumber = 0;

  async function copyPlan() {
    try {
      await writeClipboard(formatTodayPlanText(plan));
      setCopyState("success");
    } catch {
      setCopyState("error");
    }
  }

  return (
    <div className="plan-detail-view">
      <div className="plan-detail-toolbar">
        <button className="plan-detail-back" onClick={onBack} type="button">
          <ArrowLeft size={18} strokeWidth={1.75} aria-hidden="true" /> 返回身体概览
        </button>
        <div className="plan-copy-area">
          <span aria-live="polite" className={copyState === "error" ? "copy-error" : ""}>
            {copyState === "success" ? "已复制，可直接粘贴" : ""}
            {copyState === "error" ? "复制失败，请重试" : ""}
          </span>
          <button className="copy-plan-button" onClick={() => void copyPlan()} type="button">
            {copyState === "success" ? (
              <Check size={18} strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Copy size={18} strokeWidth={1.75} aria-hidden="true" />
            )}
            {copyState === "success" ? "已复制" : "复制今日计划"}
          </button>
        </div>
      </div>

      <div className="plan-detail-scroll">
        <article className="plan-document">
          <header className="plan-document-header">
            <p className="eyebrow">Today's training protocol · {plan.date}</p>
            <h1>{plan.title}</h1>
            <div className="plan-document-meta" aria-label="计划数据">
              <span>
                <b>{plan.duration_min ?? "—"}</b> 分钟
              </span>
              <span>
                <b>{countPlanExercises(plan)}</b> 个动作
              </span>
              <span>
                <b>{countPlanSets(plan)}</b> 计划组
              </span>
            </div>
            {plan.goals?.length ? (
              <div className="plan-goal-list" aria-label="训练目标">
                {plan.goals.map((goal) => (
                  <span key={goal}>{goal}</span>
                ))}
              </div>
            ) : null}
          </header>

          {plan.user_note ? (
            <aside className="plan-note glass-card" aria-label="训练提示">
              <span>训练提示</span>
              <p>{plan.user_note}</p>
            </aside>
          ) : null}

          <div className="plan-detail-blocks">
            {plan.blocks.map((block, blockIndex) => (
              <section className="plan-detail-block" key={`${block.type}-${block.name}`}>
                <div className="plan-detail-block-heading">
                  <span>{String(blockIndex + 1).padStart(2, "0")}</span>
                  <h2>{block.name}</h2>
                  <small>{block.exercises.length} 个动作</small>
                </div>
                <div className="plan-detail-exercises">
                  {block.exercises.map((exercise) => {
                    exerciseNumber += 1;
                    return (
                      <article
                        className="plan-detail-exercise glass-card"
                        key={`${block.name}-${exercise.exercise_id ?? exercise.name}`}
                      >
                        <span className="plan-exercise-index">
                          {String(exerciseNumber).padStart(2, "0")}
                        </span>
                        <div className="plan-exercise-name">
                          <h3>{exercise.name}</h3>
                          <span>{exercise.sets.length} 组</span>
                        </div>
                        <ol className="plan-set-list">
                          {exercise.sets.length > 0 ? (
                            exercise.sets.map((set, setIndex) => (
                              <li key={`${exercise.name}-${setIndex}`}>
                                <span>组 {setIndex + 1}</span>
                                <strong>{formatPlanSet(set)}</strong>
                              </li>
                            ))
                          ) : (
                            <li>
                              <span>组次</span>
                              <strong>未设置</strong>
                            </li>
                          )}
                        </ol>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </article>
      </div>
    </div>
  );
}

export function TodayPlanContext({ plan }: { plan: TodayPlan }) {
  const topMuscles = Object.entries(plan.computed_expected_stimulus ?? {})
    .filter(([, score]) => score > 0)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5);

  return (
    <div className="context-content plan-context-content">
      <div className="context-heading">
        <p className="eyebrow">Plan overview</p>
        <h2>训练概览</h2>
      </div>
      <div className="plan-context-metrics">
        <span>
          <b>{plan.duration_min ?? "—"}</b> 分钟
        </span>
        <span>
          <b>{countPlanExercises(plan)}</b> 动作
        </span>
        <span>
          <b>{countPlanSets(plan)}</b> 组
        </span>
      </div>
      {plan.goals?.length ? (
        <section className="plan-context-section">
          <div className="section-heading">
            <h3>训练目标</h3>
          </div>
          <div className="plan-context-goals">
            {plan.goals.map((goal) => (
              <span key={goal}>{goal}</span>
            ))}
          </div>
        </section>
      ) : null}
      {topMuscles.length > 0 ? (
        <section className="plan-context-section">
          <div className="section-heading">
            <h3>预计刺激</h3>
            <span>前 {topMuscles.length} 项</span>
          </div>
          <div className="plan-stimulus-list">
            {topMuscles.map(([muscleId, score]) => (
              <div className="plan-stimulus-row" key={muscleId}>
                <span>
                  <b>{muscleLabels[muscleId as MuscleId]}</b>
                  <small>{score}</small>
                </span>
                <i>
                  <span style={{ width: `${score}%` }} />
                </i>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {plan.user_intent ? (
        <section className="plan-context-section plan-intent">
          <span>本次需求</span>
          <p>{plan.user_intent}</p>
        </section>
      ) : null}
    </div>
  );
}

async function writeClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  const didCopy = document.execCommand("copy");
  textarea.remove();
  if (!didCopy) throw new Error("Clipboard is unavailable");
}
