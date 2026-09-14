import type { MuscleId } from "./schema.js";

export const muscleGroupIds = [
  "chest",
  "shoulders",
  "back",
  "triceps",
  "biceps",
  "core",
  "glutes",
  "quadriceps",
  "hamstrings",
  "adductors",
  "calves",
  "forearms",
  "hip_flexors"
] as const;
export type MuscleGroupId = (typeof muscleGroupIds)[number];

export const muscleGroupLabels: Record<MuscleGroupId, string> = {
  chest: "胸",
  shoulders: "肩",
  back: "背",
  triceps: "肱三头",
  biceps: "肱二头",
  core: "核心",
  glutes: "臀",
  quadriceps: "股四头",
  hamstrings: "腘绳肌",
  adductors: "内收肌",
  calves: "小腿",
  forearms: "前臂",
  hip_flexors: "髋屈肌"
};

export function muscleGroup(muscleId: MuscleId): MuscleGroupId | null {
  if (muscleId.startsWith("pec_")) return "chest";
  if (
    muscleId.startsWith("deltoid_") ||
    ["supraspinatus", "infraspinatus", "teres_minor", "subscapularis"].includes(muscleId)
  )
    return "shoulders";
  if (
    muscleId.startsWith("trapezius_") ||
    [
      "rhomboid_major",
      "levator_scapulae",
      "teres_major",
      "latissimus_dorsi",
      "erector_spinae_upper",
      "erector_spinae_lower"
    ].includes(muscleId)
  )
    return "back";
  if (muscleId.startsWith("triceps_")) return "triceps";
  if (muscleId.startsWith("biceps_") || muscleId === "brachialis") return "biceps";
  if (
    muscleId.startsWith("rectus_abdominis_") ||
    [
      "external_oblique",
      "internal_oblique",
      "transversus_abdominis",
      "quadratus_lumborum",
      "diaphragm"
    ].includes(muscleId)
  )
    return "core";
  if (muscleId.startsWith("gluteus_")) return "glutes";
  if (muscleId === "rectus_femoris" || muscleId.startsWith("vastus_") || muscleId === "sartorius")
    return "quadriceps";
  if (
    muscleId.startsWith("biceps_femoris_") ||
    ["semitendinosus", "semimembranosus", "popliteus"].includes(muscleId)
  )
    return "hamstrings";
  if (muscleId.startsWith("adductor_") || ["gracilis", "pectineus"].includes(muscleId))
    return "adductors";
  if (
    muscleId.startsWith("gastrocnemius_") ||
    [
      "soleus",
      "tibialis_anterior",
      "extensor_digitorum_longus",
      "fibularis_longus",
      "fibularis_brevis",
      "tibialis_posterior"
    ].includes(muscleId)
  )
    return "calves";
  if (
    muscleId.startsWith("forearm_") ||
    ["brachioradialis", "pronator_teres", "supinator"].includes(muscleId)
  )
    return "forearms";
  return ["iliopsoas", "tensor_fasciae_latae"].includes(muscleId) ? "hip_flexors" : null;
}
