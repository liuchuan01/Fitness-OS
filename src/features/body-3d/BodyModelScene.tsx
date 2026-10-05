import { bodyLoadColor } from "../../design/body-load";
import { appThemes } from "../../design/theme-definitions";
import { useLoader, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo } from "react";
import {
  Box3,
  Color,
  DoubleSide,
  FrontSide,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector3
} from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { ThreeEvent } from "@react-three/fiber";
import type { Object3D } from "three";
import type { MuscleId, MuscleVisualState } from "../../../shared/fitness/index";
import type { BodyViewer3DProps, ModelContract } from "./types";
import { addMuscleDepthPrepass } from "./muscle-depth";

const defaultPalette = appThemes.neon.palette;
const MODEL_URL = "/models/bodyparts3d/bodyparts3d-fitness-taxonomy-draco.glb";

type MeshBinding = {
  muscleId: MuscleId;
  coverage: "exact" | "partial" | "missing";
  displayMode: "normal" | "professional";
  pickable: boolean;
};

type BodyModelSceneProps = {
  palette?: typeof defaultPalette;
  loadColors?: readonly string[];
  focusEmission?: number;
  baseEmission?: number;
  skinOpacity?: number;
  roughness?: number;
  metalness?: number;
  secondaryColor?: string;
  regionMuscles: MuscleId[];
  exerciseTargets?: BodyViewer3DProps["exerciseTargets"];
  contract: ModelContract;
  hovered: MuscleId | null;
  muscles: MuscleVisualState[];
  onHover: (muscleId: MuscleId | null) => void;
  onReady: () => void;
  onSelect: (muscleId: MuscleId) => void;
  professionalMode: boolean;
  selected: Set<MuscleId>;
};

export function BodyModelScene({
  palette = defaultPalette,
  loadColors,
  focusEmission = 0.28,
  baseEmission = 0.06,
  skinOpacity = 0.12,
  roughness = 0.68,
  metalness = 0.04,
  secondaryColor = palette.blue,
  contract,
  regionMuscles,
  exerciseTargets,
  muscles,
  professionalMode,
  hovered,
  selected,
  onHover,
  onReady,
  onSelect
}: BodyModelSceneProps) {
  const invalidate = useThree((state) => state.invalidate);
  const gltf = useLoader(GLTFLoader, MODEL_URL, (loader) => {
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("/draco/");
    loader.setDRACOLoader(dracoLoader);
  });
  const targetBindings = useMemo(() => buildTargetBindingLookup(contract), [contract]);
  const model = useMemo(() => {
    const scene = gltf.scene.clone(true);
    frameModel(scene);
    prepareModel(scene, targetBindings, palette, skinOpacity, roughness, metalness);
    addMuscleDepthPrepass(scene);
    return scene;
  }, [gltf.scene, targetBindings, palette, skinOpacity, roughness, metalness]);
  useEffect(
    () => () => {
      model.traverse((node) => {
        if (node instanceof Mesh) {
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          materials.forEach((material) => material.dispose());
        }
      });
    },
    [model]
  );
  const muscleById = useMemo(
    () => new Map(muscles.map((muscle) => [muscle.muscleId, muscle])),
    [muscles]
  );

  useEffect(() => {
    onReady();
  }, [onReady]);

  useEffect(() => {
    model.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      const muscleId = node.userData.taxonomyMuscleId as MuscleId | undefined;
      if (!muscleId) return;
      const muscle = muscleById.get(muscleId);
      const material = node.material;
      if (!(material instanceof MeshStandardMaterial)) return;
      node.visible =
        professionalMode || node.userData.displayMode !== "professional" || selected.has(muscleId);

      const primary = exerciseTargets?.primaryMuscles.includes(muscleId);
      const secondary = exerciseTargets?.secondaryMuscles.includes(muscleId);
      const isRegion = regionMuscles.includes(muscleId);
      const hasFocus = selected.size > 0 || regionMuscles.length > 0 || Boolean(exerciseTargets);
      const isSelected = selected.has(muscleId) || primary || secondary || isRegion;
      const isHovered = hovered === muscleId;
      const coverage = contract.muscles[muscleId]?.coverage;
      const color = new Color(
        selected.has(muscleId) || isRegion
          ? palette.selection
          : exerciseTargets
            ? primary
              ? palette.accent
              : secondary
                ? secondaryColor
                : palette.gray
            : muscle
              ? bodyLoadColor(muscle, palette, loadColors)
              : palette.gray
      );
      const intensity = (muscle?.intensity ?? 0) / 100;
      const opacity = coverage === "partial" ? 0.62 : 0.78 + intensity * 0.22;

      material.color.copy(color);
      material.emissive.copy(color);
      material.emissiveIntensity =
        isSelected || isHovered
          ? focusEmission
          : hasFocus
            ? baseEmission * 0.35
            : baseEmission + intensity * baseEmission;
      material.opacity = isSelected || isHovered ? 1 : hasFocus ? 0.28 : opacity;
      node.scale.setScalar(1);
    });
    invalidate();
  }, [
    invalidate,
    palette,
    loadColors,
    focusEmission,
    baseEmission,
    secondaryColor,
    contract.muscles,
    exerciseTargets,
    hovered,
    model,
    muscleById,
    professionalMode,
    selected,
    regionMuscles
  ]);

  const findMuscleId = useCallback((object: Object3D): MuscleId | null => {
    let current: Object3D | null = object;
    while (current) {
      if (current.userData.taxonomyMuscleId && current.userData.pickable === true) {
        return current.userData.taxonomyMuscleId as MuscleId;
      }
      current = current.parent;
    }
    return null;
  }, []);

  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      const muscleId = findMuscleId(event.object);
      if (!muscleId) return;
      event.stopPropagation();
      onHover(muscleId);
      document.body.style.cursor = "pointer";
    },
    [findMuscleId, onHover]
  );
  const handlePointerOut = useCallback(() => {
    onHover(null);
    document.body.style.cursor = "";
  }, [onHover]);
  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      const muscleId = findMuscleId(event.object);
      if (!muscleId || event.delta > 4) return;
      event.stopPropagation();
      onSelect(muscleId);
    },
    [findMuscleId, onSelect]
  );

  return (
    <group onClick={handleClick} onPointerMove={handlePointerMove} onPointerOut={handlePointerOut}>
      <primitive object={model} />
    </group>
  );
}

