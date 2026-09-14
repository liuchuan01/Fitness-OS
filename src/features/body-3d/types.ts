import type { MuscleId, MuscleVisualState } from "../../../shared/fitness/index";

export type BodyViewer3DProps = {
  muscles: MuscleVisualState[];
  selectedMuscle: MuscleId | null;
  onMuscleSelect: (muscleId: MuscleId | null) => void;
  exerciseTargets?: { primaryMuscles: MuscleId[]; secondaryMuscles: MuscleId[] } | null;
  projectionLabel: string;
  onExplorationChange?: (open: boolean) => void;
};

export type Manifest = {
  version: string;
  targets: Record<string, string[]>;
  stats: {
    mesh_objects: number;
    vertices: number;
    polygons: number;
    armatures: number;
    genital_region_flattened: boolean;
  };
};

export type ModelContract = {
  muscles: Record<
    MuscleId,
    {
      group: string;
      label_zh: string;
      display_mode: "normal" | "professional";
      coverage: "exact" | "partial" | "missing";
      model_groups: string[];
      model_targets: string[];
      pickable: boolean;
      highlightable: boolean;
      note?: string;
    }
  >;
};

export type ModelMeta = {
  manifest: Manifest;
  contract: ModelContract;
};
