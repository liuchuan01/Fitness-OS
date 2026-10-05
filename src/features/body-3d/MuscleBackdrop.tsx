import { focusComposition } from "../../design/focus-transition";
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
    float alpha = texture2D(lettering, vUv).a * 0.16;
    if (alpha < 0.001) discard;
    gl_FragColor = vec4(ink, alpha);
    #include <colorspace_fragment>
  }
`;

type MuscleBackdropProps = {
  label: string;
  anatomicalName: string;
  color: string;
  fontFamily: string;
};

/** Decorative only: the complete accessible name lives in the canvas title and history panel. */
export function MuscleBackdrop({ label, anatomicalName, color, fontFamily }: MuscleBackdropProps) {
  const { size, invalidate } = useThree();
  const lettering = useMemo(() => {
    if (!focusComposition(size.width, size.height, window.innerWidth).enabled) return null;
    const fontSize = Math.min(148, Math.max(66, size.width * 0.086), size.height * 0.148);
    const left = 42;
    const height = Math.ceil(fontSize * 3.7);
    const width = Math.ceil(size.width * 0.66 - left);
    const canvas = document.createElement("canvas");
    // A bounded texture, regenerated only for selection or viewport changes; no per-frame work.
    canvas.width = width * 2;
    canvas.height = height * 2;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.scale(2, 2);
    context.font = `600 ${fontSize}px ${fontFamily}`;
    context.fillStyle = color;
    context.textBaseline = "alphabetic";
    const available = width - fontSize * 0.65;
    const lines = (text: string, limit: number, words: boolean) => {
      const result: string[] = [];
      let line = "";
      for (const part of words ? text.split(/\s+/) : [...text]) {
        const next = line ? `${line}${words ? " " : ""}${part}` : part;
        if (line && context.measureText(next).width > limit) {
          result.push(line);
          line = part;
        } else line = next;
      }
      if (line) result.push(line);
      return result;
    };
    let baseline = fontSize * 0.9;
    const title = label.split(" / ")[0];
    const titleLines = [...title].length <= 10 ? [title] : lines(title, available, false);
    for (const line of titleLines) {
      context.fillText(line, 0, baseline, available);
      baseline += fontSize * 1.02;
    }
    const secondarySize = fontSize * 0.62;
    context.font = `600 ${secondarySize}px "Arial Narrow", "Liberation Sans Narrow", "Helvetica Neue", sans-serif`;
    context.globalAlpha = 0.7;
    const indent = fontSize * 0.45;
    const secondaryWidth = available - indent;
    baseline -= fontSize * 0.43;
    const secondaryLines = anatomicalName
      .split(" · ")
      .flatMap((part) => lines(part, secondaryWidth, true));
    for (const line of secondaryLines) {
      context.fillText(line, indent, baseline, secondaryWidth);
      baseline += secondarySize * 1.02;
    }
    // Let long names recede into the body instead of ending on a hard rectangular edge.
    context.globalAlpha = 1;
    context.globalCompositeOperation = "destination-in";
    const edge = context.createLinearGradient(width - fontSize * 0.8, 0, width, 0);
    edge.addColorStop(0, color);
    edge.addColorStop(1, "transparent");
    context.fillStyle = edge;
    context.fillRect(0, 0, width, height);
    const texture = new CanvasTexture(canvas);
    texture.minFilter = LinearFilter;
    texture.generateMipmaps = false;
    return {
      texture,
      bounds: new Vector4(
        (2 * left + width) / size.width - 1,
        1 - 2 * (0.48 + (height - fontSize * 1.7) / 2 / size.height),
        width / size.width,
        height / size.height
      )
    };
  }, [label, anatomicalName, color, fontFamily, size.width, size.height]);
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
