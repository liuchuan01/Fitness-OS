import { describe, expect, it } from "vitest";
import { appThemes, neonLoadColors } from "./theme-definitions";
import { bodyLoadColor } from "./body-load";
import { sampleGradient } from "./color-scale";

describe("soft load colors", () => {
  it("preserves approved stops and interpolates between them", () => {
    expect(sampleGradient(neonLoadColors, 0)).toBe("#00E5FF");
    expect(sampleGradient(neonLoadColors, 50)).toBe("#A292B1");
    expect(sampleGradient(neonLoadColors, 100)).toBe("#FF477E");
    expect(sampleGradient(neonLoadColors, 25)).toBe("#78B7CA");
    expect(sampleGradient(neonLoadColors, 150)).toBe("#FF477E");
  });
  it("keeps zero or unavailable load neutral and ignores discrete status for positive load", () => {
    const resolve = (intensity: number) =>
      bodyLoadColor({ intensity, status: "gray" }, appThemes.neon.palette, neonLoadColors);
    for (const value of [0, -1, NaN]) expect(resolve(value)).toBe(appThemes.neon.palette.gray);
    expect(resolve(50)).toBe("#A292B1");
    expect(resolve(49.99)).toBe(resolve(50.01));
    // Crossing the old status threshold must not create a palette jump.
    expect(
      bodyLoadColor({ intensity: 50, status: "blue" }, appThemes.neon.palette, neonLoadColors)
    ).toBe(resolve(50));
  });
  it("keeps Graphite's existing status palette", () => {
    expect(
      bodyLoadColor(
        { intensity: 50, status: "orange" },
        appThemes.graphite.palette,
        appThemes.graphite.body.loadColors
      )
    ).toBe(appThemes.graphite.palette.orange);
  });
});
