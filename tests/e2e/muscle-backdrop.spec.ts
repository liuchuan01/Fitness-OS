import { expect, test, type Page } from "@playwright/test";
import type { Mesh, Material } from "three";
import type * as Fiber from "@react-three/fiber";

async function choose(page: Page, region: string, label: string) {
  await page.getByRole("button", { name: "选择肌肉", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "身体部位选择" });
  await picker.getByRole("button", { name: region, exact: true }).click();
  await picker.getByRole("button", { name: new RegExp(label) }).click();
  await expect(page.getByRole("heading", { name: label, exact: true })).toBeVisible();
}

async function compareBackdrop(page: Page) {
  return page.evaluate(async () => {
    const moduleUrl = "/node_modules/.vite/deps/@react-three_fiber.js";
    const { _roots } = (await import(moduleUrl)) as typeof Fiber;
    const canvas = document.querySelector<HTMLCanvasElement>(".body-3d-shell canvas")!;
    const state = _roots.get(canvas)!.store.getState();
    const backdrop = state.scene.getObjectByName("muscle-backdrop") as Mesh;
    if (!backdrop) throw new Error("Expected desktop lettering");
    const gl = state.gl.getContext();
    const read = () => {
      state.gl.render(state.scene, state.camera);
      const pixels = new Uint8Array(canvas.width * canvas.height * 4);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      return pixels;
    };
    const normal = read();
    backdrop.visible = false;
    const without = read();
    // Render only the existing depth geometry as a silhouette, then restore every material.
    const writes = new Map<Material, boolean>();
    state.scene.traverse((node) => {
      const mesh = node as Mesh;
      if (!mesh.isMesh) return;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        writes.set(material, material.colorWrite);
        material.colorWrite = node.name.endsWith(".depth");
      }
    });
    const mask = read();
    writes.forEach((value, material) => {
      material.colorWrite = value;
    });
    backdrop.visible = true;
    const materials = Array.isArray(backdrop.material) ? backdrop.material : [backdrop.material];
    materials.forEach((material) => {
      material.depthTest = false;
    });
    const unoccluded = read();
    materials.forEach((material) => {
      material.depthTest = true;
    });
    read();
    const changed = (a: Uint8Array, b: Uint8Array, i: number) =>
      [0, 1, 2, 3].some((channel) => Math.abs(a[i + channel] - b[i + channel]) > 2);
    let visibleText = 0,
      overwrittenBody = 0,
      blockedText = 0;
    for (let y = 1; y < canvas.height - 1; y++) {
      for (let x = 1; x < canvas.width - 1; x++) {
        const i = (y * canvas.width + x) * 4;
        const interior = [i, i - 4, i + 4, i - canvas.width * 4, i + canvas.width * 4].every(
          (offset) => mask[offset + 3] === 255
        );
        if (changed(normal, without, i)) {
          visibleText++;
          if (interior) overwrittenBody++;
        }
        if (interior && changed(unoccluded, normal, i)) blockedText++;
      }
    }
    return { visibleText, overwrittenBody, blockedText };
  });
}

for (const theme of ["neon", "graphite"]) {
  test(`${theme} background muscle name stays behind the body and leaves chat clear`, async ({
    page
  }, testInfo) => {
    test.setTimeout(90_000);
    await page.addInitScript((themeId) => {
      localStorage.setItem("fitness:appearance:v1", JSON.stringify({ themeId }));
    }, theme);
    await page.setViewportSize({ width: 1728, height: 1117 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.getByLabel("3D model status")).toContainText("Model ready", {
      timeout: 20_000
    });
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await choose(page, "手臂", "肱三头肌外侧头");
    await page.getByRole("button", { name: "重置视角" }).click();
    await page.mouse.move(0, 0);
    await expect(page.locator(".selection-panel")).toHaveCount(0);
    for (const [width, height] of [
      [1440, 900],
      [1728, 1117],
      [2560, 1440]
    ]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(200);
      const comparison = await compareBackdrop(page);
      expect(comparison.visibleText).toBeGreaterThan(1000);
      expect(comparison.overwrittenBody).toBe(0);
      expect(comparison.blockedText).toBeGreaterThan(100);
      const launcher = page.locator(".agent-chat-launcher");
      await expect(launcher).toBeVisible();
      await launcher.click({ trial: true });
      await page.screenshot({ path: testInfo.outputPath(`${width}-long-name.png`) });
    }
    await choose(page, "背部", "背阔肌");
    await expect(page.locator(".canvas-context")).toContainText("背阔肌");
    await choose(page, "背部", "下段竖脊肌");
    await expect(page.getByLabel("模型覆盖说明")).toContainText("模型近似显示");
    await page.getByRole("button", { name: "专业模式", exact: true }).click();
    await expect(page.getByLabel("模型覆盖说明")).toContainText("erector_spinae_lower");
    await page.getByRole("button", { name: "普通模式", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { name: "下段竖脊肌", exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("mobile-focus.png") });
    await page.getByRole("button", { name: "清除选择", exact: true }).click();
    await expect(page.getByLabel("肌肉训练档案", { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390
    );
  });
}
