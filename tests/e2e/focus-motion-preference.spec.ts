import { expect, test } from "@playwright/test";
import type * as Fiber from "@react-three/fiber";

for (const preference of ["reduce", "no-preference"] as const) {
  test(`${preference} keeps visible intermediate frames for focus and return`, async ({
    page
  }, info) => {
    await page.setViewportSize({ width: 1728, height: 1117 });
    await page.emulateMedia({ reducedMotion: preference });
    await page.goto("/");
    await expect(page.getByLabel("3D model status")).toContainText("Model ready", {
      timeout: 20_000
    });
    // Keep the page in the foreground; test the actual live rendering path.
    const initial = await page.evaluate(async () => {
      const moduleUrl = "/node_modules/.vite/deps/@react-three_fiber.js";
      const { _roots } = (await import(moduleUrl)) as typeof Fiber;
      const canvas = document.querySelector<HTMLCanvasElement>(".body-3d-shell canvas")!;
      const state = _roots.get(canvas)!.store.getState();
      const samples: number[][] = [];
      const probe = window as unknown as {
        focusSamples: number[][];
        stopProbe: () => void;
        startProbe: () => void;
      };
      probe.focusSamples = samples;
      let frame = 0;
      const record = () => {
        const card = document.querySelector(".hud-recovery")!;
        samples.push([state.camera.position.x, card.getBoundingClientRect().x]);
        frame = requestAnimationFrame(record);
      };
      record();
      probe.stopProbe = () => cancelAnimationFrame(frame);
      probe.startProbe = () => {
        samples.length = 0;
        record();
      };
      return samples[0];
    });
    await page.getByRole("button", { name: "选择肌肉", exact: true }).click();
    const picker = page.getByRole("dialog", { name: "身体部位选择" });
    await picker.getByRole("button", { name: "背部", exact: true }).click();
    await picker.getByRole("button", { name: /背阔肌/ }).click();
    await expect(page.getByRole("heading", { name: "背阔肌", exact: true })).toBeVisible();
    await page.waitForFunction(() => {
      const samples = (window as unknown as { focusSamples: number[][] }).focusSamples;
      return samples.at(-1)![0] > 0.2;
    });
    await expect(page.locator(".body-3d-shell")).toHaveAttribute("data-focus-motion", "idle");
    await page.screenshot({ path: info.outputPath("focused.png") });
    const samples = await page.evaluate(() => {
      const probe = window as unknown as {
        focusSamples: number[][];
        stopProbe: () => void;
        startProbe: () => void;
      };
      probe.stopProbe();
      return probe.focusSamples;
    });
    const end = samples.at(-1)!;
    // Camera translation and HUD translation must share the same rendered progress.
    for (const sample of samples) {
      const cameraProgress = (sample[0] - initial[0]) / (end[0] - initial[0]);
      const hudProgress = (sample[1] - initial[1]) / (end[1] - initial[1]);
      expect(Math.abs(cameraProgress - hudProgress)).toBeLessThan(0.04);
    }
    const cards = await page.locator(".body-hud-card").evaluateAll((elements) =>
      elements.map((element) => ({
        height: element.getBoundingClientRect().height,
        background: getComputedStyle(element).backgroundImage,
        border: getComputedStyle(element).borderTopColor
      }))
    );
    expect(
      Math.max(...cards.map((card) => card.height)) - Math.min(...cards.map((card) => card.height))
    ).toBeLessThan(1);
    for (const card of cards) {
      expect(card.background).toBe("none");
      expect(card.border).toBe("rgba(0, 0, 0, 0)");
    }
    const summary = page.getByRole("button", { name: "最近涉及训练详情", exact: true });
    const position = await summary.boundingBox();
    await summary.hover();
    await expect(summary).toHaveAttribute("aria-expanded", "true");
    expect(await summary.boundingBox()).toEqual(position);
    await expect(page.locator(".hud-recovery .body-hud-surface")).toBeVisible();
    await page.screenshot({ path: info.outputPath("hover.png") });
    await page.mouse.move(0, 0);
    for (const index of [0, 1]) {
      const intermediate = samples.filter(
        (sample) => sample[index] > initial[index] + 0.01 && sample[index] < end[index] - 0.01
      );
      expect(
        new Set(intermediate.map((sample) => sample[index].toFixed(3))).size
      ).toBeGreaterThanOrEqual(2);
    }
    await page.evaluate(() => (window as unknown as { startProbe: () => void }).startProbe());
    await page.getByRole("button", { name: "清除选择", exact: true }).click();
    await page.waitForFunction(
      (focusedX) =>
        (window as unknown as { focusSamples: number[][] }).focusSamples.at(-1)![0] <
        focusedX - 0.05,
      end[0]
    );
    await expect(page.locator(".body-3d-shell")).toHaveAttribute("data-focus-motion", "idle");
    const returned = await page.evaluate(() => {
      const probe = window as unknown as { focusSamples: number[][]; stopProbe: () => void };
      probe.stopProbe();
      return probe.focusSamples;
    });
    for (const index of [0, 1]) {
      const intermediate = returned.filter(
        (sample) => sample[index] > initial[index] + 0.01 && sample[index] < end[index] - 0.01
      );
      expect(
        new Set(intermediate.map((sample) => sample[index].toFixed(3))).size
      ).toBeGreaterThanOrEqual(2);
      expect(returned.at(-1)![index]).toBeCloseTo(initial[index], 1);
    }
    await page.screenshot({ path: info.outputPath("returned.png") });
  });
}
