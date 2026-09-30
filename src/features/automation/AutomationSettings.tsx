import { ArrowLeft, Palette, SlidersHorizontal, Clock3, KeyRound } from "lucide-react";
import { IconButton } from "../../components/IconButton";
import { SettingsCard } from "./SettingsCard";
import { DeepSeekSettings } from "./DeepSeekSettings";
import "./settings.css";
import { ThemeChoices } from "../appearance/ThemeChoices";
import { useEffect, useState } from "react";
import {
  getAgentSettings,
  getModelSettings,
  getAutomation,
  runAutomationNow,
  saveAgentSettings,
  saveAutomation,
  type AgentSettings,
  type AutomationResponse
} from "../../api/client";

const sections = [
  { id: "appearance", label: "界面外观", icon: Palette },
  { id: "coach", label: "教练偏好", icon: SlidersHorizontal },
  { id: "schedule", label: "自动计划", icon: Clock3 },
  { id: "connection", label: "模型连接", icon: KeyRound }
] as const;
type SettingsSection = (typeof sections)[number]["id"];

export function AutomationSettings({
  onClose,
  initialSection = "appearance"
}: {
  onClose(): void;
  initialSection?: SettingsSection;
}) {
  const [active, setActive] = useState<SettingsSection>(initialSection);
  const [savedCoach, setSavedCoach] = useState("");
  const [savedSchedule, setSavedSchedule] = useState("");
  const [projection, setProjection] = useState<AutomationResponse>();
  const [agentSettings, setAgentSettings] = useState<AgentSettings>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function refresh() {
    try {
      const [nextProjection, nextAgentSettings] = await Promise.all([
        getAutomation(),
        getAgentSettings()
      ]);
      setProjection(nextProjection);
      setAgentSettings(nextAgentSettings);
      setSavedCoach(nextAgentSettings.instructions);
      setSavedSchedule(JSON.stringify(nextProjection.schedule));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Agent 设置读取失败");
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

  async function save(section: "coach" | "schedule") {
    if (!projection || !agentSettings) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      if (section === "coach") {
        await saveAgentSettings(agentSettings);
        setSavedCoach(agentSettings.instructions);
      } else {
        await saveAutomation(projection.schedule);
        setSavedSchedule(JSON.stringify(projection.schedule));
        const updated = await getAutomation();
        setProjection((current) =>
          current ? { ...updated, schedule: current.schedule } : updated
        );
      }
      setMessage(section === "coach" ? "教练指令已保存。" : "自动计划设置已保存。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function runNow() {
    setBusy(true);
    setError("");
    try {
      if (!(await getModelSettings()).configured) throw new Error("请先配置 DeepSeek API Key。");
      await runAutomationNow();
      const updated = await getAutomation();
      setProjection((current) => (current ? { ...updated, schedule: current.schedule } : updated));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "立即运行失败");
    } finally {
      setBusy(false);
    }
  }

  const lastRun = projection?.state.daily_plan.last_run;
  return (
    <main className="settings-page">
      <section aria-label="配置后台" className="automation-panel settings-panel">
        <header>
          <div>
            <span>AI FITNESS OS</span>
            <h2>设置</h2>
          </div>
          <IconButton label="返回训练首页" icon={ArrowLeft} onClick={onClose} />
        </header>
        <p className="settings-description">让训练教练按你的节奏工作。</p>
        <div className="settings-layout">
          <nav className="settings-nav" aria-label="设置分类">
            {sections.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                aria-current={active === id ? "page" : undefined}
                aria-controls={`settings-${id}`}
                onClick={() => {
                  setActive(id);
                  setMessage("");
                }}
              >
                <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                {label}
              </button>
            ))}
            <p>
              你的训练空间，
              <br />
              按你的方式运转。
            </p>
          </nav>
          <div className="settings-workspace">
            <div id="settings-connection" hidden={active !== "connection"}>
              <DeepSeekSettings />
            </div>
            <div id="settings-appearance" hidden={active !== "appearance"}>
              <SettingsCard title="界面外观" description="为你的训练空间，选择一种氛围。">
                <ThemeChoices />
              </SettingsCard>
            </div>
            {projection && agentSettings ? (
              <>
                <div id="settings-coach" hidden={active !== "coach"}>
                  <SettingsCard title="教练偏好" description="沟通方式与训练偏好">
                    <label className="agent-instructions-field">
                      <span>
                        <strong>教练指令</strong>
                        <small>告诉教练你希望如何沟通，保存后从下一条消息起生效</small>
                      </span>
                      <textarea
                        aria-label="教练指令"
                        maxLength={12_000}
                        rows={8}
                        value={agentSettings.instructions}
                        onChange={(event) =>
                          setAgentSettings({ ...agentSettings, instructions: event.target.value })
                        }
                      />
                    </label>
                    <footer>
                      <span className="settings-save-state">
                        {agentSettings.instructions !== savedCoach
                          ? "有未保存的更改"
                          : "指令已保存"}
                      </span>
                      <button
                        className="automation-primary"
                        disabled={busy}
                        onClick={() => void save("coach")}
                        type="button"
                      >
                        保存教练指令
                      </button>
                    </footer>
                  </SettingsCard>
                </div>
                <div id="settings-schedule" hidden={active !== "schedule"}>
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
                          setProjection({
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
                            setProjection({
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
                            setProjection({
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
                          {projection.next_run_at
                            ? new Date(projection.next_run_at).toLocaleString()
                            : "未启用"}
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
                        {JSON.stringify(projection.schedule) !== savedSchedule
                          ? "有未保存的更改"
                          : "设置已保存"}
                      </span>
                      <button disabled={busy} onClick={() => void runNow()} type="button">
                        立即运行
                      </button>
                      <button
                        className="automation-primary"
                        disabled={busy}
                        onClick={() => void save("schedule")}
                        type="button"
                      >
                        保存自动计划
                      </button>
                    </footer>
                  </SettingsCard>
                </div>
              </>
            ) : (
              <p
                hidden={active !== "coach" && active !== "schedule"}
                className="automation-loading"
              >
                {error || "正在读取设置…"}
              </p>
            )}
            {error ? (
              <p className="automation-error" role="alert">
                {error}
              </p>
            ) : null}
            {message ? (
              <p role="status" className="settings-feedback">
                {message}
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
