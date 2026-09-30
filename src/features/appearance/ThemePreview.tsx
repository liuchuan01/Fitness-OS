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
        <g stroke="var(--preview-accent)" strokeWidth="1.2" strokeLinejoin="round">
          <path
            fill="var(--preview-surface)"
            d="M80 16c-9 0-14 7-14 17 0 8 4 14 8 17v10l-24 9-9 11-10 33-8 35-5 19 4 7 6-3 5-20 13-33 9-22 6 37-4 28 5 42 2 26-5 15 3 5 14-1 3-20 2-37-1-23 4-12 4 12-1 23 2 37 3 20 14 1 3-5-5-15 2-26 5-42-4-28 6-37 9 22 13 33 5 20 6 3 4-7-5-19-8-35-10-33-9-11-24-9V50c4-3 8-9 8-17 0-10-5-17-14-17Z"
          />
          <path
            d="M54 76 76 70v27l-18-3Zm52 0L84 70v27l18-3ZM63 105l13 1v13H63Zm34 0-13 1v13h13ZM64 126h12v12l-11 5Zm32 0H84v12l11 5Z"
            fill="var(--preview-accent)"
            fillOpacity=".32"
          />
          <path
            d="m61 151 14 6-3 39-7 10-5-38Zm38 0-14 6 3 39 7 10 5-38Z"
            fill="var(--preview-focus)"
            fillOpacity=".55"
            stroke="var(--preview-focus)"
          />
          <path d="m45 83-8 26 7 6 9-26m62-6 8 26-7 6-9-26M68 213l5 22m19-22-5 22" />
        </g>
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
