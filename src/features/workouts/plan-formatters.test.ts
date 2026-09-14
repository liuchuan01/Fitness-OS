import { describe, expect, it } from "vitest";
import { formatPlanSet } from "./plan-formatters";

describe("first training prescriptions", () => {
  it("preserves a reported zero load", () => {
    expect(formatPlanSet({ weight_kg: 0, reps: 8 })).toBe("0 kg × 8");
  });
  it("keeps unknown load distinct from bodyweight and presents effort targets", () => {
    const text = formatPlanSet({
      reps: 8,
      prescription: { load_selection: "现场选轻重量", target_rpe: 6, target_rir: 3 }
    });
    expect(text).toContain("负重待选择");
    expect(text).toContain("现场选轻重量");
    expect(text).toContain("目标 RPE 6");
    expect(text).toContain("保留 3 次余力");
    expect(text).not.toContain("自重");
  });
});
