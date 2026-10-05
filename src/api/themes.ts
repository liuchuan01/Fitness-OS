import { z } from "zod";
import { themeCatalogSchema } from "../../shared/themes/schema";
import { resolveTheme } from "../design/theme-definitions";
import { getJson } from "./http";

export async function getThemes(signal?: AbortSignal) {
  const catalog = themeCatalogSchema.parse(await getJson("/api/themes", z.unknown(), { signal }));
  return {
    themes: catalog.themes.map(resolveTheme),
    diagnostics: catalog.diagnostics.map((item) =>
      item.id ? `${item.id}：${item.message}` : item.message
    ),
    complete: catalog.complete
  };
}
