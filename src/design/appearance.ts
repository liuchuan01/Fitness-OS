import { z } from "zod";
import { themeIds, type ThemeId } from "./theme-definitions";

export const appearanceKey = "fitness:appearance:v1";
export type Appearance = { themeId: ThemeId; glowEnabled: boolean };
export const defaultAppearance: Appearance = { themeId: "neon", glowEnabled: true };

export function parseAppearance(raw: string | null): Appearance {
  try {
    const result = z
      .object({
        themeId: z.enum(themeIds),
        glowEnabled: z.boolean()
      })
      .strict()
      .safeParse(JSON.parse(raw ?? "null"));
    if (result.success) return { ...result.data, glowEnabled: true };
  } catch {
    /* Invalid stored preferences fall back atomically. */
  }
  return defaultAppearance;
}
export function readAppearance(): Appearance {
  try {
    return parseAppearance(localStorage.getItem(appearanceKey));
  } catch {
    return defaultAppearance;
  }
}
export function applyAppearance(value: Appearance) {
  document.documentElement.dataset.theme = value.themeId;
  document.documentElement.dataset.glow = value.glowEnabled ? "on" : "off";
  document.documentElement.style.colorScheme = "dark";
}
