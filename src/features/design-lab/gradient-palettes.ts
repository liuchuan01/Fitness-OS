import tokens from "../../design/tokens.json";

import { neonLoadColors } from "../../design/theme-definitions";
import { mixColor } from "../../design/color-scale";
export { sampleGradient } from "../../design/color-scale";

// Other candidates remain isolated; soft shares the approved production stops.
export const gradientPalettes = [
  {
    id: "spectrum",
    name: "蓝紫桥接",
    note: "青 → 天蓝 → 蓝紫 → 紫 → 玫红。色相变化明显，保留赛博感。",
    colors: [tokens.accent, "#48C9F6", "#7AA9EF", "#A58BDF", "#CB71C3", "#EB59A1", tokens.selection]
  },
  {
    id: "soft",
    name: "柔和桥接",
    note: "中段降低饱和度，经过雾蓝与灰紫。更安静，层级差异也更含蓄。",
    colors: neonLoadColors
  },
  {
    id: "direct",
    name: "直接混色",
    note: "青与洋红直接混合。中间偏灰蓝，用来对照是否需要更鲜明的蓝紫。",
    colors: Array.from({ length: 7 }, (_, index) =>
      mixColor(tokens.accent, tokens.selection, index / 6)
    )
  }
];
