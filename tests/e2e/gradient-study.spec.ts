import { expect, test } from "@playwright/test";

test("gradient study compares candidates without loading body or saving preferences", async ({
  page
}, testInfo) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/design-lab.html?study=gradient");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("从冷静的青");
  await expect(page.locator(".gradient-option")).toHaveCount(3);
  await expect(page.locator(".gradient-swatch")).toHaveCount(7);
  for (const index of [0, 1, 2]) {
    await page.locator(".gradient-option").nth(index).click();
    await expect(page.locator(".gradient-option").nth(index)).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await page.getByRole("slider").fill("0");
    await expect(page.locator("output")).toHaveText("#00E5FF");
    await page.getByRole("slider").fill("100");
    await expect(page.locator("output")).toHaveText("#FF477E");
    await page.getByRole("slider").fill("50");
    await page.screenshot({ path: testInfo.outputPath(`desktop-${index}.png`), fullPage: true });
  }
  await page.locator(".gradient-option").first().click();
  await page.getByRole("slider").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("slider")).toHaveValue("51");
  await page.getByRole("button", { name: "预览色阶 7", exact: true }).click();
  await expect(page.locator("output")).toHaveText("#FF477E");
  await page.getByRole("slider").fill("50");
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width
    );
    await page.screenshot({ path: testInfo.outputPath(`mobile-${width}.png`), fullPage: true });
  }
  await expect(page.locator("canvas")).toHaveCount(0);
  expect(requests.some((url) => /\/api\/|\.glb(?:\?|$)/.test(url))).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem("fitness:appearance:v1"))).toBeNull();
});
