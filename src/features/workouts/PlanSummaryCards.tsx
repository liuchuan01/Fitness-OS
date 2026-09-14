import { ArrowUpRight } from "lucide-react";
import type { TodayPlan } from "../../api/client";

export function TodayPlanSummary({
  onOpen,
  plan
}: {
  onOpen: (plan: TodayPlan) => void;
  plan: TodayPlan | null;
}) {
  const exercises = plan?.blocks.flatMap((block) => block.exercises) ?? [];

  return (
    <section className="today-plan" aria-label="今日计划">
      <div className="section-heading">
        <h3>今日计划</h3>
        <span>{plan ? `${exercises.length} 个动作` : "待安排"}</span>
      </div>
      {!plan ? (
        <div className="daily-empty" role="status">
          <strong>今天还没有计划</strong>
          <span>安排今日训练后，在这里查看动作和组次。</span>
        </div>
      ) : (
        <div className="plan-card glass-card">
          <div className="plan-card-heading">
            <strong>{plan.title}</strong>
            <span>{plan.duration_min ? `${plan.duration_min} 分钟` : plan.date}</span>
          </div>
          {plan.goals?.length ? <p>{plan.goals.join(" · ")}</p> : null}
          <div className="plan-card-preview" aria-label="动作预览">
            {exercises.slice(0, 3).map((exercise) => (
              <span key={exercise.exercise_id ?? exercise.name}>{exercise.name}</span>
            ))}
            {exercises.length > 3 ? <small>另有 {exercises.length - 3} 个动作</small> : null}
          </div>
          <button className="plan-open-action" onClick={() => onOpen(plan)} type="button">
            <span>查看完整计划</span>
            <ArrowUpRight size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
}
