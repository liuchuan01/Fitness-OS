import { expect, test, type Page } from "@playwright/test";
import type { Mesh } from "three";
import type * as Fiber from "@react-three/fiber";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { buildDashboardProjection } from "../../shared/fitness/index";

const fixture = (path: string) => parse(readFileSync(`tests/fixtures/data/${path}`, "utf8"));
const workouts = ["2026-06-19", "2026-06-16"].map((date) => fixture(`workouts/2026/${date}.yaml`));
const projection = buildDashboardProjection({
  date: "2026-06-21",
  currentWorkout: workouts[0],
  recentWorkouts: workouts,
  muscleMap: fixture("muscles/muscle_map.yaml"),
  stimulusRules: fixture("muscles/stimulus_rules.yaml"),
  constraints: { lower_back_sensitive: true }
});

// Use the mounted renderer only in this browser test; no production debug API.
async function compareDrawOrder(page: Page, angle: number, depthEnabled = true) {
  return page.evaluate(
    async ({ angle, depthEnabled }) => {
      const moduleUrl = "/node_modules/.vite/deps/@react-three_fiber.js";
      const { _roots } = (await import(moduleUrl)) as typeof Fiber;
      const canvas = document.querySelector<HTMLCanvasElement>(".body-3d-shell canvas")!;
      const state = _roots.get(canvas)!.store.getState();
      const meshes: Mesh[] = [];
      const depths: Mesh[] = [];
      state.scene.traverse((node) => {
        if (node.userData.taxonomyMuscleId) meshes.push(node as Mesh);
        if (node.name.endsWith(".depth")) depths.push(node as Mesh);
      });
      if (meshes.length < 100) throw new Error("Expected loaded muscle geometry");
      const model = meshes[0].parent!;
      model.rotation.y = angle;
      const orders = meshes.map((mesh) => mesh.renderOrder);
      const visibility = depths.map((mesh) => mesh.visible);
      if (!depthEnabled) depths.forEach((mesh) => (mesh.visible = false));
      const gl = state.gl.getContext();
      const read = () => {
        state.gl.render(state.scene, state.camera);
        const pixels = new Uint8Array(canvas.width * canvas.height * 4);
        gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        return pixels;
      };
      meshes.forEach((mesh, index) => (mesh.renderOrder = 2 + index));
      const forward = read();
      meshes.forEach((mesh, index) => (mesh.renderOrder = 2 + meshes.length - index));
      const reverse = read();
      meshes.forEach((mesh, index) => (mesh.renderOrder = orders[index]));
      depths.forEach((mesh, index) => (mesh.visible = visibility[index]));
      read();
      let changedPixels = 0;
      let bodyPixels = 0;
      const changed = new Uint8Array(canvas.width * canvas.height);
      for (let i = 0; i < forward.length; i += 4) {
        if (forward[i + 3] > 0) bodyPixels++;
        if (forward.slice(i, i + 4).some((v, j) => Math.abs(v - reverse[i + j]) > 2)) {
          changedPixels++;
          changed[i / 4] = 1;
        }
      }
      // Ignore isolated edge/depth ties, but never accept a changed interior pixel.
      let changedInteriorPixels = 0;
      const w = canvas.width;
      for (let y = 1; y < canvas.height - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          if (changed[i] && changed[i - 1] && changed[i + 1] && changed[i - w] && changed[i + w]) {
            changedInteriorPixels++;
          }
        }
      }
      return {
        changedPixels,
        changedInteriorPixels,
        bodyPixels,
        calls: state.gl.info.render.calls
      };
    },
    { angle, depthEnabled }
  );
}

for (const theme of ["neon", "graphite"]) {
  test(`${theme} muscle surfaces have no area-sized draw-order artifacts`, async ({
    page
  }, testInfo) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.clock.setFixedTime(new Date("2026-06-21T12:00:00Z"));
    await page.addInitScript((themeId) => {
      localStorage.setItem("fitness:appearance:v1", JSON.stringify({ themeId, glowEnabled: true }));
    }, theme);
    await page.route("**/api/dashboard", (route) =>
      route.fulfill({ json: { ok: true, projection } })
    );
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(page.getByLabel("3D model status")).toContainText("Model ready", {
      timeout: 20_000
    });
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.getByRole("button", { name: "重置视角" }).click();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(250);
    // Controlled ablation: removing only the depth pass must reproduce area-sized mixing.
    const withoutDepth = await compareDrawOrder(page, Math.PI, false);
    expect(withoutDepth.changedInteriorPixels).toBeGreaterThan(100);
    await testInfo.attach("without-depth", {
      body: JSON.stringify(withoutDepth),
      contentType: "application/json"
    });
    for (const [label, angle] of Object.entries({
      front: 0,
      side: Math.PI / 2,
      left: 2.7,
      beforeBack: Math.PI - 0.04,
      back: Math.PI,
      afterBack: Math.PI + 0.04,
      right: 3.6
    })) {
      const result = await compareDrawOrder(page, angle);
      await page.screenshot({ path: testInfo.outputPath(`${theme}-${label}.png`) });
      expect(result.bodyPixels).toBeGreaterThan(1000);
      expect(result.changedInteriorPixels, `${label}: ${JSON.stringify(result)}`).toBe(0);
      await testInfo.attach(label, {
        body: JSON.stringify(result),
        contentType: "application/json"
      });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(250);
    const mobile = await compareDrawOrder(page, Math.PI);
    await page.screenshot({ path: testInfo.outputPath(`${theme}-mobile-back.png`) });
    expect(mobile.changedInteriorPixels).toBe(0);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.getByRole("button", { name: "选择肌肉", exact: true }).click();
      const explorer = page.getByRole("dialog", { name: "身体部位选择" });
      await explorer.getByRole("button", { name: "背部", exact: true }).click();
      await explorer.getByRole("button", { name: /背阔肌/ }).click();
      await expect(page.getByRole("heading", { name: "背阔肌", exact: true })).toBeVisible();
      for (const mode of ["focus", "exercise", "day"]) {
        if (mode === "exercise")
          await page.getByLabel("相关动作选择").getByRole("button").first().click();
        if (mode === "day") {
          await page
            .getByRole("button", {
              name: width === 390 ? "训练记录" : "展开训练时间线",
              exact: true
            })
            .click();
          await page.getByRole("button", { name: /Pull Day/ }).click();
          await page.getByRole("button", { name: "收起训练时间线", exact: true }).click();
          await expect(page.locator('.exercise-card[aria-pressed="true"]')).toHaveCount(0);
        }
        await page.mouse.move(0, 0);
        await page.waitForTimeout(200);
        const result = await compareDrawOrder(page, Math.PI);
        expect(result.changedInteriorPixels, `${width}-${mode}: ${JSON.stringify(result)}`).toBe(0);
        await page.screenshot({ path: testInfo.outputPath(`${theme}-${width}-${mode}.png`) });
      }
    }
  });
}
