import { focusComposition, focusTransitionTiming, publishFocusFrame } from "../../design/focus-transition";
import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import { Box3, MathUtils, Mesh, PerspectiveCamera, Vector3 } from "three";
import type { BodyViewer3DProps } from "./types";
import type { MuscleId } from "../../../shared/muscle-taxonomy";

type Controls = {
  target: Vector3;
  update: () => void;
  enableDamping: boolean;
  addEventListener: (event: "start", listener: () => void) => void;
  removeEventListener: (event: "start", listener: () => void) => void;
};
type Pose = { target: Vector3; offset: Vector3 };
type Transition = {
  id: number;
  from: Pose;
  to: Pose;
  elapsed: number;
  lastFrame: number | null;
  duration: number;
  zoomDelay: number;
  focusing: boolean;
};
type FocusCameraRigProps = {
  selected: MuscleId | null;
  exerciseTargets?: BodyViewer3DProps["exerciseTargets"];
  ready: boolean;
  reducedMotion: boolean;
  resetToken: number;
  onTransition: (moving: boolean) => void;
};
const ease = (value: number) => {
  const t = MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

export function FocusCameraRig({
  selected,
  exerciseTargets,
  ready,
  reducedMotion,
  resetToken,
  onTransition
}: FocusCameraRigProps) {
  const { camera, controls: rawControls, scene, size, invalidate, gl } = useThree();
  const controls = rawControls as unknown as Controls | undefined;
  const home = useRef<Pose | null>(null);
  const sequence = useRef(0);
  const animation = useRef<Transition | null>(null);
  const initialized = useRef(false);
  const lastReset = useRef(resetToken);
  const lastCompact = useRef(size.width < 700);
  const damping = useRef(true);
  const { enabled: desktop, zoom: focusZoom, shift: focusShift } = focusComposition(size.width, size.height, window.innerWidth);

  useLayoutEffect(() => {
    if (!controls || !(camera instanceof PerspectiveCamera)) return;
    const pose = (): Pose => ({
      target: controls.target.clone(),
      offset: camera.position.clone().sub(controls.target)
    });
    const apply = (value: Pose) => {
      controls.target.copy(value.target);
      camera.position.copy(value.target).add(value.offset);
      controls.update();
      invalidate();
    };
    const reset = lastReset.current !== resetToken;
    lastReset.current = resetToken;
    const compactChanged = lastCompact.current !== size.width < 700;
    lastCompact.current = size.width < 700;
    if (!initialized.current || reset || compactChanged) {
      const target = new Vector3(0, size.width < 700 && size.height > 500 ? -0.45 : 0.1, 0);
      const baseline = { target, offset: new Vector3(0, 0.15, size.width < 700 ? 10 : 7.8) };
      if (!initialized.current) apply(baseline);
      home.current = baseline;
      initialized.current = true;
    }
    if (!ready) return;
    if (!home.current) home.current = pose();
    const focusing = Boolean((selected || exerciseTargets) && desktop);
    const base = home.current;
    const destination = { target: base.target.clone(), offset: base.offset.clone() };
    if (focusing) {
      scene.updateMatrixWorld(true);
      const bounds = new Box3();
      scene.traverse((node) => {
        if (
          node instanceof Mesh &&
          (selected
            ? node.userData.taxonomyMuscleId === selected
            : exerciseTargets?.primaryMuscles.includes(node.userData.taxonomyMuscleId)) &&
          !node.name.endsWith(".depth")
        ) {
          bounds.expandByObject(node);
        }
      });
      const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      const center = bounds.isEmpty() ? base.target.clone() : bounds.getCenter(new Vector3());
      const relative = center.sub(base.target);
      destination.offset.multiplyScalar(1 / focusZoom);
      const viewHeight =
        2 * Math.tan(MathUtils.degToRad(camera.fov / 2)) * destination.offset.length();
      destination.target.addScaledVector(
        right,
        viewHeight * camera.aspect * focusShift + relative.dot(right) * 0.35
      );
      destination.target.addScaledVector(up, MathUtils.clamp(relative.dot(up) * 0.45, -0.55, 0.55));
    }
    if (!animation.current) damping.current = controls.enableDamping;
    controls.enableDamping = false;
    const from = pose();
    if (
      !focusing &&
      !animation.current &&
      from.target.distanceTo(destination.target) < 0.001 &&
      from.offset.distanceTo(destination.offset) < 0.001
    ) {
      apply(destination);
      publishFocusFrame(gl.domElement, { id: ++sequence.current, focusing, progress: 1 });
      controls.enableDamping = damping.current;
      animation.current = null;
      if (!focusing) home.current = null;
      onTransition(false);
      return;
    }
    animation.current = {
      id: ++sequence.current,
      from,
      to: destination,
      elapsed: 0,
      lastFrame: null,
      ...focusTransitionTiming(focusing, reducedMotion),
      focusing
    };
    publishFocusFrame(gl.domElement, { id: sequence.current, focusing, progress: 0 });
    onTransition(true);
    invalidate();
  }, [
    camera,
    controls,
    desktop,
    focusZoom,
    focusShift,
    ready,
    reducedMotion,
    resetToken,
    selected,
    exerciseTargets,
    size.width,
    size.height,
    scene,
    invalidate,
    onTransition,
    gl
  ]);

  useLayoutEffect(() => {
    if (!controls) return;
    const interrupt = () => {
      if (animation.current)
        publishFocusFrame(gl.domElement, {
          id: animation.current.id,
          focusing: animation.current.focusing,
          progress: 1
        });
      if (animation.current && !animation.current.focusing) home.current = null;
      animation.current = null;
      controls.enableDamping = damping.current;
      onTransition(false);
    };
    controls.addEventListener("start", interrupt);
    return () => {
      controls.removeEventListener("start", interrupt);
      controls.enableDamping = damping.current;
    };
  }, [controls, onTransition, gl]);

  useFrame(() => {
    const current = animation.current;
    if (!current || !controls) return;
    const now = performance.now();
    // Count visible steps: shader compilation or a background tab must not skip the transition.
    current.elapsed += current.lastFrame === null ? 0 : Math.min(now - current.lastFrame, 120);
    current.lastFrame = now;
    const elapsed = current.elapsed;
    const move = ease(elapsed / current.duration);
    const zoom = ease((elapsed - current.zoomDelay) / (current.duration - current.zoomDelay));
    controls.target.lerpVectors(current.from.target, current.to.target, move);
    camera.position.lerpVectors(current.from.offset, current.to.offset, zoom).add(controls.target);
    controls.update();
    publishFocusFrame(gl.domElement, {
      id: current.id,
      focusing: current.focusing,
      progress: move
    });
    if (elapsed >= current.duration) {
      animation.current = null;
      controls.enableDamping = damping.current;
      if (!current.focusing) home.current = null;
      onTransition(false);
    }
    invalidate();
  });
  return null;
}
