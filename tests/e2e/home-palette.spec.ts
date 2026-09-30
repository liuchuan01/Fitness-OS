import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { buildDashboardProjection } from "../../shared/fitness/index";
import type * as Fiber from "@react-three/fiber";
import type { Mesh, MeshStandardMaterial } from "three";

test("renders continuous soft load colors and matching legend with an integrated timeline heading", async ({
  page
}, testInfo) => {
  await page.clock.setFixedTime(new Date("2026-06-21T12:00:00Z"));
  const fixture = (path: string) => parse(readFileSync(`tests/fixtures/data/${path}`, "utf8"));
  const workouts = ["2026-06-19", "2026-06-16"].map((date) =>
    fixture(`workouts/2026/${date}.yaml`)
  );
  await page.route("**/api/dashboard", async (route) => {
    const data = {
      ok: true,
      projection: buildDashboardProjection({
        date: "2026-06-21",
        currentWorkout: workouts[0],
        recentWorkouts: workouts,
        muscleMap: fixture("muscles/muscle_map.yaml"),
        stimulusRules: fixture("muscles/stimulus_rules.yaml"),
        constraints: { lower_back_sensitive: true }
      })
    };
    // Controlled visual fixture: exercise/selection mode must not mask load colors.
    for (const muscle of data.projection.bodyProjection) {
      muscle.status = muscle.muscleId.startsWith("pec_major")
        ? "purple"
        : muscle.muscleId.startsWith("deltoid")
          ? "orange"
          : muscle.muscleId.startsWith("vastus") || muscle.muscleId === "rectus_femoris"
            ? "red"
            : "gray";
      muscle.intensity =
        muscle.status === "gray"
          ? 0
          : muscle.status === "purple"
            ? 100
            : muscle.status === "orange"
              ? 1
              : 50;
    }
    await route.fulfill({ json: data });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByLabel("3D model status")).toContainText("Model ready");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.getByRole("button", { name: "重置视角" }).click();
  await expect
    .poll(async () =>
      page.locator("canvas").evaluate((canvas) => {
        const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
        if (!gl) throw new Error("WebGL required");
        const pixels = new Uint8Array(canvas.width * canvas.height * 4);
        gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        let magenta = 0;
        let cyan = 0;
        let yellow = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          const [r, g, b] = pixels.slice(i, i + 3);
          if (r > 70 && r > g * 1.3 && b > g * 1.2) magenta++;
          if (g > 70 && g > r * 1.3 && b > r * 1.3) cyan++;
          if (r > 70 && r > b * 1.3 && g > b * 1.2) yellow++;
        }
        return magenta > 100 && cyan > 100 && yellow < 100;
      })
    )
    .toBe(true);
  const legend = page.getByLabel("身体投影图例");
  await expect(legend).toContainText("低刺激");
  await expect(legend).toContainText("高刺激");
  await expect(legend.locator(".projection-warning")).toHaveCount(0);
  await expect(legend.locator(".projection-continuous")).toHaveCSS(
    "background-image",
    /linear-gradient/
  );
  const materialColors = await page.evaluate(async () => {
    const moduleUrl = "/node_modules/.vite/deps/@react-three_fiber.js";
    const { _roots } = (await import(moduleUrl)) as typeof Fiber;
    const canvas = document.querySelector<HTMLCanvasElement>(".body-3d-shell canvas")!;
    const state = _roots.get(canvas)!.store.getState();
    const result: Record<string, string> = {};
    state.scene.traverse((node) => {
      const id = node.userData.taxonomyMuscleId;
      if (id) result[id] = ((node as Mesh).material as MeshStandardMaterial).color.getHexString();
    });
    return result;
  });
  expect(materialColors.pec_major_mid).toBe("ff477e");
  expect(materialColors.rectus_femoris).toBe("a292b1");
  expect(materialColors.deltoid_anterior).toBe("06e3fd");
  expect(materialColors.latissimus_dorsi).toBe("536878");
  await page.getByRole("button", { name: "展开训练时间线" }).click();
  const legendBounds = (await legend.boundingBox())!;
  const launcherBounds = (await page.locator(".agent-chat-launcher").boundingBox())!;
  expect(legendBounds.y + legendBounds.height).toBeLessThanOrEqual(launcherBounds.y - 8);
  const heading = page.locator(".timeline-heading");
  await expect(heading.getByRole("button", { name: "收起训练时间线" })).toBeVisible();
  await expect(page.locator(".timeline > .rail-toggle")).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("overview-expanded.png"),
    animations: "disabled"
  });
  await page.getByRole("button", { name: "收起训练时间线" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: testInfo.outputPath("overview-mobile.png"),
    animations: "disabled"
  });
});
