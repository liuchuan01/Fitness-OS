import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLocalService } from "../../server/app.js";
import { readThemeCatalog, validateThemeDirectory } from "../../server/themes/catalog.js";
import { parseThemePackage, themeCatalogSchema } from "../../shared/themes/schema.js";

async function fetchCatalog(url: string) {
  return themeCatalogSchema.parse(await (await fetch(url)).json());
}

const minimal = {
  schemaVersion: 1,
  id: "custom",
  name: "Custom",
  version: "1.0.0",
  appearance: "dark"
};
let workspace: string;
let server: ReturnType<typeof createLocalService> | undefined;
beforeEach(async () => {
  workspace = await mkdtemp(join(tmpdir(), "fitness-themes-"));
});
afterEach(async () => {
  if (server) await new Promise<void>((done) => server!.close(() => done()));
  server = undefined;
  await rm(workspace, { recursive: true, force: true });
});
async function install(id: string, input: unknown) {
  const root = join(workspace, "themes", id);
  await mkdir(root, { recursive: true });
  await writeFile(join(root, "theme.json"), JSON.stringify(input));
  return root;
}
const roots = () => ({
  builtin: resolve("resources/themes"),
  installed: join(workspace, "themes")
});

describe("主题包运行时契约", () => {
  it("资源内容变化会更新URL版本，目录名称不匹配不注册", async () => {
    const root = await install("custom", { ...minimal, typography: { font: "font.woff2" } });
    await writeFile(join(root, "font.woff2"), "wOF2first-content");
    const first = await validateThemeDirectory(root);
    await writeFile(join(root, "font.woff2"), "wOF2new-content");
    const second = await validateThemeDirectory(root);
    expect(first.theme.assetUrls.font).not.toBe(second.theme.assetUrls.font);
    await install("wrong-directory", { ...minimal, id: "another-theme" });
    const catalog = await readThemeCatalog(roots());
    expect(catalog.themes.some((entry) => entry.id === "another-theme")).toBe(false);
    expect(catalog.diagnostics.some((entry) => entry.message.includes("目录名称"))).toBe(true);
  });

  it("拒绝资源父目录符号链接和超大资产", async () => {
    const root = await install("custom", { ...minimal, typography: { font: "assets/font.woff2" } });
    const outside = join(workspace, "outside");
    await mkdir(outside);
    await writeFile(join(outside, "font.woff2"), "wOF2outside");
    await symlink(outside, join(root, "assets"));
    expect((await validateThemeDirectory(root)).diagnostics[0].message).toContain("符号链接");
    await rm(join(root, "assets"));
    await mkdir(join(root, "assets"));
    await writeFile(join(root, "assets", "font.woff2"), Buffer.alloc(5 * 1024 * 1024 + 1));
    expect((await validateThemeDirectory(root)).diagnostics[0].message).toContain("大小");
  });

  it("严格校验版本、未知键、路径、颜色与数值并保持负荷色带独立", () => {
    const theme = parseThemePackage({ ...minimal, tokens: { "interaction.primary": "#abcdef" } });
    expect(theme.body.loadColors[0]).toBe("#00e5ff");
    expect(theme.material.blur).toBe(8);
    for (const invalid of [
      { ...minimal, schemaVersion: 2 },
      { ...minimal, execute: "code" },
      { ...minimal, body: { roughness: 2 } },
      { ...minimal, tokens: { blue: "#ffffff" } },
      { ...minimal, tokens: { "background.canvas": "url(https://evil)" } },
      { ...minimal, tokens: { "border.default": "rgba(999,0,0,1)" } },
      { ...minimal, assets: { preview: "../secret.png" } }
    ])
      expect(() => parseThemePackage(invalid)).toThrow();
  });

  it("无需重启即可发现、更新及移除主题，并拒绝覆盖内置主题", async () => {
    server = createLocalService({ version: "test", workspaceRoot: workspace });
    await new Promise<void>((done) => server!.listen(0, "127.0.0.1", done));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/themes`;
    expect((await fetchCatalog(url)).themes).toHaveLength(2);
    const root = await install("custom", minimal);
    expect((await fetchCatalog(url)).themes.map((theme: { id: string }) => theme.id)).toContain(
      "custom"
    );
    await writeFile(join(root, "theme.json"), JSON.stringify({ ...minimal, name: "Updated" }));
    expect(
      (await fetchCatalog(url)).themes.find((theme: { id: string }) => theme.id === "custom")?.name
    ).toBe("Updated");
    await install("neon", { ...minimal, id: "neon" });
    const duplicate = await fetchCatalog(url);
    expect(duplicate.diagnostics[0].message).toContain("重复");
    expect(duplicate.themes.find((theme: { id: string }) => theme.id === "neon")?.source).toBe(
      "builtin"
    );
    await rm(root, { recursive: true });
    expect((await fetchCatalog(url)).themes).toHaveLength(2);
  });

  it("单个坏包可诊断，目录不可读取与确定不存在区分", async () => {
    await install("custom", { ...minimal, schemaVersion: 2 });
    const invalid = await readThemeCatalog(roots());
    expect(invalid.complete).toBe(true);
    expect(invalid.diagnostics).toHaveLength(1);
    await rm(join(workspace, "themes"), { recursive: true });
    await writeFile(join(workspace, "themes"), "not a directory");
    expect((await readThemeCatalog(roots())).complete).toBe(false);
    await rm(join(workspace, "themes"));
    expect((await readThemeCatalog(roots())).complete).toBe(true);
  });

  it("只服务声明的资源，缺资源回退，拒绝包或资源符号链接", async () => {
    const root = await install("custom", {
      ...minimal,
      assets: { preview: "preview.png" },
      typography: { font: "missing.woff2" }
    });
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ9sAAAAASUVORK5CYII=",
      "base64"
    );
    await writeFile(join(root, "preview.png"), png);
    await writeFile(join(root, "private.png"), png);
    server = createLocalService({ version: "test", workspaceRoot: workspace });
    await new Promise<void>((done) => server!.listen(0, "127.0.0.1", done));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/themes`;
    const catalog = await fetchCatalog(url);
    const theme = catalog.themes.find((entry: { id: string }) => entry.id === "custom");
    expect(theme?.assetUrls.preview).toMatch(
      /^\/api\/themes\/custom\/assets\/preview\.png\?v=[a-f0-9]{16}$/
    );
    expect(theme?.assetUrls.font).toBeUndefined();
    expect(catalog.diagnostics).toHaveLength(1);
    const resource = await fetch(url + "/custom/assets/preview.png");
    expect(resource.headers.get("content-type")).toBe("image/png");
    expect(Buffer.from(await resource.arrayBuffer())).toEqual(png);
    expect((await fetch(url + "/custom/assets/private.png")).status).toBe(404);
    await rm(join(root, "preview.png"));
    await symlink(join(root, "private.png"), join(root, "preview.png"));
    expect((await fetch(url + "/custom/assets/preview.png")).status).toBe(404);
    await symlink(root, join(workspace, "themes", "linked"));
    expect(
      (await readThemeCatalog(roots())).diagnostics.some((entry) => entry.id === "linked")
    ).toBe(true);
  });

  it("拒绝超大清单与伪装格式资源", async () => {
    const root = await install("custom", { ...minimal, assets: { preview: "preview.png" } });
    await writeFile(join(root, "preview.png"), "not png");
    expect((await validateThemeDirectory(root)).diagnostics[0].message).toContain("格式");
    await writeFile(join(root, "theme.json"), " ".repeat(65537));
    await expect(validateThemeDirectory(root)).rejects.toThrow("大小");
  });
});
