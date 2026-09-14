import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type ReactNode } from "react";
import type { Group } from "three";

type BodyMotionProps = {
  enabled: boolean;
  reducedMotion: boolean;
  resetToken: number;
  children: ReactNode;
};

export function BodyMotion({ enabled, reducedMotion, resetToken, children }: BodyMotionProps) {
  const root = useRef<Group>(null);
  const lastFrame = useRef<number | null>(null);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    lastFrame.current = null;
    if (!enabled) return;
    // Schedule independently of rendered frames so idle demand canvases always restart.
    invalidate();
    const timer = setInterval(invalidate, 1000 / 24);
    return () => clearInterval(timer);
  }, [enabled, invalidate]);
  useEffect(() => {
    if (root.current) root.current.rotation.y = 0;
    invalidate();
  }, [resetToken, invalidate]);
  useFrame(() => {
    if (!enabled || !root.current) return;
    const now = performance.now();
    const delta = lastFrame.current === null ? 0 : Math.min((now - lastFrame.current) / 1000, 0.15);
    lastFrame.current = now;
    root.current.rotation.y += delta * (reducedMotion ? 0.08 : 0.18);
  });
  return <group ref={root}>{children}</group>;
}
