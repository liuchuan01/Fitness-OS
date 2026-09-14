import { lazy, Suspense, useState, useMemo, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { ArrowUpRight, Crosshair, RotateCcw } from "lucide-react";
import { themes, neonScales, colorLevels, levelLabels, type ColorLevel } from "./themes";
import "./visual-lab.css";

const BodyPreview = lazy(() => import("../body-3d/BodyStylePreview"));

function VisualLab() {
  const [themeId, setThemeId] = useState<keyof typeof themes>("neon");
  const [mode, setMode] = useState<"exercise" | "focus">("exercise");
  const [cyanLevel, setCyanLevel] = useState<ColorLevel>("strong");
  const [magentaLevel, setMagentaLevel] = useState<ColorLevel>("strong");
  const [glowEnabled, setGlowEnabled] = useState(true);
  const [emissionEnabled, setEmissionEnabled] = useState(true);
  const theme = themes[themeId];
  const palette = useMemo(
    () =>
      themeId === "neon"
        ? {
            ...theme.palette,
            accent: neonScales.cyan[cyanLevel],
            orange: neonScales.cyan[cyanLevel],
            selection: neonScales.magenta[magentaLevel],
            blue: neonScales.magenta[magentaLevel]
          }
        : theme.palette,
    [themeId, theme, cyanLevel, magentaLevel]
  );
  const hasGlow = themeId === "neon" && glowEnabled;
  const glow = hasGlow ? `0 0 18px ${palette.accent}45, 0 0 44px ${palette.accent}18` : "none";
  const focusGlow = hasGlow
    ? `0 0 18px ${palette.selection}45, 0 0 44px ${palette.selection}18`
    : "none";
  const style = Object.fromEntries([
    ...Object.entries(palette).map(([key, value]) => [`--${key}`, value]),
    ["--glow", glow],
    ["--focus-glow", focusGlow],
    ["--example-text-glow", hasGlow ? `0 0 10px ${palette.selection}` : "none"]
  ]) as CSSProperties;
  return (
    <main className="visual-lab" style={style}>
      <header>
        <a href="/">AF / FITNESS OS</a>
        <span>VISUAL STUDY · 03</span>
        <span className="draft">方向已认可 · 色阶待确认</span>
      </header>
      <section className="lab-intro">
        <div>
          <p className="eyebrow">BODY / LIGHT / SIGNAL</p>
          <h1>让光有明确的指向。</h1>
          <p>青色引导操作，洋红建立焦点。改变主题，保留身体与信息的关系。</p>
        </div>
        <div className="theme-switch" aria-label="样板主题">
          {Object.entries(themes).map(([id, value]) => (
            <button
              key={id}
              aria-pressed={themeId === id}
              onClick={() => setThemeId(id as keyof typeof themes)}
            >
              {value.name}
            </button>
          ))}
        </div>
      </section>
      <section className="lab-controls" aria-label="配色与光效对照">
        <div className="level-controls">
          <label>
            青色色阶
            <select
              aria-label="青色色阶"
              value={cyanLevel}
              disabled={themeId !== "neon"}
              onChange={(event) => setCyanLevel(event.target.value as ColorLevel)}
            >
              {colorLevels.map((level) => (
                <option key={level} value={level}>
                  {levelLabels[level]}
                </option>
              ))}
            </select>
          </label>
          <label>
            偏红洋红色阶
            <select
              aria-label="偏红洋红色阶"
              value={magentaLevel}
              disabled={themeId !== "neon"}
              onChange={(event) => setMagentaLevel(event.target.value as ColorLevel)}
            >
              {colorLevels.map((level) => (
                <option key={level} value={level}>
                  {levelLabels[level]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="light-controls">
          <label>
            <input
              type="checkbox"
              checked={hasGlow}
              disabled={themeId !== "neon"}
              onChange={(event) => setGlowEnabled(event.target.checked)}
            />
            控件光晕
          </label>
          <label>
            <input
              type="checkbox"
              checked={emissionEnabled}
              onChange={(event) => setEmissionEnabled(event.target.checked)}
            />
            重点肌肉自发光
          </label>
        </div>
        <p>
          色阶同步应用到控件、文字、图例与人体。两个光效可分别关闭；关闭不改变色值或透明度。Graphite
          保留独立中性色。
        </p>
      </section>
      <section className="lab-stage" aria-label="标准场景提案">
        <div className="stage-caption">
          <span className="eyebrow">01 / BODY CANVAS</span>
          <h2>{mode === "exercise" ? "上肢推举 · 涉及部位" : "胸大肌 · 肌肉焦点"}</h2>
          <p>固定示意场景，不代表你的训练记录</p>
        </div>
        <div className="mode-switch">
          <button aria-pressed={mode === "exercise"} onClick={() => setMode("exercise")}>
            动作预览
          </button>
          <button aria-pressed={mode === "focus"} onClick={() => setMode("focus")}>
            肌肉焦点
          </button>
        </div>
        <div className="preview-body">
          <Suspense fallback={<p role="status">正在准备身体样板…</p>}>
            <BodyPreview
              colors={palette}
              emission={emissionEnabled ? theme.emission : 0}
              mode={mode}
            />
          </Suspense>
        </div>
        <aside className="stage-note">
          <span className="eyebrow">FOCUS / 01</span>
          <h3>{mode === "exercise" ? "主练与参与，一眼可分。" : "只强调当前选择。"}</h3>
          <p>
            {mode === "exercise"
              ? "主练使用青色，参与使用洋红；名称与图例始终一起呈现。"
              : "焦点使用洋红，其余肌肉退暗。切换主题后，选择和业务含义保持一致。"}
          </p>
          {mode === "exercise" && (
            <div className="signal">
              <i />
              主练 · 胸大肌
            </div>
          )}
          <div className="signal secondary">
            <i />
            {mode === "exercise" ? "参与 · 肩前束 / 肱三头肌" : "选中 · 胸大肌"}
          </div>
          <p className="small">
            此处展示重点肌肉自发光。屏幕空间 Bloom 尚未接入，不能据此认定真实霓虹光晕的最终效果。
          </p>
        </aside>
        <div className="stage-bottom">
          <span>低对比背景 / 完整人体 / 一个焦点</span>
          <span>GLB + DOM · 同一主题输入</span>
        </div>
      </section>
      <section className="lab-rules">
        <article>
          <p className="eyebrow">02 / COLOR ROLES</p>
          <h2>颜色承担角色。</h2>
          {(["cyan", "magenta"] as const).map((family) => (
            <div className="color-family" key={family}>
              <h3>{family === "cyan" ? "青色 · 交互 / 主练" : "偏红洋红 · 焦点 / 参与"}</h3>
              <div
                className="swatches"
                aria-label={family === "cyan" ? "青色三阶" : "偏红洋红三阶"}
              >
                {colorLevels.map((level) => (
                  <button
                    key={level}
                    className="swatch"
                    disabled={themeId !== "neon"}
                    aria-label={`${family === "cyan" ? "青色" : "偏红洋红"} · ${levelLabels[level]}`}
                    aria-pressed={
                      themeId === "neon" && (family === "cyan" ? cyanLevel : magentaLevel) === level
                    }
                    onClick={() =>
                      family === "cyan" ? setCyanLevel(level) : setMagentaLevel(level)
                    }
                  >
                    <i style={{ background: neonScales[family][level] }} />
                    <strong>{levelLabels[level]}</strong>
                    <code>{neonScales[family][level]}</code>
                    <span className="color-text" style={{ color: neonScales[family][level] }}>
                      Aa 身体信号
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p>六个实色色值保持不透明。点击色卡可对照材质；切回 Neon 会保留色阶选择。</p>
          <p>洋红不表示危险，也不表示恢复不足。警示色仅在有真实异常时出现。</p>
        </article>
        <article>
          <p className="eyebrow">03 / LIGHT BUDGET</p>
          <h2>光有强弱，文字保持清晰。</h2>
          <div className="specimens">
            <button className="primary">
              探索身体 <ArrowUpRight size={18} />
            </button>
            <button className="focused" aria-label="焦点示例">
              <Crosshair size={18} />
            </button>
            <button aria-label="重置图标示例">
              <RotateCcw size={18} />
            </button>
            <button disabled>不可用</button>
          </div>
          <p>发光集中在主操作与焦点。普通控件、正文、每张卡片不同时发光；Graphite 将光晕归零。</p>
          <div className="anti-example">
            <strong>反例：所有边框都抢注意力</strong>
            <span>不要把这一行的效果扩散到整个页面。</span>
          </div>
        </article>
      </section>
      <section className="lab-references">
        <p className="eyebrow">04 / ANNOTATED REFERENCES</p>
        <h2>借鉴具体能力，保留自己的语言。</h2>
        <div>
          <a href="https://arwes.dev/docs">
            Arwes ↗<small>借鉴科幻控件的线条与状态组织；不整套引入声音、扫描和动画。</small>
          </a>
          <a href="https://threejs.org/examples/webgl_postprocessing_unreal_bloom_selective.html">
            Three.js selective bloom ↗
            <small>借鉴重点区域光晕；需要在当前材质与移动设备上单独做性能验证。</small>
          </a>
          <a href="https://www.designtokens.org/">
            Design Tokens Community Group ↗
            <small>借鉴类型、分组与别名；主题的视觉值与产品的语义角色分离。</small>
          </a>
        </div>
      </section>
      <footer>
        样板验证范围：颜色、DOM 光晕、真实人体材质切换。尚未实现主题导入、全站切换、Agent
        同步或已批准的视觉基线。
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<VisualLab />);
