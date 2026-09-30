import type { AgentSettings } from "../../../api/client";
import { SettingsCard } from "../SettingsCard";

type CoachSettingsProps = {
  settings: AgentSettings;
  savedInstructions: string;
  busy: boolean;
  onChange: (settings: AgentSettings) => void;
  onSave: () => void;
};

export function CoachSettings({
  settings,
  savedInstructions,
  busy,
  onChange,
  onSave
}: CoachSettingsProps) {
  return (
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
          value={settings.instructions}
          onChange={(event) => onChange({ ...settings, instructions: event.target.value })}
        />
      </label>
      <footer>
        <span className="settings-save-state">
          {settings.instructions !== savedInstructions ? "有未保存的更改" : "指令已保存"}
        </span>
        <button className="automation-primary" disabled={busy} onClick={onSave} type="button">
          保存教练指令
        </button>
      </footer>
    </SettingsCard>
  );
}
