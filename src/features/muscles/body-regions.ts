import { muscleGroup, type MuscleGroupId } from "../../../shared/fitness/muscle-groups";
import { muscleIds, type MuscleId } from "../../../shared/muscle-taxonomy";

export const bodyRegions = [
  { id: "chest", label: "胸部", caption: "胸大肌 · 前锯肌", groups: ["chest"] },
  { id: "back", label: "背部", caption: "背阔肌 · 斜方肌", groups: ["back"] },
  { id: "shoulders", label: "肩部", caption: "三角肌 · 肩袖", groups: ["shoulders"] },
  { id: "arms", label: "手臂", caption: "上臂 · 前臂", groups: ["biceps", "triceps", "forearms"] },
  { id: "core", label: "核心", caption: "腹部 · 深层核心", groups: ["core"] },
  { id: "hips", label: "臀髋", caption: "臀肌 · 髋屈肌", groups: ["glutes", "hip_flexors"] },
  {
    id: "thighs",
    label: "大腿",
    caption: "前侧 · 后侧 · 内侧",
    groups: ["quadriceps", "hamstrings", "adductors"]
  },
  { id: "calves", label: "小腿", caption: "小腿前侧 · 后侧", groups: ["calves"] },
  { id: "neck", label: "颈部", caption: "胸锁乳突肌", groups: [] }
] as const;

export type BodyRegionId = (typeof bodyRegions)[number]["id"];

export function regionForMuscle(id: MuscleId): BodyRegionId {
  if (id === "serratus_anterior") return "chest";
  const group = muscleGroup(id);
  return (
    bodyRegions.find((region) =>
      (region.groups as readonly MuscleGroupId[]).some((candidate) => candidate === group)
    )?.id ?? "neck"
  );
}

export function musclesInRegion(region: BodyRegionId) {
  return muscleIds.filter((id) => regionForMuscle(id) === region);
}
