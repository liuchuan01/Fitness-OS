import { RotateCcw, X, ScanLine } from "lucide-react";
import { IconButton } from "../../components/IconButton";
import { useTheme } from "../../design/theme";
import { BodyProjectionLegend } from "./BodyProjectionLegend";
import { BodyThemeEnvironment } from "./BodyThemeEnvironment";
import { muscleBackdropNames } from "./muscle-backdrop-names";
import { muscleLabels } from "../../../shared/muscle-taxonomy";
import { BodyMotion } from "./BodyMotion";
import { useBodyMotion } from "./useBodyMotion";
import { musclesInRegion, type BodyRegionId } from "../muscles/body-regions";
import "./body-viewer.css";
import { MusclePicker } from "../muscles/MusclePicker";
import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { FocusCameraRig } from "./FocusCameraRig";
import { BodyModelScene } from "./BodyModelScene";
import type { MuscleId } from "../../../shared/fitness/index";
import type { BodyViewer3DProps, Manifest, ModelContract, ModelMeta } from "./types";

const ASSET_ROOT = "/models/bodyparts3d";
const MANIFEST_URL = `${ASSET_ROOT}/bodyparts3d-fitness-taxonomy-manifest.json`;
const CONTRACT_URL = `${ASSET_ROOT}/body-model-contract.json`;

type SelectionDetail = {
  id: string;
  label: string;
  coverage: string;
};

