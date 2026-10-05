import { getThemes } from "../api/themes";
import { readAppearance } from "./appearance";
import { appThemes, prepareTheme, type ThemeDefinition } from "./theme-definitions";

let initialTheme: ThemeDefinition | undefined;
export function getInitialTheme() {
  return (
    initialTheme ??
    Object.values(appThemes).find((theme) => theme.id === readAppearance().themeId) ??
    appThemes.neon
  );
}

/** Resolve an installed preference before mounting, with a bounded startup delay. */
export async function initializeTheme() {
  const id = readAppearance().themeId;
  if (Object.values(appThemes).some((theme) => theme.id === id)) return;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      getThemes(controller.signal).then(async (catalog) => {
        const selected = catalog.themes.find((theme) => theme.id === id);
        return selected ? (await prepareTheme(selected)).theme : undefined;
      }),
      new Promise<undefined>((resolve) => {
        timer = setTimeout(() => resolve(undefined), 1200);
      })
    ]);
    initialTheme = result;
  } catch {
    // ThemeProvider owns retry and diagnostics; startup remains available offline.
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
