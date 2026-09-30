import neon from "./tokens.json";
import graphite from "./graphite.json";

export const themeIds = ["neon", "graphite"] as const;
export type ThemeId = (typeof themeIds)[number];
export type ThemeDefinition = {
  id: ThemeId;
  name: string;
  palette: typeof neon;
  body: {
    focusEmission: number;
    baseEmission: number;
    skinOpacity: number;
    loadColors?: readonly string[];
  };
};
export const neonLoadColors = [
  neon.accent,
  neon["body-load-1"],
  neon["body-load-2"],
  neon["body-load-3"],
  neon["body-load-4"],
  neon["body-load-5"],
  neon.selection
];

export const graphiteLoadColors = [
  graphite.accent,
  graphite["body-load-1"],
  graphite["body-load-2"],
  graphite["body-load-3"],
  graphite["body-load-4"],
  graphite["body-load-5"],
  graphite.selection
];

export const appThemes: Record<ThemeId, ThemeDefinition> = {
  neon: {
    id: "neon",
    name: "Neon / 青与洋红",
    palette: neon,
    body: { focusEmission: 0.48, baseEmission: 0.06, skinOpacity: 0.12, loadColors: neonLoadColors }
  },
  graphite: {
    id: "graphite",
    name: "Graphite / 无霓虹",
    palette: { ...neon, ...graphite },
    body: {
      focusEmission: 0.12,
      baseEmission: 0.035,
      skinOpacity: 0.12,
      loadColors: graphiteLoadColors
    }
  }
};
