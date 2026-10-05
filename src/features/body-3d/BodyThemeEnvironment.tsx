import type { ThemeDefinition } from "../../design/theme-definitions";
import { MuscleBackdrop } from "./MuscleBackdrop";

type BodyThemeEnvironmentProps = {
  theme: ThemeDefinition;
  backdrop: { label: string; anatomicalName: string } | null;
};

export function BodyThemeEnvironment({ theme, backdrop }: BodyThemeEnvironmentProps) {
  const { palette, body } = theme;
  const lightColor =
    body.lightColor ?? (theme.appearance === "light" ? palette.raised : palette.text);
  return (
    <>
      {backdrop && (
        <MuscleBackdrop
          {...backdrop}
          color={palette.muted}
          fontFamily={theme.cssVariables["--font-body"]}
        />
      )}
      <hemisphereLight args={[lightColor, palette.canvas, body.hemisphereIntensity]} />
      <directionalLight
        position={[3, 5, 4]}
        color={lightColor}
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
