import { z } from "zod";

export const themeIdSchema = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const surfaceColor = z.string().refine((value) => {
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return true;
  const match = value.match(
    /^rgba\(\s*(\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3}),\s*(0(?:\.\d+)?|1(?:\.0+)?)\s*\)$/
  );
  return !!match && match.slice(1, 4).every((channel) => Number(channel) <= 255);
}, "Expected a six-digit hex color or bounded rgba color");
const bounded = (min: number, max: number, fallback: number) =>
  z.number().finite().min(min).max(max).default(fallback);
const localPath = z
  .string()
  .max(200)
  .regex(/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_.-]+)*\.[a-zA-Z0-9]+$/)
  .refine((path) => !path.split("/").some((part) => part === "." || part === ".."));
export const themeTokenMap = {
  canvas: "background.canvas",
  surface: "background.surface",
  raised: "background.raised",
  text: "text.primary",
  muted: "text.muted",
  accent: "interaction.primary",
  "accent-mid": "interaction.primarySoft",
  "accent-muted": "interaction.primaryMuted",
  selection: "interaction.selection",
  "selection-mid": "interaction.selectionSoft",
  "selection-muted": "interaction.selectionMuted",
  warning: "status.warning",
  danger: "status.danger",
  success: "status.success",
  border: "border.default",
  "border-strong": "border.strong",
  glass: "surface.glass",
  "glass-raised": "surface.glassRaised",
  skin: "body.skin",
  unbound: "body.unbound",
  gray: "body.noData",
  blue: "load.low",
  orange: "load.moderate",
  red: "load.high",
  purple: "load.peak"
} as const;
export const themeTokensSchema = z
  .object({
    "background.canvas": color.default("#070912"),
    "background.surface": color.default("#111422"),
    "background.raised": color.default("#1b2032"),
    "text.primary": color.default("#f1f5ff"),
    "text.muted": color.default("#a4afc5"),
    "interaction.primary": color.default("#00e5ff"),
    "interaction.primarySoft": color.default("#57b8c3"),
    "interaction.primaryMuted": color.default("#789da2"),
    "interaction.selection": color.default("#ff477e"),
    "interaction.selectionSoft": color.default("#cb718c"),
    "interaction.selectionMuted": color.default("#aa8792"),
    "status.warning": color.default("#e5ad72"),
    "status.danger": color.default("#ff8e8e"),
    "status.success": color.default("#75d6af"),
    "border.default": surfaceColor.default("rgba(164, 175, 197, 0.16)"),
    "border.strong": surfaceColor.default("rgba(164, 175, 197, 0.32)"),
    "surface.glass": surfaceColor.default("rgba(12, 16, 28, 0.88)"),
    "surface.glassRaised": surfaceColor.default("rgba(22, 28, 44, 0.94)"),
    "body.skin": color.default("#415767"),
    "body.unbound": color.default("#364956"),
    "body.noData": color.default("#536878"),
    "load.low": color.default("#789da2"),
    "load.moderate": color.default("#57b8c3"),
    "load.high": color.default("#cb718c"),
    "load.peak": color.default("#ff477e")
  })
  .strict();
const fontPreset = z.enum(["system", "sans", "serif", "mono"]);
export const themePackageSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: themeIdSchema,
    name: z.string().trim().min(1).max(80),
    description: z.string().max(300).default(""),
    author: z.string().max(100).optional(),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    appearance: z.literal("dark"),
    tokens: themeTokensSchema.default({}),
    typography: z
      .object({
        body: fontPreset.default("system"),
        heading: fontPreset.default("system"),
        numeric: fontPreset.default("mono"),
        font: localPath.refine((path) => path.endsWith(".woff2"), "Font must be WOFF2").optional()
      })
      .strict()
      .default({}),
    material: z
      .object({
        blur: bounded(0, 24, 8),
        quietBlur: bounded(0, 24, 5),
        expandedBlur: bounded(0, 24, 8),
        radius: bounded(8, 24, 16),
        panelShadowOpacity: bounded(0, 0.6, 0.34),
        fillOpacity: bounded(0.2, 1, 0.48),
        quietFillOpacity: bounded(0.2, 1, 0.34),
        expandedFillOpacity: bounded(0.2, 1, 0.58),
        edgeOpacity: bounded(0, 0.6, 0.38),
        quietEdgeOpacity: bounded(0, 0.6, 0.22)
      })
      .strict()
      .default({}),
    effects: z
      .object({
        glow: z.boolean().default(true),
        edgeAnimation: z.boolean().default(true),
        duration: bounded(0, 500, 150)
      })
      .strict()
      .default({}),
    body: z
      .object({
        focusEmission: bounded(0, 1, 0.48),
        baseEmission: bounded(0, 0.3, 0.06),
        skinOpacity: bounded(0.05, 0.3, 0.12),
        hemisphereIntensity: bounded(0, 3, 0.9),
        keyLightIntensity: bounded(0, 3, 1.2),
        fillLightIntensity: bounded(0, 3, 0.55),
        roughness: bounded(0.2, 1, 0.68),
        metalness: bounded(0, 0.4, 0.04),
        loadColors: z
          .array(color)
          .length(7)
          .default(["#00e5ff", "#65c3d7", "#8aaabd", "#a292b1", "#bb7da5", "#dc6594", "#ff477e"])
      })
      .strict()
      .default({}),
    assets: z
      .object({
        preview: localPath
          .refine((path) => /\.(png|webp)$/.test(path), "Preview must be PNG or WebP")
          .optional()
      })
      .strict()
      .default({})
  })
  .strict();
export type ThemePackage = z.output<typeof themePackageSchema>;
export type ThemePackageInput = z.input<typeof themePackageSchema>;
export const resolvedThemeSchema = themePackageSchema.extend({
  source: z.enum(["builtin", "installed"]),
  assetUrls: z
    .object({
      preview: z
        .string()
        .regex(
          /^\/api\/themes\/[a-z][a-z0-9-]{0,63}\/assets\/[a-zA-Z0-9_./%-]+(?:\?v=[a-f0-9]{16})?$/
        )
        .optional(),
      font: z
        .string()
        .regex(
          /^\/api\/themes\/[a-z][a-z0-9-]{0,63}\/assets\/[a-zA-Z0-9_./%-]+(?:\?v=[a-f0-9]{16})?$/
        )
        .optional()
    })
    .strict()
});
export type ResolvedTheme = z.infer<typeof resolvedThemeSchema>;
export const themeCatalogSchema = z
  .object({
    ok: z.literal(true),
    themes: z.array(resolvedThemeSchema),
    diagnostics: z.array(z.object({ id: z.string().optional(), message: z.string() }).strict()),
    complete: z.boolean()
  })
  .strict();
export type ThemeCatalog = z.infer<typeof themeCatalogSchema>;
export function parseThemePackage(value: unknown): ThemePackage {
  return themePackageSchema.parse(value);
}
