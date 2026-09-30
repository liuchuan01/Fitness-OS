export function mixColor(start: string, end: string, fraction: number) {
  const channels = [1, 3, 5].map((offset) => {
    const a = parseInt(start.slice(offset, offset + 2), 16);
    const b = parseInt(end.slice(offset, offset + 2), 16);
    return Math.round(a + (b - a) * fraction)
      .toString(16)
      .padStart(2, "0");
  });
  return `#${channels.join("")}`.toUpperCase();
}

export function sampleGradient(colors: readonly string[], value: number) {
  const position = (Math.max(0, Math.min(100, value)) / 100) * (colors.length - 1);
  const index = Math.min(Math.floor(position), colors.length - 2);
  return mixColor(colors[index], colors[index + 1], position - index);
}
