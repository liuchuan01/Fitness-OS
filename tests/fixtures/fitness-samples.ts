import type { MuscleMap, Readiness, Workout } from "../../shared/fitness/index.js";

export const sampleMuscleMap: MuscleMap = {
  pull_up: {
    primary: {
      latissimus_dorsi: 1,
      biceps_long_head: 0.25,
      biceps_short_head: 0.2,
      brachialis: 0.15,
      trapezius_upper: 0.08,
      trapezius_middle: 0.09,
      trapezius_lower: 0.08
    },
    secondary: {
      deltoid_posterior: 0.4,
      rectus_abdominis_upper: 0.1,
      rectus_abdominis_lower: 0.08,
      external_oblique: 0.06,
      internal_oblique: 0.06
    }
  },
  romanian_deadlift: {
    primary: {
      biceps_femoris_long_head: 0.3,
      biceps_femoris_short_head: 0.15,
      semitendinosus: 0.28,
      semimembranosus: 0.27,
      gluteus_maximus: 0.6,
      gluteus_medius: 0.15,
      gluteus_minimus: 0.05,
      erector_spinae_lower: 0.45
    },
    secondary: {
      rectus_abdominis_upper: 0.08,
      rectus_abdominis_lower: 0.07,
      external_oblique: 0.07,
      internal_oblique: 0.06,
      transversus_abdominis: 0.07,
      trapezius_upper: 0.05,
      trapezius_middle: 0.05,
      trapezius_lower: 0.05
    }
  },
  split_squat: {
    primary: {
      rectus_femoris: 0.25,
      vastus_lateralis: 0.25,
      vastus_medialis: 0.25,
      vastus_intermedius: 0.2,
      gluteus_maximus: 0.5,
      gluteus_medius: 0.2,
      gluteus_minimus: 0.05
    },
    secondary: {
      biceps_femoris_long_head: 0.11,
      biceps_femoris_short_head: 0.05,
      semitendinosus: 0.1,
      semimembranosus: 0.09,
      rectus_abdominis_upper: 0.06,
      rectus_abdominis_lower: 0.05,
      external_oblique: 0.045,
      internal_oblique: 0.045
    }
  },
  plank: {
    primary: {
      rectus_abdominis_upper: 0.2,
      rectus_abdominis_lower: 0.2,
      external_oblique: 0.15,
      internal_oblique: 0.15,
      transversus_abdominis: 0.2,
      quadratus_lumborum: 0.1
    },
    secondary: { gluteus_maximus: 0.15, gluteus_medius: 0.05, erector_spinae_lower: 0.15 }
  }
};

export const sampleReadiness: Readiness = { fatigue: 5, sleep_quality: 7, soreness: 3, mood: 7 };

export const sampleWorkout: Workout = {
  id: "workout_2026-06-19",
  date: "2026-06-19",
  title: "Pull Day / 引体向上强化",
  bodyweight_kg: 70,
  readiness: sampleReadiness,
  blocks: [
    {
      type: "strength",
      name: "主训练",
      exercises: [
        {
          name: "引体向上",
          exercise_id: "pull_up",
          sets: [
            { reps: 6, bodyweight_factor: 0.7, rpe: 7 },
            { reps: 5, bodyweight_factor: 0.7, rpe: 8 }
          ]
        },
        {
          name: "罗马尼亚硬拉",
          exercise_id: "romanian_deadlift",
          sets: [
            { weight_kg: 60, reps: 8, rpe: 7 },
            { weight_kg: 65, reps: 6, rpe: 8 }
          ]
        }
      ]
    },
    {
      type: "accessory",
      name: "辅助",
      exercises: [
        {
          name: "平板支撑",
          exercise_id: "plank",
          sets: [
            { reps: 1, duration_sec: 60, bodyweight_factor: 0.25, rpe: 6 },
            { reps: 1, duration_sec: 45, bodyweight_factor: 0.25, rpe: 7 }
          ]
        }
      ]
    }
  ]
};

export const sampleRecentWorkouts: Workout[] = [
  sampleWorkout,
  {
    id: "workout_2026-06-16",
    date: "2026-06-16",
    title: "Lower Body / 髋主导",
    bodyweight_kg: 70,
    readiness: { fatigue: 6, sleep_quality: 6, soreness: 5, mood: 6 },
    blocks: [
      {
        type: "strength",
        name: "下肢",
        exercises: [
          {
            name: "保加利亚分腿蹲",
            exercise_id: "split_squat",
            sets: [
              { weight_kg: 18, reps: 10, rpe: 7 },
              { weight_kg: 18, reps: 10, rpe: 8 }
            ]
          }
        ]
      }
    ]
  }
];