function normalizeModelId(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function buildTargetBindingLookup(contract: ModelContract) {
  const lookup = new Map<string, MeshBinding>();

  for (const [muscleId, config] of Object.entries(contract.muscles) as Array<
    [MuscleId, ModelContract["muscles"][MuscleId]]
  >) {
    if (config.highlightable === false) continue;
    for (const target of config.model_targets) {
      lookup.set(normalizeModelId(target), {
        muscleId,
        coverage: config.coverage,
        displayMode: config.display_mode,
        pickable: config.coverage === "exact" && config.pickable !== false
      });
    }
  }

  return lookup;
}

function prepareModel(
  scene: Object3D,
  targetBindings: Map<string, MeshBinding>,
  palette: typeof defaultPalette,
  skinOpacity: number,
  roughness: number,
  metalness: number
) {
  scene.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    const normalizedName = normalizeModelId(node.name);
    const binding = targetBindings.get(normalizedName);
    const taxonomyMuscleId = binding?.muscleId;

    if (normalizedName.startsWith("skin")) {
      node.material = new MeshBasicMaterial({
        color: palette.skin,
        depthWrite: false,
        opacity: skinOpacity,
        side: FrontSide,
        transparent: true
      });
      node.renderOrder = 1;
      return;
    }

    node.material = new MeshStandardMaterial({
      color: taxonomyMuscleId ? palette.gray : palette.unbound,
      depthWrite: false,
      emissive: taxonomyMuscleId ? palette.gray : palette.surface,
      emissiveIntensity: taxonomyMuscleId ? 0.1 : 0.02,
      metalness,
      opacity: taxonomyMuscleId ? 0.82 : 0.18,
      roughness,
      side: DoubleSide,
      forceSinglePass: true,
      transparent: true
    });
    node.renderOrder = 2;

    if (taxonomyMuscleId && binding) {
      node.userData.taxonomyMuscleId = taxonomyMuscleId;
      node.userData.coverage = binding.coverage;
      node.userData.displayMode = binding.displayMode;
      node.userData.pickable = binding.pickable;
    }
  });
}

function frameModel(object: Object3D) {
  const box = new Box3().setFromObject(object);
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());
  const scale = 4 / Math.max(size.x, size.y, size.z);
  object.scale.setScalar(scale);
  object.position.set(-center.x * scale, -center.y * scale + 0.05, -center.z * scale);
}
