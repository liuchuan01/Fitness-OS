import { FileInput } from "lucide-react";
import { SettingsCard } from "../SettingsCard";
import { useXparseSettings } from "./useXparseSettings";

export function XparseSettings() {
  const state = useXparseSettings();
  const { settings, credentials } = state;
  return (
    <SettingsCard
      title="TextIn xParse"
      mark={<FileInput size={22} strokeWidth={1.75} aria-hidden="true" />}
      description="将其他软件导出的健身记录，带入你的训练空间。"
    >
      <p>开启后，在对话中告诉 DSH 文件位置即可，它会完成文件解析和记录整理。</p>
      <p>
        支持 PDF、图片和 Office。可提供 DSH 能访问的路径、链接或对话附件。文件将发送至 TextIn 云端。
      </p>
      {settings ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void state.save();
          }}
        >
          <label className="automation-toggle">
            <span>
              <strong>启用文件解析</strong>
              <small>保存后从下一条对话起生效</small>
            </span>
            <input
              type="checkbox"
              checked={settings.enabled}
              disabled={state.busy || state.loading}
              onChange={(event) =>
                state.setSettings({ ...settings, enabled: event.target.checked })
              }
            />
          </label>
          <label className="xparse-paid-option">
            <input
              type="checkbox"
              checked={settings.allowPaid}
              disabled={state.busy || state.loading}
              onChange={(event) =>
                state.setSettings({ ...settings, allowPaid: event.target.checked })
              }
            />
            <span>
              允许使用 TextIn 付费解析
              <small>
                默认优先使用可用免费额度；Office 等格式可能需要付费，费用由你的 TextIn 账户承担。
              </small>
            </span>
          </label>
          <footer>
            <span className="settings-save-state">
              {JSON.stringify(settings) === JSON.stringify(state.saved)
                ? "设置已保存"
                : "有未保存的更改"}
            </span>
            <button
              type="submit"
              className="automation-primary"
              disabled={state.busy || state.loading}
            >
              {state.busy ? "正在保存…" : "保存解析设置"}
            </button>
          </footer>
        </form>
      ) : (
        <p>{state.loading ? "正在读取解析设置…" : "解析设置暂不可用"}</p>
      )}
      {state.error ? (
        <p role="alert" className="automation-error">
          {state.error}
        </p>
      ) : null}
      <form
        className="xparse-credentials"
        onSubmit={(event) => {
          event.preventDefault();
          void state.saveCredentials();
        }}
      >
        <h4>TextIn 凭据</h4>
        <p role="status">
          {state.loading
            ? "正在读取凭据状态…"
            : credentials
              ? credentials.configured
                ? "已配置 TextIn 凭据"
                : "尚未配置 TextIn 凭据"
              : "凭据状态暂不可用"}
        </p>
        <p>
          从{" "}
          <a
            href="https://www.textin.com/console/dashboard/setting"
            target="_blank"
            rel="noreferrer"
          >
            TextIn 控制台
          </a>{" "}
          获取 App ID 和 Secret Code。凭据保存在本机 DSH 凭据存储中，页面不会回显。
        </p>
        {credentials?.writable === false ? <p>凭据由启动环境提供，请在启动环境中修改。</p> : null}
        <div className="automation-fields">
          <label>
            TextIn App ID
            <input
              value={state.appId}
              autoComplete="off"
              maxLength={4096}
              disabled={credentials?.writable === false || state.credentialBusy}
              onChange={(event) => state.setAppId(event.target.value)}
            />
          </label>
          <label>
            TextIn Secret Code
            <input
              type="password"
              value={state.secretCode}
              autoComplete="new-password"
              maxLength={4096}
              disabled={credentials?.writable === false || state.credentialBusy}
              onChange={(event) => state.setSecretCode(event.target.value)}
            />
          </label>
        </div>
        <footer>
          <button
            type="button"
            disabled={state.loading || state.credentialBusy || state.busy}
            onClick={() => void state.refresh()}
          >
            重新读取
          </button>
          <button
            type="button"
            disabled={
              !credentials?.configured ||
              credentials.writable === false ||
              state.loading ||
              state.credentialBusy
            }
            onClick={() => void state.saveCredentials(true)}
          >
            清除凭据
          </button>
          <button
            type="submit"
            className="automation-primary"
            disabled={
              credentials?.writable === false ||
              state.loading ||
              state.credentialBusy ||
              !state.appId.trim() ||
              !state.secretCode.trim()
            }
          >
            {state.credentialBusy ? "正在保存…" : "保存 TextIn 凭据"}
          </button>
        </footer>
      </form>
      {state.credentialError ? (
        <p role="alert" className="automation-error">
          {state.credentialError}
        </p>
      ) : null}
      {state.message ? (
        <p role="status" className="settings-feedback">
          {state.message}
        </p>
      ) : null}
    </SettingsCard>
  );
}
