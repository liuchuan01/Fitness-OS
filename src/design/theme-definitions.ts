import neon from "../../resources/themes/neon/theme.json";
import graphite from "../../resources/themes/graphite/theme.json";
import { parseThemePackage, themeTokenMap, type ResolvedTheme } from "../../shared/themes/schema";
type Palette = Record<
  | keyof typeof themeTokenMap
  | "shadow-panel"
  | "glow-accent"
  | "glow-selection"
  | "body-load-1"
  | "body-load-2"
  | "body-load-3"
  | "body-load-4"
  | "body-load-5",
  string
>;

export type ThemeId = string;
export type ThemeDefinition = ResolvedTheme & {
  palette: Palette;
  cssVariables: Record<string, string>;
};
const fonts = {
  system: '"Inter", "Noto Sans SC", system-ui, -apple-system, sans-serif',
  sans: '"Inter", "Noto Sans SC", system-ui, -apple-system, sans-serif',
  serif: 'Georgia, "Noto Serif SC", serif',
  mono: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace'
};
function glow(color: string) {
  const channels = [1, 3, 5]
    .map((offset) => parseInt(color.slice(offset, offset + 2), 16))
    .join(", ");
  return `0 0 16px rgba(${channels}, 0.18), 0 0 36px rgba(${channels}, 0.06)`;
}
function fontFamily(theme: ResolvedTheme) {
  let hash = 2166136261;
  for (const character of theme.assetUrls.font ?? "")
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return `FitnessTheme-${theme.id}-${theme.version}-${(hash >>> 0).toString(16)}`;
}

/** The sole adapter from public semantic tokens to legacy CSS and Three palette keys. */
export function resolveTheme(theme: ResolvedTheme): ThemeDefinition {
  const palette = Object.fromEntries(
    Object.entries(themeTokenMap).map(([key, role]) => [key, theme.tokens[role]])
  ) as Palette;
  for (const step of [1, 2, 3, 4, 5] as const)
    palette[`body-load-${step}`] = theme.body.loadColors[step];
  palette["shadow-panel"] = `0 20px 60px rgba(0, 0, 0, ${theme.material.panelShadowOpacity})`;
  palette["glow-accent"] = theme.effects.glow ? glow(palette.accent) : "none";
  palette["glow-selection"] = theme.effects.glow ? glow(palette.selection) : "none";
  const { material: m, typography: t, effects: e } = theme;
  const prefix = theme.assetUrls.font ? `"${fontFamily(theme)}", ` : "";
  const cssVariables = Object.fromEntries(
    Object.entries(palette).map(([key, value]) => [`--${key}`, value])
  );
  Object.assign(cssVariables, {
    "--font-body": prefix + fonts[t.body],
    "--font-heading":
      prefix + (t.heading === "system" ? '"Space Grotesk", ' + fonts.sans : fonts[t.heading]),
    "--font-numeric": fonts[t.numeric],
    "--theme-radius": `${m.radius}px`,
    "--theme-blur": `${m.blur}px`,
    "--theme-quiet-blur": `${m.quietBlur}px`,
    "--theme-expanded-blur": `${m.expandedBlur}px`,
    "--theme-fill-opacity": `${m.fillOpacity * 100}%`,
    "--theme-quiet-fill-opacity": `${m.quietFillOpacity * 100}%`,
    "--theme-expanded-fill-opacity": `${m.expandedFillOpacity * 100}%`,
    "--theme-edge-opacity": String(m.edgeOpacity),
    "--theme-quiet-edge-opacity": String(m.quietEdgeOpacity),
    "--theme-edge-animation": e.edgeAnimation ? "glass-edge-drift 18s linear infinite" : "none",
    "--motion-duration": `${e.duration}ms`
  });
  return { ...theme, palette, cssVariables };
}
const builtin = (value: unknown) =>
  resolveTheme({ ...parseThemePackage(value), source: "builtin", assetUrls: {} });
export const appThemes = { neon: builtin(neon), graphite: builtin(graphite) };
export const themeIds = Object.keys(appThemes);
export const neonLoadColors = appThemes.neon.body.loadColors;
export const graphiteLoadColors = appThemes.graphite.body.loadColors;

export function applyTheme(theme: ThemeDefinition) {
  const root = document.documentElement;
  for (const [property, value] of Object.entries(theme.cssVariables))
    root.style.setProperty(property, value);
  root.dataset.theme = theme.id;
  root.dataset.glow = "on";
  root.style.colorScheme = theme.appearance;
}
const loadedFonts = new Map<string, Promise<void>>();
export async function prepareTheme(
  theme: ThemeDefinition
): Promise<{ theme: ThemeDefinition; warning?: string }> {
  const url = theme.assetUrls.font;
  if (!url) return { theme };
  const key = `${fontFamily(theme)}:${url}`;
  let promise = loadedFonts.get(key);
  if (!promise) {
    promise = (async () => {
      const face = new FontFace(fontFamily(theme), `url("${url}")`);
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          face.load(),
          new Promise<never>((_, reject) => {
            timeout = setTimeout(() => reject(new Error("Theme font load timed out")), 3000);
          })
        ]);
      } finally {
        clearTimeout(timeout);
      }
      document.fonts.add(face);
    })();
    loadedFonts.set(key, promise);
    promise.catch(() => loadedFonts.delete(key));
  }
  try {
    await promise;
    return { theme };
  } catch {
    return {
      theme: resolveTheme({ ...theme, assetUrls: { ...theme.assetUrls, font: undefined } }),
      warning: `主题“${theme.name}”的字体未能加载，已使用预设字体。`
    };
  }
}
