import { useEffect, useState } from "react";
import { getModelSettings, saveModelSettings } from "../../api/client";
import type { ModelSettings } from "../../api/model-settings-schemas";
import { ApiError } from "../../api/http";
import { SettingsCard } from "./SettingsCard";

export function DeepSeekSettings() {
  const [model, setModel] = useState<ModelSettings>();
  const [apiKey, setApiKey] = useState("");
  const [modelError, setModelError] = useState("");
  const [modelLoading, setModelLoading] = useState(true);
  const [modelBusy, setModelBusy] = useState(false);
  const [modelMessage, setModelMessage] = useState("");

  async function refreshModel() {
    setModelError("");
    setModelLoading(true);
    try {
      setModel(await getModelSettings());
    } catch (cause) {
      setModelError(
        cause instanceof ApiError && cause.status === 503
          ? "密钥服务暂未就绪，可稍后重新读取，或填写密钥后尝试保存。"
          : "无法读取密钥状态，请确认开发服务已启动，再重新读取或尝试保存。"
      );
    } finally {
      setModelLoading(false);
    }
  }

  async function saveKey() {
    setModelBusy(true);
    setModelError("");
    setModelMessage("");
    try {
      setModel(await saveModelSettings(apiKey.trim()));
      setApiKey("");
      setModelMessage("密钥已保存，从下一次对话或定时任务起生效。");
    } catch (cause) {
      setModelError(cause instanceof Error ? cause.message : "密钥保存失败");
    } finally {
      setModelBusy(false);
    }
  }

  useEffect(() => {
    void refreshModel();
  }, []);
  return (
    <SettingsCard
      title="DeepSeek"
      description={model?.configured ? "密钥已配置 · 对话与自动计划" : "连接你的训练教练"}
    >
      <p className="settings-connection-state" role="status">
        {modelLoading
          ? "正在读取密钥状态…"
          : model
            ? model.configured
              ? "已配置密钥"
              : "尚未配置密钥"
            : "密钥状态暂不可用"}
      </p>
      {model?.writable === false ? <p>当前密钥由启动环境提供，请在启动环境中修改。</p> : null}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void saveKey();
        }}
      >
        <label className="model-key-field">
          DeepSeek API Key
          <input
            type="password"
            autoComplete="new-password"
            maxLength={4096}
            disabled={model?.writable === false || modelBusy}
            value={apiKey}
            placeholder={model?.configured ? "输入新密钥以替换已保存的密钥" : "输入 API Key"}
            onChange={(event) => setApiKey(event.target.value)}
          />
        </label>
        <p>密钥保存在本机凭据存储中，页面不会回显已保存的密钥。</p>
        <footer>
          <button
            className="automation-primary"
            type="submit"
            disabled={model?.writable === false || !apiKey.trim() || modelBusy || modelLoading}
          >
            {modelBusy ? "正在保存…" : "保存模型密钥"}
          </button>
        </footer>
      </form>
      {modelError ? (
        <p className="automation-error" role="alert">
          {modelError}{" "}
          <button
            onClick={() => void refreshModel()}
            type="button"
            disabled={modelBusy || modelLoading}
          >
            重新读取
          </button>
        </p>
      ) : null}
      {modelMessage ? <p role="status">{modelMessage}</p> : null}
    </SettingsCard>
  );
}
