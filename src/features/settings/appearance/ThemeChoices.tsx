import { useId } from "react";
import { useTheme } from "../../../design/theme";
import { appThemes, themeIds } from "../../../design/theme-definitions";
import "./appearance.css";
import { ThemePreview } from "./ThemePreview";

export function ThemeChoices() {
  const { themeId, setThemeId } = useTheme();
  const name = useId();
  return (
    <div className="theme-choices">
      <fieldset>
        <legend>选择主题 · 即时生效</legend>
        <div className="theme-options">
          {themeIds.map((id) => (
            <label className="theme-choice" key={id}>
              <ThemePreview theme={appThemes[id]} />
              <span className="theme-choice-caption">
                <input
                  type="radio"
                  name={name}
                  value={id}
                  checked={id === themeId}
                  onChange={() => setThemeId(id)}
                />
                <span>
                  <strong>{appThemes[id].name}</strong>
                  <small>{id === "neon" ? "青色信号 · 洋红焦点" : "中性色调 · 无霓虹"}</small>
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="theme-hint">预览为布局示意。外观偏好自动保存在此浏览器。</p>
    </div>
  );
}
