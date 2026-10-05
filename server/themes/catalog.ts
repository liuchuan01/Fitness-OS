import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, readdir } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { builtinThemeIds } from "../../shared/themes/builtins.js";
import {
  parseThemePackage,
  type ResolvedTheme,
  type ThemeCatalog
} from "../../shared/themes/schema.js";

export type ThemeRoots = { builtin: string; installed: string };
const maximumManifestBytes = 64 * 1024;
const maximumAssetBytes = 5 * 1024 * 1024;
const isMissing = (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT";
const message = (error: unknown) => (error instanceof Error ? error.message : "无法读取主题包");

/** Reject symlinks in every package-relative component, including the theme root. */
async function readPackageFile(root: string, relative: string, maximum: number) {
  const segments = relative.split("/");
  if (segments.some((part) => !part || part === "." || part === ".." || part.includes("\\")))
    throw new Error("主题资源路径非法");
  const absoluteRoot = resolve(root);
  const target = resolve(root, ...segments);
  if (!target.startsWith(absoluteRoot + sep)) throw new Error("主题资源越界");
  let current = absoluteRoot;
  const rootInfo = await lstat(current);
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory())
    throw new Error("主题目录不能是符号链接");
  for (const segment of segments) {
    current = join(current, segment);
    const info = await lstat(current);
    if (info.isSymbolicLink()) throw new Error("主题资源不能是符号链接");
    if (current === target ? !info.isFile() : !info.isDirectory())
      throw new Error("主题文件类型不符合限制");
  }
  // A file can be replaced after lstat; a FIFO must never block the I/O pool.
  const file = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const info = await file.stat();
    if (!info.isFile() || info.size > maximum) throw new Error("主题文件类型或大小不符合限制");
    const buffer = Buffer.alloc(info.size + 1);
    let bytesRead = 0;
    while (bytesRead < buffer.length) {
      const result = await file.read(buffer, bytesRead, buffer.length - bytesRead, bytesRead);
      if (result.bytesRead === 0) break;
      bytesRead += result.bytesRead;
    }
    if (bytesRead > maximum || bytesRead > info.size) throw new Error("主题文件在读取时发生变化");
    return buffer.subarray(0, bytesRead);
  } finally {
    await file.close();
  }
}

export async function readThemeAsset(root: string, path: string) {
  const data = await readPackageFile(root, path, maximumAssetBytes);
  const type = path.endsWith(".woff2")
    ? "font/woff2"
    : path.endsWith(".png")
      ? "image/png"
      : "image/webp";
  const valid =
    type === "font/woff2"
      ? data.subarray(0, 4).toString() === "wOF2"
      : type === "image/png"
        ? data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : data.subarray(0, 4).toString() === "RIFF" && data.subarray(8, 12).toString() === "WEBP";
  if (!valid) throw new Error("主题资源格式与扩展名不一致");
  return { data, type };
}

export async function validateThemeDirectory(
  root: string
): Promise<{ theme: ResolvedTheme; diagnostics: ThemeCatalog["diagnostics"] }> {
  const input: unknown = JSON.parse(
    (await readPackageFile(root, "theme.json", maximumManifestBytes)).toString("utf8")
  );
  const theme: ResolvedTheme = { ...parseThemePackage(input), source: "installed", assetUrls: {} };
  const diagnostics: ThemeCatalog["diagnostics"] = [];
  for (const [slot, path] of [
    ["preview", theme.assets.preview],
    ["font", theme.typography.font]
  ] as const) {
    if (!path) continue;
    try {
      const asset = await readThemeAsset(root, path);
      const revision = createHash("sha256").update(asset.data).digest("hex").slice(0, 16);
      theme.assetUrls[slot] =
        `/api/themes/${theme.id}/assets/${path.split("/").map(encodeURIComponent).join("/")}?v=${revision}`;
    } catch (error) {
      diagnostics.push({
        id: theme.id,
        message: `${slot} 资源不可用，使用默认展示：${message(error)}`
      });
    }
  }
  return { theme, diagnostics };
}

export async function readThemeCatalog(roots: ThemeRoots): Promise<ThemeCatalog> {
  const catalog: ThemeCatalog = { ok: true, themes: [], diagnostics: [], complete: true };
  for (const [source, root] of [
    ["builtin", roots.builtin],
    ["installed", roots.installed]
  ] as const) {
    let directories;
    try {
      const info = await lstat(root);
      if (info.isSymbolicLink() || !info.isDirectory()) throw new Error("主题根目录必须是普通目录");
      directories = await readdir(root, { withFileTypes: true });
    } catch (error) {
      if (source === "installed" && isMissing(error)) continue;
      catalog.complete = false;
      catalog.diagnostics.push({ message: `${source} 主题目录读取失败：${message(error)}` });
      continue;
    }
    for (const entry of directories.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      try {
        const result = await validateThemeDirectory(join(root, entry.name));
        if (
          (source === "installed" && builtinThemeIds.some((id) => id === result.theme.id)) ||
          catalog.themes.some((theme) => theme.id === result.theme.id)
        )
          throw new Error("主题 ID 重复，不能覆盖已有主题");
        if (result.theme.id !== entry.name) throw new Error("主题 ID 必须与目录名称一致");
        result.theme.source = source;
        catalog.themes.push(result.theme);
        catalog.diagnostics.push(...result.diagnostics);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code && code !== "ENOENT") catalog.complete = false;
        catalog.diagnostics.push({ id: entry.name, message: message(error) });
      }
    }
  }
  return catalog;
}
