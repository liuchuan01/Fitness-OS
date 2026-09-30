import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { CanvasTexture, Color, LinearFilter, Vector4 } from "three";

const vertexShader = `
  varying vec2 vUv;
  uniform vec4 bounds;
  void main() {
    vUv = uv;
    // Screen-aligned typography behind the model, independent of orbit and zoom.
    gl_Position = vec4(bounds.xy + position.xy * bounds.zw, 0.9999, 1.0);
  }
`;
const fragmentShader = `
  varying vec2 vUv;
  uniform sampler2D lettering;
  uniform vec3 ink;
  void main() {
    float alpha = texture2D(lettering, vUv).a * 0.18;
    if (alpha < 0.001) discard;
    gl_FragColor = vec4(ink, alpha);
    #include <colorspace_fragment>
  }
`;

type MuscleBackdropProps = { label: string; color: string };

/** Decorative only: the complete accessible name lives in the canvas title and history panel. */
export function MuscleBackdrop({ label, color }: MuscleBackdropProps) {
  const { size, invalidate } = useThree();
  const lettering = useMemo(() => {
    if (size.width < 700 || window.innerWidth <= 1100) return null;
    const fontSize = Math.min(180, Math.max(80, size.width * 0.105), size.height * 0.18);
    const left = 42;
    const height = Math.ceil(fontSize * 1.5);
    const width = Math.ceil(Math.min(label.length * fontSize + 8, size.width * 0.66 - left));
    const canvas = document.createElement("canvas");
    // A bounded texture, regenerated only for selection or viewport changes; no per-frame work.
    canvas.width = width * 2;
    canvas.height = height * 2;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.scale(2, 2);
    context.font = `600 ${fontSize}px ${getComputedStyle(document.documentElement).fontFamily}`;
    context.fillStyle = color;
    context.textBaseline = "middle";
    context.fillText(label, 0, height / 2);
    const texture = new CanvasTexture(canvas);
    texture.minFilter = LinearFilter;
    texture.generateMipmaps = false;
    return {
      texture,
      bounds: new Vector4(
        (2 * left + width) / size.width - 1,
        1 - 2 * 0.48,
        width / size.width,
        height / size.height
      )
    };
  }, [label, color, size.width, size.height]);
  const uniforms = useMemo(
    () =>
      lettering
        ? {
            lettering: { value: lettering.texture },
            bounds: { value: lettering.bounds },
            ink: { value: new Color(color) }
          }
        : null,
    [lettering, color]
  );
  useEffect(() => {
    invalidate();
    return () => lettering?.texture.dispose();
  }, [lettering, invalidate]);
  if (!uniforms) return null;
  return (
    <mesh name="muscle-backdrop" frustumCulled={false} renderOrder={0} raycast={() => {}}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        key={lettering?.texture.uuid}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthTest
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
