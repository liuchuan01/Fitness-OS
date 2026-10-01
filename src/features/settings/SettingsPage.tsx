import { ArrowLeft, Palette, SlidersHorizontal, Clock3, KeyRound } from "lucide-react";
import { IconButton } from "../../components/IconButton";
import { SettingsCard } from "./SettingsCard";
import { DeepSeekSettings } from "./connection/DeepSeekSettings";
import "./settings.css";
import { CoachSettings } from "./coach/CoachSettings";
import { AutomationSettings } from "./automation/AutomationSettings";
import { ThemeChoices } from "./appearance/ThemeChoices";
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

export function SettingsPage({
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
                  <CoachSettings
                    settings={agentSettings}
                    savedInstructions={savedCoach}
                    busy={busy}
                    onChange={setAgentSettings}
                    onSave={() => void save("coach")}
                  />
                </div>
                <div id="settings-schedule" hidden={active !== "schedule"}>
                  <AutomationSettings
                    projection={projection}
                    savedSchedule={savedSchedule}
                    busy={busy}
                    onChange={setProjection}
                    onRun={() => void runNow()}
                    onSave={() => void save("schedule")}
                  />
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
