import tokens from "../../design/tokens.json";

// Isolated study candidates, never consumed by the production body palette.
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
    colors: [tokens.accent, "#65C3D7", "#8AAABD", "#A292B1", "#BB7DA5", "#DC6594", tokens.selection]
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

function mixColor(start: string, end: string, fraction: number) {
  const channels = [1, 3, 5].map((offset) => {
    const a = parseInt(start.slice(offset, offset + 2), 16);
    const b = parseInt(end.slice(offset, offset + 2), 16);
    return Math.round(a + (b - a) * fraction)
      .toString(16)
      .padStart(2, "0");
  });
  return `#${channels.join("")}`.toUpperCase();
}

export function sampleGradient(colors: string[], value: number) {
  const position = (Math.max(0, Math.min(100, value)) / 100) * (colors.length - 1);
  const index = Math.min(Math.floor(position), colors.length - 2);
  return mixColor(colors[index], colors[index + 1], position - index);
}
