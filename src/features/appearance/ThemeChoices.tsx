import { useId } from "react";
import { useTheme } from "../../design/theme";
import { appThemes, themeIds } from "../../design/theme-definitions";
import "./appearance.css";

export function ThemeChoices() {
  const { themeId, setThemeId } = useTheme();
  const name = useId();
  return (
    <div className="theme-choices">
      <fieldset>
        <legend>选择主题</legend>
        {themeIds.map((id) => (
          <label className="theme-choice" key={id}>
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
            <span className="theme-colors" aria-hidden="true">
              <i style={{ background: appThemes[id].palette.accent }} />
              <i style={{ background: appThemes[id].palette.selection }} />
            </span>
          </label>
        ))}
      </fieldset>
      <p className="theme-hint">外观偏好保存在此浏览器。</p>
    </div>
  );
}
