import { describe, expect, it } from "vitest";
import {
  bodyMetricsSchema,
  buildEmptyDashboardProjection,
  buildPlanPreview,
  calculateStimulus,
  calculateRecovery,
  calculateWorkoutTotals,
  planSchema,
  workoutSchema
} from "../../shared/fitness/index.js";
const map = { pushup: { primary: { pec_major_mid: 1 }, secondary: {} } };
const raw = {
  id: "first",
  date: "2026-09-13",
  title: "First",
  blocks: [
    { type: "strength", name: "主训练", exercises: [{ name: "pushup", sets: [{ reps: 8 }] }] }
  ]
};
describe("unknown fitness estimates", () => {
  it("retains sets without inventing zero load or recovery", () => {
    const workout = workoutSchema.parse(raw);
    expect(calculateStimulus(workout, map)).toMatchObject({
      total_sets: 1,
      total_volume_kg: null,
      estimation_missing_sets: 1
    });
    expect(calculateWorkoutTotals(workout).total_volume_kg).toBeNull();
    expect(
      buildEmptyDashboardProjection({ date: raw.date }).bodyProjection.every(
        (muscle) => muscle.recoveryScore === null
      )
    ).toBe(true);
  });
  it("does not infer recovery from absent history or treat mobility as missing strength load", () => {
    expect(
      calculateRecovery({
        recentWorkouts: [],
        readiness: { fatigue: 0, soreness: 0, sleep_quality: 10, mood: 10 }
      }).overall_score
    ).toBeNull();
    const workout = workoutSchema.parse(raw);
    workout.blocks[0].type = "mobility";
    expect(calculateStimulus(workout, map)).not.toHaveProperty("estimation_missing_sets");
    expect(workoutSchema.safeParse({ ...raw, date: "2026-02-30" }).success).toBe(false);
    expect(planSchema.safeParse({ ...raw, date: "2026-02-30" }).success).toBe(false);
  });
  it("distinguishes measured zero and preserves historical known calculations", () => {
    const workout = workoutSchema.parse(raw);
    workout.blocks[0].exercises[0].sets[0].weight_kg = 0;
    expect(calculateStimulus(workout, map)).toMatchObject({ total_volume_kg: 0 });
    expect(calculateStimulus(workout, map)).not.toHaveProperty("estimation_missing_sets");
  });
  it("keeps load prescription in plans and removes it from actual facts", () => {
    const plan = planSchema.parse(raw);
    plan.bodyweight_kg = 70;
    plan.blocks[0].exercises[0].sets[0].prescription = {
      load_selection: "现场选可控负重",
      target_rir: 3
    };
    expect(buildPlanPreview(plan, map).warnings).toContain("load_estimate_unavailable");
    expect(workoutSchema.safeParse(plan).success).toBe(false);
  });
  it("requires actual measurements, allowing unknown fields to remain absent", () => {
    expect(
      bodyMetricsSchema.safeParse({
        schema_version: 1,
        measurements: [{ date: raw.date, target_weight_kg: 70 }]
      }).success
    ).toBe(false);
  });
});
