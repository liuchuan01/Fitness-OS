import { expect, test, type Page } from "@playwright/test";
import type * as Fiber from "@react-three/fiber";
import type { Vector3 } from "three";

async function choose(page: Page, region: string, label: string) {
  await page.getByRole("button", { name: "选择肌肉", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "身体部位选择" });
  await picker.getByRole("button", { name: region, exact: true }).click();
  await picker.getByRole("button", { name: new RegExp(label) }).click();
}
async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const moduleUrl = "/node_modules/.vite/deps/@react-three_fiber.js";
    const { _roots } = (await import(moduleUrl)) as typeof Fiber;
    const canvas = document.querySelector<HTMLCanvasElement>(".body-3d-shell canvas")!;
    const state = _roots.get(canvas)!.store.getState();
    const target = (state.controls as unknown as { target: Vector3 }).target;
    return {
      camera: state.camera.position.toArray(),
      target: target.toArray(),
      distance: state.camera.position.distanceTo(target),
      cards: [...document.querySelectorAll(".body-hud-card")].map((element) => {
        const r = element.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      })
    };
  });
}
for (const theme of ["neon", "graphite"]) {
  test(`${theme} focus moves camera and HUD continuously and reverses to the saved view`, async ({
    page
  }, info) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1728, height: 1117 });
    await page.addInitScript(
      (themeId) =>
        localStorage.setItem(
          "fitness:appearance:v1",
          JSON.stringify({ themeId, glowEnabled: true })
        ),
      theme
    );
    await page.goto("/");
    await expect(page.getByLabel("3D model status")).toContainText("Model ready", {
      timeout: 20_000
    });
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.getByRole("button", { name: "重置视角" }).click();
    await expect(page.locator(".body-3d-shell")).toHaveAttribute("data-focus-motion", "idle");
    // Start from a user-adjusted zoom so returning to a hard-coded default cannot pass.
    await page.locator(".body-3d-shell canvas").hover({ position: { x: 60, y: 160 } });
    await page.mouse.wheel(0, -80);
    await expect.poll(async () => (await snapshot(page)).distance).toBeLessThan(7.7);
    await page.waitForTimeout(200);
    const before = await snapshot(page);
    await choose(page, "背部", "背阔肌");
    await expect(page.locator(".body-3d-shell")).toHaveAttribute("data-focus-motion", "moving");
    await page.waitForTimeout(160);
    const middle = await snapshot(page);
    await expect(page.locator(".body-3d-shell")).toHaveAttribute("data-focus-motion", "idle");
    const focused = await snapshot(page);
    expect(middle.target[0]).toBeGreaterThan(before.target[0]);
    expect(middle.target[0]).toBeLessThan(focused.target[0]);
    expect(focused.distance).toBeLessThan(before.distance * 0.9);
    expect(middle.cards[0].x).toBeGreaterThan(before.cards[0].x + 20);
    expect(middle.cards[0].x).toBeLessThan(focused.cards[0].x);
    for (let index = 1; index < focused.cards.length; index++) {
      expect(Math.abs(focused.cards[index].x - focused.cards[0].x)).toBeLessThan(2);
      expect(focused.cards[index].y).toBeGreaterThan(
        focused.cards[index - 1].y + focused.cards[index - 1].height + 8
      );
    }
    await page.mouse.move(0, 0);
    await page.screenshot({ path: info.outputPath("focused.png") });
    // Clear through the actual empty-canvas click path.
    const canvas = page.locator(".body-3d-shell canvas");
    await canvas.click({ position: { x: 50, y: 150 } });
    await expect(page.locator(".body-3d-shell")).toHaveAttribute("data-focus-motion", "moving");
    await page.waitForTimeout(140);
    const returning = await snapshot(page);
    expect(returning.target[0]).toBeGreaterThan(before.target[0]);
    expect(returning.target[0]).toBeLessThan(focused.target[0]);
    await expect(page.locator(".body-3d-shell")).toHaveAttribute("data-focus-motion", "idle");
    const restored = await snapshot(page);
    restored.camera.forEach((value, index) => expect(value).toBeCloseTo(before.camera[index], 3));
    restored.cards.forEach((card, index) => expect(card.x).toBeCloseTo(before.cards[index].x, 0));
    await page.screenshot({ path: info.outputPath("restored.png") });
    // Reverse an in-flight focus; a new selection starts from the current view.
    await choose(page, "手臂", "肱三头肌外侧头");
    await page.getByRole("button", { name: "清除选择", exact: true }).click();
    await choose(page, "小腿", "比目鱼肌");
    await expect(page.locator(".body-3d-shell")).toHaveAttribute("data-focus-motion", "moving");
    await expect(page.locator(".body-3d-shell")).toHaveAttribute("data-focus-motion", "idle");
    await page.screenshot({ path: info.outputPath("lower-leg-focus.png") });
    await page.getByRole("button", { name: "清除选择", exact: true }).click();
    await expect(page.locator(".body-3d-shell")).toHaveAttribute("data-focus-motion", "moving");
    await expect(page.locator(".body-3d-shell")).toHaveAttribute("data-focus-motion", "idle");
    const final = await snapshot(page);
    final.camera.forEach((value, index) => expect(value).toBeCloseTo(before.camera[index], 3));
  });
}
