import { expect, test, type Page } from "@playwright/test";

test("keeps four HUDs and uses a bounded two-level explorer on desktop and mobile", async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByLabel("3D model status")).toContainText("Model ready", {
    timeout: 20_000
  });
  await expect(page.locator(".body-hud-card")).toHaveCount(4);
  await expect(page.locator(".body-3d-shell")).toHaveAttribute("data-motion", "rotating");
  await page.screenshot({ path: testInfo.outputPath("hud-overview.png") });
  await page.getByRole("button", { name: "选择肌肉", exact: true }).click();
  const explorer = page.getByRole("dialog", { name: "身体部位选择" });
  await expect(page.locator(".body-3d-shell")).toHaveAttribute("data-motion", "paused");
  await expect(explorer.getByRole("button", { name: "背部", exact: true })).toBeVisible();
  await expect(explorer.getByRole("button", { name: /背阔肌/ })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("hud-regions.png") });
  await explorer.getByRole("button", { name: "背部", exact: true }).click();
  await expect(explorer.getByRole("button", { name: /背阔肌/ })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("hud-muscles.png") });
  await explorer.getByRole("button", { name: /背阔肌/ }).click();
  await expect(explorer).toHaveCount(0);
  await expect(page.getByLabel("肌肉概览 HUD").locator(".body-hud-card")).toHaveCount(4);
  for (const card of await page.locator(".body-hud-card").all()) await expect(card).toBeVisible();
  await expect(page.getByText("以前怎么练的", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("hud-focus.png") });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "选择肌肉", exact: true }).click();
  await expect(explorer).toBeVisible();
  await explorer.getByRole("button", { name: "手臂", exact: true }).click();
  const bounds = await explorer.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
  await expect(explorer.getByLabel("手臂肌肉")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("hud-explorer-mobile.png") });
  await explorer.getByRole("button", { name: /旋前圆肌/ }).click();
  await expect(page.getByRole("heading", { name: "旋前圆肌", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "选择肌肉", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(explorer).toHaveCount(0);
  await expect(page.getByRole("button", { name: "选择肌肉", exact: true })).toBeFocused();
  for (const card of await page.locator(".body-hud-card").all()) {
    await expect(card).toHaveCSS("opacity", "1");
  }
  await page.screenshot({ path: testInfo.outputPath("hud-focus-mobile.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("rotates real canvas pixels, pauses for selection, and resumes after closing", async ({
  page
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByLabel("3D model status")).toContainText("Model ready", {
    timeout: 20_000
  });
  const initial = await pixelSignature(page);
  await expect.poll(() => pixelSignature(page)).not.toBe(initial);
  await page.getByRole("button", { name: "选择肌肉", exact: true }).click();
  await expect(page.locator(".body-3d-shell")).toHaveAttribute("data-motion", "paused");
  // Let the selection highlight finish drawing before measuring the stationary model.
  await page.waitForTimeout(200);
  const paused = await pixelSignature(page);
  await page.waitForTimeout(250);
  expect(await pixelSignature(page)).toBe(paused);
  await page.getByRole("button", { name: "关闭部位选择" }).click();
  await expect(page.locator(".body-3d-shell")).toHaveAttribute("data-motion", "rotating");
  const resumed = await pixelSignature(page);
  await expect.poll(() => pixelSignature(page)).not.toBe(resumed);
});

test("starts without playback controls even with reduced motion, and restores HUD disclosure", async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.setFixedTime(new Date("2026-06-21T12:00:00Z"));
  await page.goto("/");
  await expect(page.getByLabel("3D model status")).toContainText("Model ready", {
    timeout: 20_000
  });
  await expect(page.getByRole("button", { name: /暂停自动旋转|恢复自动旋转/ })).toHaveCount(0);
  await expect(page.locator(".body-3d-shell")).toHaveAttribute("data-motion", "rotating");
  // Motion has its own framebuffer test; freeze the visual review at the browser visibility gate.
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const card = page
    .locator(".body-hud-card")
    .filter({ has: page.getByRole("button", { name: "近 7 日训练详情" }) });
  const detail = card.locator(".body-hud-detail");
  await expect(detail).toBeHidden();
  for (const hud of await page.locator(".body-hud-card").all()) {
    await expect(hud).toHaveCSS("background-image", "none");
    await expect(hud).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
    await expect(hud).toHaveCSS("backdrop-filter", "none");
    expect(await hud.evaluate((el) => getComputedStyle(el, "::before").animationName)).toBe("none");
    await expect(hud).toHaveCSS("box-shadow", "none");
  }
  await page.screenshot({ path: testInfo.outputPath("hud-compact-desktop.png") });
  for (const hud of await page.locator(".body-hud-card").all()) {
    const summary = hud.locator(".body-hud-summary");
    const before = await summary.boundingBox();
    await summary.hover();
    await expect(hud.locator(".body-hud-detail")).toBeVisible();
    expect(await summary.boundingBox()).toEqual(before);
    const surface = hud.locator(".body-hud-surface");
    await expect(surface).toHaveCSS("backdrop-filter", "blur(20px) saturate(1.15)");
    const enclosure = (await surface.boundingBox())!;
    for (const content of [summary, hud.locator(".body-hud-detail")]) {
      const bounds = (await content.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(enclosure.x);
      expect(bounds.y).toBeGreaterThanOrEqual(enclosure.y);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(enclosure.x + enclosure.width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(enclosure.y + enclosure.height);
    }
    await expect(hud.locator(".body-hud-detail")).toHaveCSS("background-image", "none");
    await hud.locator(".body-hud-detail").hover();
    await expect(summary).toHaveAttribute("aria-expanded", "true");
    await page.screenshot({ path: testInfo.outputPath(`expanded-${await hud.getAttribute("aria-label")}.png`) });
    await page.mouse.move(0, 0);
    await expect(hud.locator(".body-hud-detail")).toBeHidden();
    expect(await summary.boundingBox()).toEqual(before);
  }
  await card.hover();
  await expect(detail).toBeVisible();
  await expect(detail.locator(".hud-records li")).toHaveCount(2);
  await expect(detail).toContainText("已记录时长");

  await page.screenshot({ path: testInfo.outputPath("hud-expanded-desktop.png") });
  await page.mouse.move(0, 0);
  await expect(detail).toBeHidden();
  const trigger = card.getByRole("button");
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(detail).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(detail).toBeHidden();
});

test("toggles glass HUD details by touch on a phone", async ({ browser }, testInfo) => {
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });
  const touchPage = await mobile.newPage();
  await touchPage.clock.setFixedTime(new Date("2026-06-21T12:00:00Z"));
  await touchPage.goto("http://127.0.0.1:5178/");
  await expect(touchPage.getByLabel("3D model status")).toContainText("Model ready", {
    timeout: 20_000
  });
  const touchTrigger = touchPage.getByRole("button", { name: "近 7 日训练详情" });
  await expect(touchTrigger).toHaveAttribute("aria-expanded", "false");
  await touchPage.screenshot({ path: testInfo.outputPath("hud-compact-mobile.png") });
  const before = await touchTrigger.boundingBox();
  await touchTrigger.tap();
  await expect(touchTrigger).toHaveAttribute("aria-expanded", "true");
  expect(await touchTrigger.boundingBox()).toEqual(before);
  await touchPage.screenshot({ path: testInfo.outputPath("hud-expanded-mobile.png") });
  await touchTrigger.tap();
  await expect(touchTrigger).toHaveAttribute("aria-expanded", "false");
  await mobile.close();
});

async function pixelSignature(page: Page) {
  return page.locator(".body-3d-shell canvas").evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) throw new Error("WebGL required for motion verification");
    const pixels = new Uint8Array(canvas.width * 4);
    gl.readPixels(
      0,
      Math.floor(canvas.height / 2),
      canvas.width,
      1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels
    );
    return pixels.reduce((hash, value) => (hash * 31 + value) | 0, 0);
  });
}
