import { describe, expect, it } from "vitest";
import {
  buildDashboardProjection,
  buildDailyWorkoutView,
  buildEmptyDashboardProjection,
  buildPlanPreview,
  buildTimeline,
  calculateRecovery,
  calculateStimulus,
  planDraftSchema,
  planSchema
} from "../../shared/fitness/index";
import {
  sampleMuscleMap,
  sampleReadiness,
  sampleRecentWorkouts,
  sampleWorkout
} from "../fixtures/fitness-samples";

describe("deterministic calculation", () => {
  it("returns the same stimulus for the same workout input", () => {
    const first = calculateStimulus(sampleWorkout, sampleMuscleMap);
    const second = calculateStimulus(sampleWorkout, sampleMuscleMap);

    expect(first).toEqual(second);
    expect(first.total_sets).toBe(6);
    expect(first.stimulus.latissimus_dorsi).toBeGreaterThan(first.stimulus.triceps_long_head);
  });

  it("changes muscle stimulus when load increases", () => {
    const heavierWorkout = structuredClone(sampleWorkout);
    heavierWorkout.blocks[0].exercises[0].sets[0].rpe = 9;

    const baseline = calculateStimulus(sampleWorkout, sampleMuscleMap);
    const heavier = calculateStimulus(heavierWorkout, sampleMuscleMap);

    expect(heavier.stimulus.latissimus_dorsi).toBeGreaterThan(baseline.stimulus.latissimus_dorsi);
  });

  it("uses local stimulus rules without introducing nondeterminism", () => {
    const baseline = calculateStimulus(sampleWorkout, sampleMuscleMap);
    const adjusted = calculateStimulus(sampleWorkout, sampleMuscleMap, {
      schema_version: 1,
      rpe_base: 0.6,
      rpe_step: 0.09,
      default_rpe: 7,
      default_bodyweight_factor: 0.65,
      secondary_stimulus_factor: 0.75,
      primary_recovery_factor: 0.65,
      secondary_recovery_factor: 0.45,
      stimulus_normalization_divisor: 10,
      recovery_normalization_divisor: 25
    });
    const adjustedAgain = calculateStimulus(sampleWorkout, sampleMuscleMap, {
      schema_version: 1,
      rpe_base: 0.6,
      rpe_step: 0.09,
      default_rpe: 7,
      default_bodyweight_factor: 0.65,
      secondary_stimulus_factor: 0.75,
      primary_recovery_factor: 0.65,
      secondary_recovery_factor: 0.45,
      stimulus_normalization_divisor: 10,
      recovery_normalization_divisor: 25
    });

    expect(adjusted).toEqual(adjustedAgain);
    expect(adjusted.stimulus.latissimus_dorsi).toBeGreaterThan(baseline.stimulus.latissimus_dorsi);
  });

  it("marks lower back recovery when constraints and load overlap", () => {
    const recovery = calculateRecovery({
      recentWorkouts: sampleRecentWorkouts.map((workout, index) => ({
        workout,
        stimulus: calculateStimulus(workout, sampleMuscleMap),
        daysAgo: index
      })),
      readiness: {
        ...sampleReadiness,
        fatigue: 7,
        soreness: 7,
        sleep_quality: 4
      },
      constraints: { lower_back_sensitive: true }
    });

    expect(recovery.warnings).toContain("lower_back_sensitive");
    expect(recovery.overall_score).toBeLessThan(80);
  });

  it("builds a dashboard projection that matches computed fields", () => {
    const dashboard = buildDashboardProjection({
      date: "2026-06-20",
      recentWorkouts: sampleRecentWorkouts,
      currentWorkout: sampleWorkout,
      muscleMap: sampleMuscleMap,
      constraints: { lower_back_sensitive: true }
    });

    expect(dashboard.computedStimulus.latissimus_dorsi).toBeGreaterThan(0);
    expect(
      dashboard.bodyProjection.find((muscle) => muscle.muscleId === "latissimus_dorsi")?.intensity
    ).toBeGreaterThan(0);
    expect(dashboard.daysSinceLastWorkout).toBe(1);
    expect(dashboard.weeklyTrainingSessions).toBe(2);
    expect(dashboard.weeklyStrengthSets).toBeGreaterThan(0);
    expect(dashboard.muscleSetDistribution[0]?.sets).toBeGreaterThan(0);
  });

  it("builds plan preview expected stimulus separately from dashboard load", () => {
    const plan = {
      ...structuredClone(sampleWorkout),
      id: "plan_2026-06-20_pull",
      date: "2026-06-20",
      source: "agent_generated",
      user_intent: "今天想练背"
    };
    const preview = buildPlanPreview(plan, sampleMuscleMap);

    expect(preview.computedExpectedStimulus.latissimus_dorsi).toBeGreaterThan(0);
    expect(preview.totalSets).toBe(6);
    expect(preview.warnings).toEqual([]);
  });

  it("strips workout-only fields from stored plans", () => {
    const plan = planSchema.parse({
      ...structuredClone(sampleWorkout),
      id: "plan_2026-06-20_pull",
      date: "2026-06-20",
      source_plan_file: "plans/old.yaml",
      computed: calculateStimulus(sampleWorkout, sampleMuscleMap),
      source: "agent_generated"
    });

    expect("computed" in plan).toBe(false);
    expect("source_plan_file" in plan).toBe(false);
  });

  it("rejects AI plan drafts with computed fields or alias muscle ids", () => {
    expect(() =>
      planDraftSchema.parse({
        title: "Bad draft",
        blocks: [],
        computed_expected_stimulus: { latissimus_dorsi: 50 }
      })
    ).toThrow();

    expect(() =>
      planDraftSchema.parse({
        title: "Alias draft",
        blocks: [],
        ai_stimulus_intent: {
          target: {
            lats: "high"
          }
        }
      })
    ).toThrow();
  });

  it("keeps workouts older than seven days out of weekly volume and recovery", () => {
    const baseline = buildDashboardProjection({
      date: "2026-06-20",
      recentWorkouts: sampleRecentWorkouts,
      currentWorkout: sampleWorkout,
      muscleMap: sampleMuscleMap
    });
    const oldWorkout = structuredClone(sampleWorkout);
    oldWorkout.id = "workout_2026-05-01";
    oldWorkout.date = "2026-05-01";
    const withOldHistory = buildDashboardProjection({
      date: "2026-06-20",
      recentWorkouts: [...sampleRecentWorkouts, oldWorkout],
      currentWorkout: sampleWorkout,
      muscleMap: sampleMuscleMap
    });

    expect(withOldHistory.weeklyTrainingSessions).toBe(baseline.weeklyTrainingSessions);
    expect(withOldHistory.weeklyStrengthSets).toBe(baseline.weeklyStrengthSets);
    expect(withOldHistory.muscleSetDistribution).toEqual(baseline.muscleSetDistribution);
  });

  it("builds a sorted timeline with date groups and intensity", () => {
    const timeline = buildTimeline(sampleRecentWorkouts, sampleMuscleMap, undefined, "2026-06-20");

    expect(timeline.map((workout) => workout.date)).toEqual(["2026-06-19", "2026-06-16"]);
    expect(timeline[0].group).toBe("yesterday");
    expect(timeline[1].group).toBe("this_week");
    expect(timeline[0].intensity).toBeGreaterThan(0);
  });

  it("maps daily workout exercises to primary and secondary muscles", () => {
    const daily = buildDailyWorkoutView(sampleWorkout, sampleMuscleMap);
    const pullUp = daily.blocks[0].exercises[0];

    expect(pullUp.name).toBe("引体向上");
    expect(pullUp.primaryMuscles).toEqual(
      expect.arrayContaining(["latissimus_dorsi", "biceps_long_head", "biceps_short_head"])
    );
    expect(pullUp.secondaryMuscles).toEqual(
      expect.arrayContaining(["deltoid_posterior", "rectus_abdominis_upper"])
    );
    expect(
      daily.bodyProjection.find((muscle) => muscle.muscleId === "latissimus_dorsi")?.intensity
    ).toBe(34);
  });

  it("assigns unique view ids when multiple exercises share a muscle-map id", () => {
    const repeated = structuredClone(sampleWorkout);
    repeated.blocks[0].exercises.push({
      ...structuredClone(repeated.blocks[0].exercises[0]),
      name: "辅助引体"
    });

    const daily = buildDailyWorkoutView(repeated, sampleMuscleMap);
    const ids = daily.blocks.flatMap((block) => block.exercises.map((exercise) => exercise.id));

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("builds a readable empty dashboard without training data", () => {
    const dashboard = buildEmptyDashboardProjection({ date: "2026-06-21" });

    expect(dashboard.hasTrainingData).toBe(false);
    expect(dashboard.weeklyTrainingSessions).toBe(0);
    expect(dashboard.weeklyStrengthSets).toBe(0);
    expect(dashboard.muscleSetDistribution).toEqual([]);
    expect(dashboard.bodyProjection.every((muscle) => muscle.status === "gray")).toBe(true);
  });
});
