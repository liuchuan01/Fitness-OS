import neon from "./tokens.json";
import graphite from "./graphite.json";

export const themeIds = ["neon", "graphite"] as const;
export type ThemeId = (typeof themeIds)[number];
export type ThemeDefinition = {
  id: ThemeId;
  name: string;
  palette: typeof neon;
  body: { focusEmission: number; baseEmission: number; skinOpacity: number };
};
export const appThemes: Record<ThemeId, ThemeDefinition> = {
  neon: {
    id: "neon",
    name: "Neon / 青与洋红",
    palette: neon,
    body: { focusEmission: 0.48, baseEmission: 0.06, skinOpacity: 0.12 }
  },
  graphite: {
    id: "graphite",
    name: "Graphite / 无霓虹",
    palette: { ...neon, ...graphite },
    body: { focusEmission: 0.12, baseEmission: 0.035, skinOpacity: 0.12 }
  }
};
export const neonScales = {
  cyan: { strong: neon.accent, medium: neon["accent-mid"], muted: neon["accent-muted"] },
  magenta: { strong: neon.selection, medium: neon["selection-mid"], muted: neon["selection-muted"] }
};
