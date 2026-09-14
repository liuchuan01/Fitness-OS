import { GlassCard } from "../../components/GlassCard";
import { useEffect, useState } from "react";
import { getJson } from "../../api/http";
import { getTodayPlan, type TodayPlan } from "../../api/client";
import {
  onboardingStateSchema,
  type OnboardingState
} from "../../../shared/fitness/profile-schema";

export function OnboardingEntry({
  refreshVersion,
  todayPlan,
  onPlan,
  onAgent
}: {
  refreshVersion: number;
  todayPlan: TodayPlan | null;
  onPlan: (plan: TodayPlan) => void;
  onAgent: () => void;
}) {
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
  const [onboardingError, setOnboardingError] = useState(false);
  const [opening, setOpening] = useState(false);
  const [planError, setPlanError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    getJson("/api/onboarding", onboardingStateSchema, { signal: controller.signal })
      .then((state) => {
        setOnboarding(state);
        setOnboardingError(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setOnboardingError(true);
      });
    return () => controller.abort();
  }, [refreshVersion]);

  async function proceed() {
    if (todayPlan) {
      onPlan(todayPlan);
      return;
    }
    if (!onboarding?.firstPlanDate) {
      onAgent();
      return;
    }
    setOpening(true);
    setPlanError("");
    try {
      const plan = await getTodayPlan(onboarding.firstPlanDate);
      if (!plan) throw new Error("Plan not found");
      onPlan(plan);
    } catch {
      setPlanError("计划暂时无法读取，请重试。");
    } finally {
      setOpening(false);
    }
  }
  const hasPlan = todayPlan || onboarding?.firstPlanDate;

  return (
    <GlassCard className="dashboard-empty" role="status">
      <strong>{hasPlan ? "第一份计划已准备好" : "从了解你的身体开始"}</strong>
      <span>
        {hasPlan
          ? "先查看安排，训练后记录实际完成。"
          : "和教练分几轮聊聊目标、时间与身体情况，也可以先探索动作。"}
      </span>
      {onboardingError ? (
        <span role="alert">档案进度暂时无法读取，请刷新重试。</span>
      ) : (
        <button
          disabled={opening || (!onboarding && !todayPlan)}
          type="button"
          onClick={() => void proceed()}
        >
          {hasPlan
            ? "查看首次训练计划"
            : !onboarding
              ? "正在读取档案…"
              : onboarding.stage === "empty"
                ? "建立我的训练档案"
                : !onboarding.profileConfirmed
                  ? "继续建立训练档案"
                  : onboarding.firstPlanDate
                    ? "查看首次训练计划"
                    : "安排我的首次训练"}
        </button>
      )}
      {planError ? <span role="alert">{planError}</span> : null}
    </GlassCard>
  );
}
