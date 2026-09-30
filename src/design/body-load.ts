import type tokens from "./tokens.json";
import type { MuscleVisualState } from "../../shared/fitness/index";
import { sampleGradient } from "./color-scale";

export function bodyLoadColor(
  muscle: Pick<MuscleVisualState, "intensity" | "status">,
  palette: typeof tokens,
  colors?: readonly string[]
) {
  if (!colors) return palette[muscle.status];
  if (!Number.isFinite(muscle.intensity) || muscle.intensity <= 0) return palette.gray;
  return sampleGradient(colors, muscle.intensity);
}
