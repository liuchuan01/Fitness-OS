import { expect, test } from "@playwright/test";
import type * as Fiber from "@react-three/fiber";
test.use({ hasTouch: true });

for (const theme of ["neon", "graphite"]) {
  test(`${theme} narrow windows retain focus and muscle HUDs disclose real records`, async ({
    page
  }, info) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1180, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript((themeId) => {
      localStorage.setItem("fitness:appearance:v1", JSON.stringify({ themeId, glowEnabled: true }));
    }, theme);
    await page.goto("/");
    await expect(page.getByLabel("3D model status")).toContainText("Model ready", {
      timeout: 20000
    });
    await page.getByRole("button", { name: "展开训练时间线", exact: true }).click();
    await page.getByRole("button", { name: "选择肌肉", exact: true }).click();
    const picker = page.getByRole("dialog", { name: "身体部位选择" });
    await picker.getByRole("button", { name: "背部", exact: true }).click();
    await picker.getByRole("button", { name: /背阔肌/ }).click();
    await expect(page.locator(".shell")).toHaveClass(/timeline-open/);
    await expect(page.locator(".body-hud")).toHaveAttribute("data-focus-rail", "true");
    await page.waitForFunction(
      () => document.querySelector<HTMLElement>(".body-3d-shell")?.dataset.focusMotion === "idle"
    );
    const checkFocus = async () => {
      const result = await page.evaluate(async () => {
        const url = "/node_modules/.vite/deps/@react-three_fiber.js";
        const { _roots } = (await import(url)) as typeof Fiber;
        const canvas = document.querySelector<HTMLCanvasElement>(".body-3d-shell canvas")!;
        const state = _roots.get(canvas)!.store.getState();
        return {
          poster: !!state.scene.getObjectByName("muscle-backdrop"),
          x: state.camera.position.x
        };
      });
      expect(result.poster).toBe(true);
      expect(result.x).toBeGreaterThan(0.2);
      const boxes = await page.locator(".body-hud-card").evaluateAll((elements) =>
        elements.map((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, bottom: r.bottom };
        })
      );
      for (let i = 1; i < boxes.length; i++) {
        expect(Math.abs(boxes[i].x - boxes[0].x)).toBeLessThan(1);
        expect(boxes[i].y).toBeGreaterThan(boxes[i - 1].bottom);
      }
    };
    await checkFocus();
    await page.screenshot({ path: info.outputPath("1180-sidebar.png") });
    // Enter a historical day so the seven-day window includes the fixture records.
    await page.locator(".muscle-history-link").first().click();
    await page.getByRole("button", { name: "选择肌肉", exact: true }).click();
    await picker.getByRole("button", { name: "背部", exact: true }).click();
    await picker.getByRole("button", { name: /背阔肌/ }).click();
    await expect(page.getByLabel("肌肉训练档案", { exact: true })).toContainText("截至 2026-06-19");
    await page.waitForFunction(
      () => document.querySelector<HTMLElement>(".body-3d-shell")?.dataset.focusMotion === "idle"
    );
    for (const [position, label, text] of [
      ["recovery", "最近涉及训练", "最近主练 · 2026-06-19"],
      ["load", "近 7 日训练", "引体向上 · 2 组"],
      ["volume", "主练 / 参与", "主练 · 2 组"],
      ["stimulus", "上次怎么练", "自重承重比例 70% · 6 次 · RPE 7"]
    ]) {
      const button = page.getByRole("button", { name: `${label}详情`, exact: true });
      const before = await button.boundingBox();
      await button.hover();
      const detail = page.locator(`.hud-${position} .body-hud-detail`);
      await expect(detail).toContainText(text);
      await expect(detail).toBeVisible();
      expect(await button.boundingBox()).toEqual(before);
      await page.screenshot({ path: info.outputPath(`detail-${position}.png`) });
      await page.mouse.move(0, 0);
    }
    await page.getByRole("button", { name: "收起训练时间线", exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(200);
    await page.waitForFunction(
      () => document.querySelector<HTMLElement>(".body-3d-shell")?.dataset.focusMotion === "idle"
    );
    await checkFocus();
    await page.screenshot({ path: info.outputPath("1440-focus.png") });
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.waitForTimeout(200);
    await page.waitForFunction(
      () => document.querySelector<HTMLElement>(".body-3d-shell")?.dataset.focusMotion === "idle"
    );
    await expect(page.locator(".body-hud")).toHaveAttribute("data-focus-rail", "true");
    await checkFocus();
    await page.screenshot({ path: info.outputPath("1024-details.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator(".body-hud")).toHaveAttribute("data-focus-rail", "false");
    await page.getByRole("button", { name: "上次怎么练详情", exact: true }).tap();
    await expect(page.locator(".hud-stimulus .body-hud-detail")).toContainText("RPE 8");
    await page.screenshot({ path: info.outputPath("390-details.png") });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390
    );
  });
}
