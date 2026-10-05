import type { ThemeDefinition } from "../../design/theme-definitions";
import { MuscleBackdrop } from "./MuscleBackdrop";

type BodyThemeEnvironmentProps = {
  theme: ThemeDefinition;
  backdrop: { label: string; anatomicalName: string } | null;
};

export function BodyThemeEnvironment({ theme, backdrop }: BodyThemeEnvironmentProps) {
  const { palette, body } = theme;
  return (
    <>
      {backdrop && (
        <MuscleBackdrop
          {...backdrop}
          color={palette.muted}
          fontFamily={theme.cssVariables["--font-body"]}
        />
      )}
      <hemisphereLight args={[palette.text, palette.canvas, body.hemisphereIntensity]} />
      <directionalLight
        position={[3, 5, 4]}
        color={palette.text}
        intensity={body.keyLightIntensity}
      />
      <directionalLight
        position={[-3, 1, -2]}
        color={palette["accent-mid"]}
        intensity={body.fillLightIntensity}
      />
    </>
  );
}
