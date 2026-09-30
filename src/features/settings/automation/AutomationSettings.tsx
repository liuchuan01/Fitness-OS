import type { AutomationResponse } from "../../../api/client";
import { SettingsCard } from "../SettingsCard";

type AutomationSettingsProps = {
  projection: AutomationResponse;
  savedSchedule: string;
  busy: boolean;
  onChange: (projection: AutomationResponse) => void;
  onRun: () => void;
  onSave: () => void;
};

export function AutomationSettings({
  projection,
  savedSchedule,
  busy,
  onChange,
  onRun,
  onSave
}: AutomationSettingsProps) {
  const lastRun = projection.state.daily_plan.last_run;
  return (
    <SettingsCard
      title="自动计划"
      description={
        projection.schedule.daily_plan.enabled
          ? `每日 ${projection.schedule.daily_plan.local_time} · 已启用`
          : "按你的时间生成每日计划 · 未启用"
      }
    >
      <label className="automation-toggle">
        <span>
          <strong>每日自动计划</strong>
          <small>到达设定时间后由 Agent 处理当天计划</small>
        </span>
        <input
          checked={projection.schedule.daily_plan.enabled}
          onChange={(event) =>
            onChange({
              ...projection,
              schedule: {
                ...projection.schedule,
                daily_plan: {
                  ...projection.schedule.daily_plan,
                  enabled: event.target.checked
                }
              }
            })
          }
          type="checkbox"
        />
      </label>
      <div className="automation-fields">
        <label>
          本地时间
          <input
            type="time"
            value={projection.schedule.daily_plan.local_time}
            onChange={(event) =>
              onChange({
                ...projection,
                schedule: {
                  ...projection.schedule,
                  daily_plan: {
                    ...projection.schedule.daily_plan,
                    local_time: event.target.value
                  }
                }
              })
            }
          />
        </label>
        <label>
          时区
          <input
            value={projection.schedule.daily_plan.time_zone}
            onChange={(event) =>
              onChange({
                ...projection,
                schedule: {
                  ...projection.schedule,
                  daily_plan: {
                    ...projection.schedule.daily_plan,
                    time_zone: event.target.value
                  }
                }
              })
            }
          />
        </label>
      </div>
      <dl className="automation-status">
        <div>
          <dt>下次运行</dt>
          <dd>
            {projection.next_run_at ? new Date(projection.next_run_at).toLocaleString() : "未启用"}
          </dd>
        </div>
        <div>
          <dt>最近状态</dt>
          <dd>
            {lastRun
              ? `${lastRun.status} · ${lastRun.outcome?.code ?? lastRun.error ?? "—"}`
              : "尚未运行"}
          </dd>
        </div>
      </dl>
      <footer>
        <span className="settings-save-state">
          {JSON.stringify(projection.schedule) !== savedSchedule ? "有未保存的更改" : "设置已保存"}
        </span>
        <button disabled={busy} onClick={onRun} type="button">
          立即运行
        </button>
        <button className="automation-primary" disabled={busy} onClick={onSave} type="button">
          保存自动计划
        </button>
      </footer>
    </SettingsCard>
  );
}
