import { useState, type CSSProperties } from "react";
import { ArrowLeft } from "lucide-react";
import { GlassCard } from "../../components/GlassCard";
import { gradientPalettes, sampleGradient } from "./gradient-palettes";
import "../../design/tokens.css";
import "../../components/glass-card.css";
import "./gradient-study.css";

export default function GradientStudy() {
  const [selected, setSelected] = useState(0);
  const [value, setValue] = useState(50);
  const palette = gradientPalettes[selected];
  const color = sampleGradient(palette.colors, value);
  return (
    <main className="gradient-study">
      <header className="gradient-header">
        <a href="/design-lab.html">
          <ArrowLeft size={16} aria-hidden="true" /> 原色卡样板
        </a>
        <span>COLOR STUDY / 04</span>
        <span className="draft">候选配色 · 待审阅</span>
      </header>
      <section className="gradient-intro">
        <p className="eyebrow">CYAN TO MAGENTA</p>
        <h1>从冷静的青，到有温度的洋红。</h1>
        <p>先看颜色如何连起来。三条路线，共用现有主题的青色与偏红洋红端点。</p>
        <p className="gradient-caption">独立色卡 demo，未应用到首页人体。</p>
      </section>
      <div className="gradient-layout">
        <section aria-label="候选渐变方案" className="gradient-options">
          {gradientPalettes.map((candidate, index) => (
            <button
              key={candidate.id}
              className="gradient-option"
              aria-pressed={selected === index}
              onClick={() => setSelected(index)}
            >
              <span className="gradient-option-title">
                <span>
                  0{index + 1} / {candidate.name}
                </span>
                <small>{selected === index ? "正在预览" : "点击比较"}</small>
              </span>
              <span
                className="gradient-ramp"
                style={{ background: `linear-gradient(90deg, ${candidate.colors.join(",")})` }}
              />
              <span className="gradient-description">{candidate.note}</span>
            </button>
          ))}
        </section>
        <GlassCard as="section" className="gradient-preview" aria-label="连续色彩预览">
          <p className="eyebrow">LIVE SAMPLE / {palette.name}</p>
          <div className="gradient-sample" style={{ "--sample": color } as CSSProperties}>
            <div className="gradient-sample-shape" />
            <span>纯色表面示意</span>
          </div>
          <div className="gradient-readout">
            <strong>
              {value}
              <small> / 100</small>
            </strong>
            <output aria-live="polite">{color}</output>
          </div>
          <label htmlFor="gradient-position">拖动查看连续变化</label>
          <input
            id="gradient-position"
            type="range"
            min="0"
            max="100"
            value={value}
            onChange={(event) => setValue(Number(event.target.value))}
          />
          <div className="gradient-endpoints">
            <span>较低刺激 · 冷</span>
            <span>较高刺激 · 暖</span>
          </div>
          <p className="gradient-caption">
            位置仅用于颜色比较，不是你的训练分数。刺激更高不等于训练效果更好。
          </p>
        </GlassCard>
      </div>
      <section className="gradient-steps" aria-labelledby="gradient-steps-title">
        <div className="gradient-section-heading">
          <h2 id="gradient-steps-title">拆成七张色卡看</h2>
          <p>{palette.name} · 等间隔取样</p>
        </div>
        <div className="gradient-swatches">
          {palette.colors.map((sample, index) => (
            <button
              key={index}
              className="gradient-swatch"
              aria-label={`预览色阶 ${index + 1}`}
              onClick={() => setValue(Math.round((index / 6) * 100))}
            >
              <i style={{ background: sample }} />
              <span>0{index + 1}</span>
              <code>{sample.toUpperCase()}</code>
            </button>
          ))}
        </div>
      </section>
      <footer>
        这一页只比较配色。人体上的透明度、自发光和不同肌肉之间的颜色关系，需在选定方向后单独预览。
      </footer>
    </main>
  );
}
