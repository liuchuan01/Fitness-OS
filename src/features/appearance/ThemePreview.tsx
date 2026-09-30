import type { CSSProperties } from "react";
import type { ThemeDefinition } from "../../design/theme-definitions";

/** Lightweight layout illustration, not a second WebGL scene or live training data. */
export function ThemePreview({ theme }: { theme: ThemeDefinition }) {
  const colors = theme.palette;
  return (
    <span
      className="theme-preview"
      aria-hidden="true"
      style={
        {
          "--preview-canvas": colors.canvas,
          "--preview-surface": colors.raised,
          "--preview-accent": colors["accent-mid"],
          "--preview-focus": colors["selection-mid"],
          "--preview-border": colors["border-strong"],
          "--preview-muted": colors.muted
        } as CSSProperties
      }
    >
      <span className="preview-top">
        <i />
        <i />
        <i />
      </span>
      <span className="preview-rail">
        <i />
        <i />
        <i />
        <i />
        <i />
      </span>
      <svg viewBox="0 0 160 260" fill="none">
        <g
          fill="var(--preview-surface)"
          stroke="var(--preview-accent)"
          strokeOpacity=".65"
          strokeWidth="1.4"
          strokeLinejoin="round"
        >
          <path
            d="M71 74 L72 69
              C64 65 59 57 59 47 C59 33 68 23 80 23
              C92 23 101 33 101 47 C101 57 96 65 88 69
              L89 74
              Q92 77 102 79 Q116 82 121 97
              L130 125 Q132 131 133 138 L140 163
              Q143 174 136 176 Q130 178 127 169
              L117 143 L107 116
              Q103 131 105 145 Q109 156 108 168
              L103 202 L101 229 Q101 233 106 237
              Q110 244 102 246 L90 246 Q85 246 85 239
              L83 205 L82 175 Q82 170 80 170
              Q78 170 78 175 L77 205 L75 239
              Q75 246 70 246 L58 246 Q50 244 54 237
              Q59 233 59 229 L57 202 L52 168
              Q51 156 55 145 Q57 131 53 116
              L43 143 L33 169 Q30 178 24 176
              Q17 174 20 163 L27 138 Q28 131 30 125
              L39 97 Q44 82 58 79 Q68 77 71 74 Z"
          />
        </g>
        {[false, true].map((mirrored) => (
          <g
            key={String(mirrored)}
            transform={mirrored ? "translate(160 0) scale(-1 1)" : undefined}
          >
            <g fill="var(--preview-accent)">
              <path
                d="M53 87 Q43 93 43 108 Q48 112 52 106 L58 89 Q57 86 53 87Z"
                fillOpacity=".25"
              />
              <path
                d="M62 88 Q68 86 75 87 Q77 87 77 91 L77 108 Q67 113 59 108 Q55 101 59 92 Q60 89 62 88Z"
                fillOpacity=".5"
              />
              <rect x="65" y="117" width="12" height="12" rx="3.5" fillOpacity=".32" />
              <path
                d="M68 134 H77 V143 Q77 147 73 148 L69 149 Q65 145 65 138 Q65 134 68 134Z"
                fillOpacity=".25"
              />
              <path d="M61 207 Q67 205 71 208 L69 231 Q65 234 63 230Z" fillOpacity=".18" />
            </g>
            <path
              d="M60 156 Q66 157 74 161 L72 180 Q71 192 65 198 Q61 198 60 190 L57 169 Q56 160 60 156Z"
              fill="var(--preview-focus)"
              fillOpacity=".6"
            />
          </g>
        ))}
      </svg>
      <span className="preview-hud preview-hud-left">
        <i />
        <b />
        <i />
      </span>
      <span className="preview-hud preview-hud-right">
        <i />
        <b />
        <i />
      </span>
      <span className="preview-caption">BODY / OVERVIEW</span>
    </span>
  );
}
