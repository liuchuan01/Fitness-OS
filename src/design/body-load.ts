import type { ThemeDefinition } from "./theme-definitions";
import type { MuscleVisualState } from "../../shared/fitness/index";
import { sampleGradient } from "./color-scale";

export function bodyLoadColor(
  muscle: Pick<MuscleVisualState, "intensity" | "status">,
  palette: ThemeDefinition["palette"],
  colors?: readonly string[]
) {
  if (!colors) return palette[muscle.status];
  if (!Number.isFinite(muscle.intensity) || muscle.intensity <= 0) return palette.gray;
  return sampleGradient(colors, muscle.intensity);
}
