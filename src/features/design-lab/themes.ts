import base from "../../design/tokens.json";

export const colorLevels = ["strong", "medium", "muted"] as const;
export type ColorLevel = (typeof colorLevels)[number];
export const levelLabels = { strong: "强调", medium: "中等饱和", muted: "低饱和" };
export { neonScales } from "../../design/theme-definitions";
import { neonScales } from "../../design/theme-definitions";

// Proposal presets: this is not the external theme package contract.
export const themes = {
  neon: {
    name: "Neon / 青与洋红",
    palette: {
      ...base,
      canvas: "#070912",
      surface: "#111422",
      raised: "#1b2032",
      text: "#f1f5ff",
      muted: "#a4afc5",
      accent: neonScales.cyan.strong,
      selection: neonScales.magenta.strong,
      orange: neonScales.cyan.strong,
      blue: neonScales.magenta.strong,
      gray: "#324555",
      skin: "#263647"
    },
    emission: 0.85
  },
  graphite: {
    name: "Graphite / 无霓虹",
    palette: {
      ...base,
      canvas: "#111316",
      surface: "#1b1e23",
      raised: "#282d34",
      text: "#f3f4f6",
      muted: "#b0b7c1",
      accent: "#b7d2e5",
      selection: "#dac6ac",
      orange: "#b7d2e5",
      blue: "#dac6ac",
      gray: "#58616a",
      skin: "#42494e"
    },
    emission: 0.12
  }
};
