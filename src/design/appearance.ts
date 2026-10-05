import { z } from "zod";

export const appearanceKey = "fitness:appearance:v2";
export const legacyAppearanceKey = "fitness:appearance:v1";
export type Appearance = { themeId: string; glowEnabled: boolean };
export const defaultAppearance: Appearance = { themeId: "neon", glowEnabled: true };
const storedAppearance = z
  .object({
    themeId: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
    glowEnabled: z.boolean().optional()
  })
  .strict();

export function parseAppearance(raw: string | null): Appearance {
  try {
    const result = storedAppearance.safeParse(JSON.parse(raw ?? "null"));
    if (result.success) return { themeId: result.data.themeId, glowEnabled: true };
  } catch {
    // Invalid stored preferences fall back atomically.
  }
  return defaultAppearance;
}
export function readAppearance(): Appearance {
  try {
    return parseAppearance(
      localStorage.getItem(appearanceKey) ?? localStorage.getItem(legacyAppearanceKey)
    );
  } catch {
    return defaultAppearance;
  }
}
export function saveAppearance(themeId: string) {
  try {
    localStorage.setItem(appearanceKey, JSON.stringify({ themeId, glowEnabled: true }));
  } catch {
    // Current-session appearance remains usable when persistence is unavailable.
  }
}