function canUseWebGL() {
  if (typeof window === "undefined" || typeof window.WebGLRenderingContext === "undefined") {
    return false;
  }

  const canvas = document.createElement("canvas");
  return Boolean(canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl"));
}

export function BodyViewer3D({
  muscles,
  selectedMuscle,
  onMuscleSelect,
  exerciseTargets,
  exerciseName,
  onResetFocus,
  projectionLabel,
  onExplorationChange
}: BodyViewer3DProps) {
  const { theme, glowEnabled } = useTheme();
  const { palette } = theme;
  const [exploring, setExploring] = useState(false);
  const [region, setRegion] = useState<BodyRegionId | null>(null);
  const motion = useBodyMotion();
  const onExplore = useCallback(
    (open: boolean, nextRegion: BodyRegionId | null) => {
      setExploring(open);
      setRegion(nextRegion);
      onExplorationChange?.(open);
    },
    [onExplorationChange]
  );
  const regionMuscles = useMemo(() => (region ? musclesInRegion(region) : []), [region]);
  const onReady = useCallback(() => setModelReady(true), []);
  const [meta, setMeta] = useState<ModelMeta | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<MuscleId | null>(null);
  const selected = useMemo(() => new Set(selectedMuscle ? [selectedMuscle] : []), [selectedMuscle]);
  const [resetToken, setResetToken] = useState(0);
  const [webglReady] = useState(canUseWebGL);
  const [modelReady, setModelReady] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [professionalMode, setProfessionalMode] = useState(false);
  const rotating =
    modelReady &&
    motion.visible &&
    !motion.dragging &&
    !exploring &&
    !selectedMuscle &&
    !exerciseTargets &&
    !transitioning;
  const externallySelected = useMemo(
    () =>
      new Set([
        ...(exerciseTargets?.primaryMuscles ?? []),
        ...(exerciseTargets?.secondaryMuscles ?? [])
      ]),
    [exerciseTargets]
  );
  const selectedCount = useMemo(
    () => new Set([...selected, ...externallySelected]).size,
    [externallySelected, selected]
  );

  useEffect(() => {
    if (!webglReady) return;

    let cancelled = false;

    Promise.all([
      fetch(MANIFEST_URL).then((response) => {
        if (!response.ok) throw new Error(`Manifest failed: ${response.status}`);
        return response.json() as Promise<Manifest>;
      }),
      fetch(CONTRACT_URL).then((response) => {
        if (!response.ok) throw new Error(`Contract failed: ${response.status}`);
        return response.json() as Promise<ModelContract>;
      })
    ])
      .then(([manifest, contract]) => {
        if (!cancelled) setMeta({ manifest, contract });
      })
      .catch((error) => {
        if (!cancelled) {
          setMetaError(error instanceof Error ? error.message : "3D metadata failed to load");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [webglReady]);

  const selectedDetails = useMemo<SelectionDetail[]>(() => {
    if (!meta) return [];

    const exactSelections = [...selected].map((muscleId) => {
      return {
        id: muscleId,
        label: meta.contract.muscles[muscleId]?.label_zh ?? muscleId,
        coverage: meta.contract.muscles[muscleId]?.coverage ?? "missing"
      };
    });
    const externalSelections = muscles
      .filter((muscle) => externallySelected.has(muscle.muscleId))
      .map((muscle) => ({
        id: muscle.muscleId,
        label: muscle.labelZh,
        coverage: meta.contract.muscles[muscle.muscleId]?.coverage ?? "missing"
      }));
    return [...exactSelections, ...externalSelections].filter(
      (detail, index, details) =>
        details.findIndex((candidate) => candidate.id === detail.id) === index
    );
  }, [meta, muscles, selected, externallySelected]);

  if (!webglReady) {
    return (
      <div className="body-3d-fallback" role="status">
        <p>3D 暂不可用，仍可选择部位查看训练档案。</p>
        <MusclePicker value={selectedMuscle} onChange={onMuscleSelect} onExplore={onExplore} />
      </div>
    );
  }

  if (metaError) {
    return (
      <div className="body-3d-fallback error" role="alert">
        <p>身体模型暂时无法加载。</p>
        <MusclePicker value={selectedMuscle} onChange={onMuscleSelect} onExplore={onExplore} />
      </div>
    );
  }

  return (
    <div
      className={`body-3d-shell ${exploring ? "explorer-open" : ""}`}
      data-motion={rotating ? "rotating" : "paused"}
      data-body-theme={theme.id}
      data-focus-motion={transitioning ? "moving" : "idle"}
    >
      <div className="body-3d-toolbar" aria-label="3D body controls">
        <MusclePicker value={selectedMuscle} onChange={onMuscleSelect} onExplore={onExplore} />
        <IconButton
          label="重置视角"
          icon={RotateCcw}
          onClick={() => {
            onResetFocus?.();
            setResetToken((value) => value + 1);
          }}
        />
        {(selected.size > 0 || exerciseTargets) && (
          <IconButton
            label="清除选择"
            icon={X}
            onClick={() => (onResetFocus ? onResetFocus() : onMuscleSelect(null))}
          />
        )}
        <IconButton
          label={professionalMode ? "普通模式" : "专业模式"}
          icon={ScanLine}
          aria-pressed={professionalMode}
          onClick={() => setProfessionalMode((value) => !value)}
        />
      </div>

      <Canvas
        frameloop="demand"
        onPointerMissed={(event) => {
          if (event.type === "click") {
            if (selectedMuscle) onMuscleSelect(null);
            else onResetFocus?.();
          }
        }}
        aria-label="Interactive 3D body"
        className="body-3d-canvas"
        camera={{ position: [0, 0.25, 7.2], fov: 35, near: 0.1, far: 100 }}
        dpr={[1, 1.25]}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
      >
        <BodyThemeEnvironment
          theme={theme}
          backdrop={
            (selectedMuscle || exerciseName) && modelReady
              ? {
                  label: exerciseName ?? muscleLabels[selectedMuscle!],
                  anatomicalName: exerciseName
                    ? "MOVEMENT STUDY"
                    : muscleBackdropNames[selectedMuscle!]
                }
              : null
          }
        />
        <BodyMotion enabled={rotating} reducedMotion={motion.reducedMotion} resetToken={resetToken}>
          <Suspense fallback={null}>
            {meta ? (
              <BodyModelScene
                palette={palette}
                loadColors={theme.body.loadColors}
                secondaryColor={palette["selection-mid"]}
                baseEmission={theme.body.baseEmission}
                skinOpacity={theme.body.skinOpacity}
                roughness={theme.body.roughness}
                metalness={theme.body.metalness}
                focusEmission={glowEnabled ? theme.body.focusEmission : 0}
                hovered={hovered}
                contract={meta.contract}
                muscles={muscles}
                professionalMode={professionalMode}
                selected={selected}
                onHover={setHovered}
                onReady={onReady}
                regionMuscles={regionMuscles}
                onSelect={onMuscleSelect}
                exerciseTargets={exerciseTargets}
              />
            ) : null}
          </Suspense>
        </BodyMotion>
        <FocusCameraRig
          selected={selectedMuscle}
          exerciseTargets={exerciseTargets}
          ready={modelReady}
          reducedMotion={motion.reducedMotion}
          resetToken={resetToken}
          onTransition={setTransitioning}
        />
        <OrbitControls
          enableDamping
          onStart={() => motion.setDragging(true)}
          onEnd={() => motion.setDragging(false)}
          makeDefault
          maxDistance={10}
          minDistance={3.4}
          target={[0, 0.1, 0]}
        />
      </Canvas>

      <div className="body-3d-hud" aria-label="3D model status">
        <span className="technical-status">
          {meta
            ? `${Object.keys(meta.manifest.targets).length} muscles / ${modelReady ? "Model ready" : "Loading GLB"}`
            : "Loading model"}
        </span>
        <span>
          {hovered
            ? (meta?.contract.muscles[hovered]?.label_zh ?? hovered)
            : selectedCount > 0
              ? `已聚焦 ${selectedCount} 个肌肉区域`
              : "拖动旋转 · 滚轮缩放"}
        </span>
      </div>

      <BodyProjectionLegend
        exerciseTargets={!!exerciseTargets}
        selectedMuscle={!!selectedMuscle}
        region={!!region}
        projectionLabel={projectionLabel}
        loadColors={theme.body.loadColors}
        selectedDetails={selectedDetails}
        professionalMode={professionalMode}
      />
    </div>
  );
}
