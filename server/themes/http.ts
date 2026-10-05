import type { ServerResponse } from "node:http";
import { join } from "node:path";
import { writeJson } from "../http/json.js";
import { readThemeAsset, readThemeCatalog, type ThemeRoots } from "./catalog.js";

export async function serveThemes(url: URL, response: ServerResponse, roots: ThemeRoots) {
  if (url.pathname !== "/api/themes" && !url.pathname.startsWith("/api/themes/")) return false;
  response.setHeader("Cache-Control", "no-store");
  const catalog = await readThemeCatalog(roots);
  if (url.pathname === "/api/themes") {
    writeJson(response, 200, catalog);
    return true;
  }
  try {
    const match = url.pathname.match(/^\/api\/themes\/([^/]+)\/assets\/(.+)$/);
    if (!match) throw new Error("资源不存在");
    const theme = catalog.themes.find((entry) => entry.id === match[1]);
    const path = decodeURIComponent(match[2]);
    if (!theme || ![theme.assets.preview, theme.typography.font].includes(path))
      throw new Error("资源未声明");
    const asset = await readThemeAsset(
      join(theme.source === "builtin" ? roots.builtin : roots.installed, theme.id),
      path
    );
    response.setHeader("Content-Type", asset.type);
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.writeHead(200);
    response.end(asset.data);
  } catch {
    writeJson(response, 404, { ok: false, error: "主题资源不可用" });
  }
  return true;
}
