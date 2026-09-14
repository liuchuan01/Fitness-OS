import { describe, expect, it } from "vitest";
import { buildMuscleHistory } from "../../shared/fitness/muscle-history";
import {
  muscleHistoryQuerySchema,
  muscleHistoryResponseSchema
} from "../../shared/fitness/muscle-history-schema";
import {
  buildDashboardProjection,
  buildDailyWorkoutView,
  workoutSchema,
  type Workout
} from "../../shared/fitness/index";

const map = {
  press: {
    primary: { pec_major_mid: 1, pec_major_upper: 0.5 },
    secondary: { triceps_long_head: 0.5 }
  },
  curl: { primary: { biceps_long_head: 1 }, secondary: {} }
};
function workout(date: string): Workout {
  return workoutSchema.parse({
    id: `workout-${date}`,
    date,
    title: "训练",
    blocks: [
      {
        type: "mobility",
        name: "热身",
        exercises: [{ name: "推胸热身", exercise_id: "press", sets: [{ reps: 10 }] }]
      },
      {
        type: "strength",
        name: "力量",
        exercises: [
          {
            name: "推胸",
            exercise_id: "press",
            sets: [
              { reps: 10, kind: "warmup" },
              { reps: 8, kind: "work", weight_kg: 20 },
              { reps: 7 }
            ]
          }
        ]
      },
      {
        type: "accessory",
        name: "补充",
        exercises: [{ name: "推胸补充", exercise_id: "press", sets: [{ duration_sec: 30 }] }]
      }
    ]
  });
}

describe("muscle training history", () => {
  it("uses one counting policy, excludes warmups and counts accessory and duration sets", () => {
    const current = workout("2026-06-20");
    const detail = buildMuscleHistory({
      muscleId: "pec_major_mid",
      date: current.date,
      workouts: [current],
      muscleMap: map
    });
    expect(detail.weekly).toEqual({
      sessions: 1,
      primarySets: 3,
      secondarySets: 0,
      unclassifiedSets: 2
    });
    expect(detail.history[0].exercises).toHaveLength(2);
    const dashboard = buildDashboardProjection({
      date: current.date,
      recentWorkouts: [current],
      currentWorkout: current,
      muscleMap: map
    });
    expect(dashboard.weeklyStrengthSets).toBe(3);
    expect(dashboard.muscleSetDistribution.find((group) => group.groupId === "chest")?.sets).toBe(
      3
    );
    const daily = buildDailyWorkoutView(current, map);
    expect(detail.history[0].exercises[0].viewId).toBe(daily.blocks[1].exercises[0].id);
    expect(detail.history[0].exercises[0].sets[1]).not.toHaveProperty("weight_kg");
    expect(detail.history[0].exercises[0].sets[1]).not.toHaveProperty("rpe");
  });

  it("includes days 0–6, keeps older history, and excludes future facts and future names", () => {
    const workouts = [
      workout("2026-06-21"),
      workout("2026-06-20"),
      workout("2026-06-14"),
      workout("2026-06-13")
    ];
    workouts[0].blocks[1].exercises[0].name = "未来名称";
    const detail = buildMuscleHistory({
      muscleId: "triceps_long_head",
      date: "2026-06-20",
      workouts,
      muscleMap: map
    });
    expect(detail.weekly).toMatchObject({ sessions: 2, primarySets: 0, secondarySets: 6 });
    expect(detail.history.map((entry) => entry.date)).toEqual([
      "2026-06-20",
      "2026-06-14",
      "2026-06-13"
    ]);
    expect(detail.lastPrimaryDate).toBeNull();
    expect(detail.relatedExercises[0].name).toBe("推胸");
    expect(detail.windowStart).toBe("2026-06-14");
    expect(muscleHistoryResponseSchema.safeParse({ ok: true, muscle: detail }).success).toBe(true);
  });

  it("keeps empty history separate from candidate exercises", () => {
    const result = buildMuscleHistory({
      muscleId: "biceps_long_head",
      date: "2026-06-20",
      workouts: [workout("2026-06-20")],
      muscleMap: map
    });
    expect(result.lastTrainedDate).toBeNull();
    expect(result.history).toEqual([]);
    expect(result.relatedExercises).toHaveLength(1);
    expect(result.relatedExercises[0].lastTrainedDate).toBeNull();
    expect(result.weekly.sessions).toBe(0);
  });

  it("counts a set only once when primary and secondary mappings overlap", () => {
    const overlap = { press: { primary: { pec_major_mid: 1 }, secondary: { pec_major_mid: 0.5 } } };
    const result = buildMuscleHistory({
      muscleId: "pec_major_mid",
      date: "2026-06-20",
      workouts: [workout("2026-06-20")],
      muscleMap: overlap
    });
    expect(result.weekly.primarySets).toBe(3);
    expect(result.weekly.secondarySets).toBe(0);
  });

  it("rejects unknown muscle IDs and invalid or missing calendar dates", () => {
    for (const date of ["2026-02-30", "2026-13-01", "20-06-2026", undefined]) {
      expect(muscleHistoryQuerySchema.safeParse({ muscleId: "pec_major_mid", date }).success).toBe(
        false
      );
    }
    expect(
      muscleHistoryQuerySchema.safeParse({ muscleId: "lats", date: "2026-06-20" }).success
    ).toBe(false);
  });
});
