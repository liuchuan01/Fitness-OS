import { useId } from "react";
import { useTheme } from "../../../design/theme";
import "./appearance.css";
import { ThemePreview } from "./ThemePreview";

export function ThemeChoices() {
  const { themeId, setThemeId, themes, loading, pendingThemeId, error, diagnostics, reloadThemes } =
    useTheme();
  const name = useId();
  return (
    <div className="theme-choices">
      <fieldset>
        <legend>选择主题 · 即时生效</legend>
        <div className="theme-options">
          {themes.map((theme) => (
            <label className="theme-choice" key={theme.id}>
              <ThemePreview theme={theme} />
              <span className="theme-choice-caption">
                <input
                  type="radio"
                  name={name}
                  value={theme.id}
                  checked={theme.id === themeId}
                  onChange={() => setThemeId(theme.id)}
                />
                <span>
                  <strong>{theme.name}</strong>
                  <small>{theme.description}</small>
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="theme-hint">
        预览为主题示意。外观偏好自动保存在此浏览器。安装主题后刷新页面或重新读取即可发现。
      </p>
      <button type="button" className="secondary" onClick={reloadThemes} disabled={loading}>
        {loading ? "正在读取主题…" : "重新读取主题"}
      </button>
      {pendingThemeId && <p role="status">正在准备主题…</p>}
      {error && <p role="alert">{error}</p>}
      {diagnostics.length > 0 && (
        <details className="theme-diagnostics">
          <summary>部分主题未能加载（{diagnostics.length}）</summary>
          <ul>
            {diagnostics.map((message, index) => (
              <li key={index}>{message}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
