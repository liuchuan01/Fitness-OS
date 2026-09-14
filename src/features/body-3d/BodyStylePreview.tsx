import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense, useEffect, useState } from "react";
import { BodyModelScene } from "./BodyModelScene";
import type { ModelContract } from "./types";
import type palette from "../../design/tokens.json";
import type { MuscleId } from "../../../shared/fitness/index";

type PreviewProps = {
  colors: typeof palette;
  emission: number;
  mode: "exercise" | "focus";
};
const noMuscles: never[] = [];
const selected = new Set<MuscleId>(["pec_major_upper", "pec_major_mid", "pec_major_lower"]);
const empty = new Set<MuscleId>();
const ignore = () => {};

export default function BodyStylePreview({ colors, emission, mode }: PreviewProps) {
  const [contract, setContract] = useState<ModelContract>();
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/models/bodyparts3d/body-model-contract.json", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Model metadata");
        return response.json();
      })
      .then(setContract)
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, []);
  if (error) return <p role="alert">模型暂不可用；仍可比较下方配色与控件样板。</p>;
  return (
    <>
      <span className="lab-model-status" role="status">
        {ready ? "真实 GLB · 拖动比较材质" : "正在加载人体材质样板…"}
      </span>
      <Canvas
        frameloop="demand"
        camera={{ position: [0, 0.1, 7.5], fov: 35 }}
        dpr={[1, 1.25]}
        aria-label="主题材质样板"
      >
        <hemisphereLight args={["#ffffff", "#101523", 0.9]} />
        <directionalLight position={[3, 4, 4]} intensity={1.2} />
        <Suspense fallback={null}>
          {contract && (
            <BodyModelScene
              contract={contract}
              palette={colors}
              focusEmission={emission}
              regionMuscles={noMuscles}
              muscles={noMuscles}
              selected={mode === "focus" ? selected : empty}
              hovered={null}
              professionalMode={false}
              onHover={ignore}
              onReady={() => setReady(true)}
              onSelect={ignore}
              exerciseTargets={
                mode === "exercise"
                  ? {
                      primaryMuscles: ["pec_major_upper", "pec_major_mid", "pec_major_lower"],
                      secondaryMuscles: ["deltoid_anterior", "triceps_long_head"]
                    }
                  : null
              }
            />
          )}
        </Suspense>
        <OrbitControls enablePan={false} minDistance={6} maxDistance={10} />
      </Canvas>
    </>
  );
}
