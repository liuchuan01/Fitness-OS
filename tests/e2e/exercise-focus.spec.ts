import { expect, test } from "@playwright/test";
import type * as Fiber from "@react-three/fiber";

for (const preference of ["reduce", "no-preference"] as const) {
  test(`${preference} exercise shares focus choreography and reset exits to the training day`, async ({
    page
  }, info) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1728, height: 1117 });
    await page.emulateMedia({ reducedMotion: preference });
    await page.goto("/");
    await expect(page.getByLabel("3D model status")).toContainText("Model ready", {
      timeout: 20_000
    });
    await page.getByRole("button", { name: "选择肌肉", exact: true }).click();
    const picker = page.getByRole("dialog", { name: "身体部位选择" });
    await picker.getByRole("button", { name: "背部", exact: true }).click();
    await picker.getByRole("button", { name: /背阔肌/ }).click();
    await page.locator(".muscle-history-link").first().click();
    await expect(page.locator(".shell")).toHaveClass(/mode-exercise/);
    await expect(page.getByLabel("动作概览 HUD")).toBeVisible();
    await expect(page.locator(".body-3d-shell")).toHaveAttribute("data-focus-motion", "idle");
    await page.getByRole("button", { name: "重置视角" }).click();
    await expect(page.locator(".shell")).toHaveClass(/mode-day/);
    await expect(page.locator(".body-3d-shell")).toHaveAttribute("data-focus-motion", "idle");
    await page.waitForFunction(async () => {
      const moduleUrl = "/node_modules/.vite/deps/@react-three_fiber.js";
      const { _roots } = (await import(moduleUrl)) as typeof Fiber;
      const canvas = document.querySelector<HTMLCanvasElement>(".body-3d-shell canvas")!;
      return Math.abs(_roots.get(canvas)!.store.getState().camera.position.x) < 0.001;
    });
    const initial = await page.evaluate(async () => {
      const moduleUrl = "/node_modules/.vite/deps/@react-three_fiber.js";
      const { _roots } = (await import(moduleUrl)) as typeof Fiber;
      const canvas = document.querySelector<HTMLCanvasElement>(".body-3d-shell canvas")!;
      const state = _roots.get(canvas)!.store.getState();
      const samples: number[][] = [];
      const probe = window as unknown as { samples: number[][]; stop: () => void };
      probe.samples = samples;
      let frame = 0;
      const record = () => {
        samples.push([
          state.camera.position.x,
          document.querySelector(".hud-recovery")!.getBoundingClientRect().x
        ]);
        frame = requestAnimationFrame(record);
      };
      record();
      probe.stop = () => cancelAnimationFrame(frame);
      return samples[0];
    });
    await page.locator(".exercise-card").filter({ hasText: "引体向上" }).click();
    await expect(page.getByLabel("动作概览 HUD")).toBeVisible();
    await page.waitForFunction(
      () => (window as unknown as { samples: number[][] }).samples.at(-1)![0] > 0.2
    );
    await expect(page.locator(".body-3d-shell")).toHaveAttribute("data-focus-motion", "idle");
    const samples = await page.evaluate(() => {
      const probe = window as unknown as { samples: number[][]; stop: () => void };
      probe.stop();
      return probe.samples;
    });
    const end = samples.at(-1)!;
    await expect(page.locator(".hud-load strong")).toHaveText("2组");
    await expect(page.locator(".hud-volume strong")).toHaveText("7处");
    for (const sample of samples) {
      expect(
        Math.abs(
          (sample[0] - initial[0]) / (end[0] - initial[0]) -
            (sample[1] - initial[1]) / (end[1] - initial[1])
        )
      ).toBeLessThan(0.04);
    }
    expect(
      new Set(
        samples
          .filter((s) => s[0] > initial[0] + 0.01 && s[0] < end[0] - 0.01)
          .map((s) => s[0].toFixed(3))
      ).size
    ).toBeGreaterThanOrEqual(2);
    for (const [width, height] of [
      [1440, 900],
      [1728, 1117]
    ]) {
      await page.setViewportSize({ width, height });
      // Allow the canvas resize observer to start its camera adjustment before waiting for it.
      await page.waitForTimeout(200);
      await expect(page.locator(".body-3d-shell")).toHaveAttribute("data-focus-motion", "idle");
      const cards = await page.locator(".body-hud-card").evaluateAll((elements) =>
        elements.map((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, height: r.height, border: getComputedStyle(el).borderTopColor };
        })
      );
      for (let i = 0; i < cards.length; i++) {
        expect(cards[i].border).toBe("rgba(0, 0, 0, 0)");
        expect(Math.abs(cards[i].x - cards[0].x)).toBeLessThan(1);
        expect(Math.abs(cards[i].height - cards[0].height)).toBeLessThan(1);
        if (i) expect(cards[i].y).toBeGreaterThan(cards[i - 1].y + cards[i - 1].height);
      }
      await page.screenshot({ path: info.outputPath(`exercise-${width}.png`) });
    }
    await page.getByRole("button", { name: "主练部位详情" }).hover();
    await expect(page.locator(".hud-volume .body-hud-surface")).toBeVisible();
    await page.locator(".hud-volume .body-hud-surface").evaluate(async (element) => {
      await Promise.all(element.getAnimations().map((animation) => animation.finished));
    });
    await expect(page.getByRole("button", { name: "主练部位详情" })).toHaveAttribute("aria-expanded", "true");
    await page.screenshot({ path: info.outputPath("exercise-hover.png") });
    await page.mouse.move(0, 0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: info.outputPath("exercise-mobile.png") });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390
    );
    await page.getByRole("button", { name: "重置视角" }).click();
    await expect(page.locator(".shell")).toHaveClass(/mode-day/);
    await expect(page.locator('.exercise-card[aria-pressed="true"]')).toHaveCount(0);
  });
}
