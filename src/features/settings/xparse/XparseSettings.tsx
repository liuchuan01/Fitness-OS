import { FileInput, RotateCw } from "lucide-react";
import { IconButton } from "../../../components/IconButton";
import { SettingsCard } from "../SettingsCard";
import { useXparseSettings } from "./useXparseSettings";

export function XparseSettings() {
  const state = useXparseSettings();
  const { settings, credentials } = state;
  const showCredentials = settings?.enabled && settings.allowPaid;
  const controlsDisabled = state.busy || state.loading || state.credentialBusy;
  return (
    <SettingsCard
      title="TextIn xParse"
      mark={<FileInput size={22} strokeWidth={1.75} aria-hidden="true" />}
      description="在对话中告知 DSH 文件位置，即可解析并整理健身记录。"
    >
      <p className="settings-integration-intro">
        TextIn xParse 提供 PDF、图片和 Office 文件的云端解析。{" "}
        <a href="https://github.com/intsig-textin" target="_blank" rel="noreferrer">
          了解 TextIn
        </a>
      </p>
      {settings ? (
        <form
          className="xparse-options"
          onSubmit={(event) => {
            event.preventDefault();
            void state.save();
          }}
        >
          <label className="automation-toggle">
            <span>
              <strong id="xparse-enabled-label">启用文件解析</strong>
              <small id="xparse-enabled-hint">保存后从下一条对话起生效</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              aria-labelledby="xparse-enabled-label"
              aria-describedby="xparse-enabled-hint"
              checked={settings.enabled}
              disabled={controlsDisabled}
              onChange={(event) =>
                state.setSettings({ enabled: event.target.checked, allowPaid: false })
              }
            />
          </label>
          <label className="automation-toggle" aria-disabled={!settings.enabled}>
            <span>
              <strong id="xparse-paid-label">允许使用付费解析</strong>
              <small id="xparse-paid-hint">
                {settings.enabled
                  ? "优先使用免费额度；付费解析由你的 TextIn 账户承担。"
                  : "启用文件解析后可开启。"}
              </small>
            </span>
            <input
              type="checkbox"
              role="switch"
              aria-labelledby="xparse-paid-label"
              aria-describedby="xparse-paid-hint"
              checked={settings.enabled && settings.allowPaid}
              disabled={!settings.enabled || controlsDisabled}
              onChange={(event) =>
                state.setSettings({ ...settings, allowPaid: event.target.checked })
              }
            />
          </label>
          <footer>
            <span className="settings-save-state">
              {JSON.stringify(settings) === JSON.stringify(state.saved)
                ? "设置已保存"
                : "有未保存的更改"}
            </span>
            <button type="submit" className="automation-primary" disabled={controlsDisabled}>
              {state.busy ? "正在保存…" : "保存解析设置"}
            </button>
          </footer>
        </form>
      ) : (
        <p>{state.loading ? "正在读取解析设置…" : "解析设置暂不可用"}</p>
      )}
      {state.error ? (
        <div className="xparse-load-error">
          <p role="alert" className="automation-error">
            {state.error}
          </p>
          <IconButton
            icon={RotateCw}
            label="重新读取解析设置"
            disabled={controlsDisabled}
            onClick={() => void state.refresh()}
          />
        </div>
      ) : null}
      {showCredentials ? (
        <form
          className="xparse-credentials"
          onSubmit={(event) => {
            event.preventDefault();
            void state.saveCredentials();
          }}
        >
          <div className="xparse-credentials-heading">
            <h4>TextIn 凭据</h4>
            <IconButton
              icon={RotateCw}
              label="重新读取凭据状态"
              disabled={controlsDisabled}
              onClick={() => void state.refresh()}
            />
          </div>
          <p className="xparse-credential-status" role="status">
            {state.loading
              ? "正在读取凭据状态…"
              : credentials
                ? credentials.configured
                  ? "已配置 TextIn 凭据"
                  : "尚未配置 TextIn 凭据"
                : "凭据状态暂不可用"}
          </p>
          <p className="xparse-credential-hint">
            从{" "}
            <a
              href="https://www.textin.com/console/dashboard/setting"
              target="_blank"
              rel="noreferrer"
            >
              TextIn 控制台
            </a>{" "}
            获取凭据，保存后不回显。
          </p>
          {credentials?.writable === false ? <p>凭据由启动环境提供，请在启动环境中修改。</p> : null}
          <div className="automation-fields">
            <label>
              TextIn App ID
              <input
                value={state.appId}
                autoComplete="off"
                maxLength={4096}
                disabled={credentials?.writable === false || controlsDisabled}
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
                disabled={credentials?.writable === false || controlsDisabled}
                onChange={(event) => state.setSecretCode(event.target.value)}
              />
            </label>
          </div>
          <footer>
            {credentials?.configured ? (
              <button
                type="button"
                disabled={credentials.writable === false || controlsDisabled}
                onClick={() => void state.saveCredentials(true)}
              >
                清除凭据
              </button>
            ) : null}
            <button
              type="submit"
              className="automation-primary"
              disabled={
                credentials?.writable === false ||
                controlsDisabled ||
                !state.appId.trim() ||
                !state.secretCode.trim()
              }
            >
              {state.credentialBusy ? "正在保存…" : "保存 TextIn 凭据"}
            </button>
          </footer>
          {state.credentialError ? (
            <p role="alert" className="automation-error">
              {state.credentialError}
            </p>
          ) : null}
        </form>
      ) : null}
      {state.message ? (
        <p role="status" className="settings-feedback">
          {state.message}
        </p>
      ) : null}
    </SettingsCard>
  );
}
