import { expect, test } from "@playwright/test";

test("switches DOM and real body materials together while retaining the preview mode", async ({
  page
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/design-lab.html");
  await expect(page.getByRole("status")).toContainText("真实 GLB", { timeout: 20_000 });
  await page.getByRole("button", { name: "肌肉焦点", exact: true }).click();
  const canvas = page.locator("canvas");
  const image = await canvas.screenshot();
  await page.getByRole("button", { name: "Graphite / 无霓虹" }).click();
  await expect(page.getByRole("button", { name: "肌肉焦点", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(page.locator(".visual-lab")).toHaveCSS("background-color", "rgb(17, 19, 22)");
  await expect(page.locator(".specimens .primary")).toHaveCSS("box-shadow", "none");
  await expect.poll(async () => (await canvas.screenshot()).equals(image)).toBe(false);
  await page.getByRole("button", { name: "Neon / 青与洋红" }).click();
  await expect(page.locator(".specimens .primary")).not.toHaveCSS("box-shadow", "none");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: "动作预览", exact: true }).click();
  await expect(page.getByRole("heading", { name: "上肢推举 · 涉及部位" })).toBeVisible();
});

test("compares six opaque colors independently from glow and emission", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/design-lab.html");
  await expect(page.getByRole("status")).toContainText("真实 GLB", { timeout: 20_000 });
  await expect(page.locator(".swatch")).toHaveCount(6);
  await expect(page.locator(".specimens .focused")).toHaveCSS("color", "rgb(255, 71, 126)");
  await page.screenshot({
    path: "test-results/visual-regression/theme-lab/neon-desktop.png",
    fullPage: true
  });
  const canvas = page.locator("canvas");
  const strong = await canvas.screenshot();
  await page.getByLabel("青色色阶", { exact: true }).selectOption("muted");
  await page.getByRole("button", { name: "偏红洋红 · 中等饱和", exact: true }).click();
  await expect(page.locator(".specimens .primary")).toHaveCSS("color", "rgb(120, 157, 162)");
  await expect(page.locator(".specimens .focused")).toHaveCSS("color", "rgb(203, 113, 140)");
  await expect.poll(async () => (await canvas.screenshot()).equals(strong)).toBe(false);
  await page.getByLabel("控件光晕", { exact: true }).uncheck();
  await expect(page.locator(".specimens .primary")).toHaveCSS("box-shadow", "none");
  await expect(page.locator(".anti-example")).toHaveCSS("text-shadow", "none");
  const luminous = await canvas.screenshot();
  await page.getByLabel("重点肌肉自发光", { exact: true }).uncheck();
  await expect.poll(async () => (await canvas.screenshot()).equals(luminous)).toBe(false);
  await expect(page.locator(".specimens .primary")).toHaveCSS("color", "rgb(120, 157, 162)");
  await page.screenshot({
    path: "test-results/visual-regression/theme-lab/neon-no-glow-desktop.png",
    fullPage: true
  });
  await page.getByRole("button", { name: "Graphite / 无霓虹" }).click();
  await expect(page.getByLabel("青色色阶", { exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Neon / 青与洋红" }).click();
  await expect(page.getByLabel("青色色阶", { exact: true })).toHaveValue("muted");
  await expect(page.getByLabel("控件光晕", { exact: true })).not.toBeChecked();
  await expect(page.getByLabel("重点肌肉自发光", { exact: true })).not.toBeChecked();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByLabel("控件光晕", { exact: true }).check();
  await page.getByLabel("重点肌肉自发光", { exact: true }).check();
  await page.screenshot({
    path: "test-results/visual-regression/theme-lab/neon-mobile.png",
    fullPage: true
  });
});
