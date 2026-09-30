import { expect, test, type Page } from "@playwright/test";

test("selects an actual model mesh into the same history panel", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("3D model status")).toContainText("Model ready", {
    timeout: 20_000
  });
  const canvas = page.locator(".body-3d-shell canvas");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  for (const [x, y] of [
    [0.5, 0.35],
    [0.48, 0.42],
    [0.54, 0.53],
    [0.46, 0.63]
  ]) {
    await page.mouse.click(box!.x + box!.width * x, box!.y + box!.height * y);
    if (await page.getByLabel("肌肉训练档案", { exact: true }).count()) break;
  }
  await expect(page.locator(".body-3d-shell")).toHaveAttribute("data-motion", "paused");
  await expect(page.getByLabel("肌肉训练档案", { exact: true })).toContainText("以前怎么练的");
  await page.getByRole("button", { name: "清除选择" }).click();
  await expect(page.getByLabel("肌肉训练档案", { exact: true })).toHaveCount(0);
});

test("opens history from the body, previews related actions and locates an actual workout", async ({
  page
}, testInfo) => {
  await page.goto("/");
  await expect(page.getByLabel("3D model status")).toContainText("Model ready", {
    timeout: 20_000
  });
  await chooseMuscle(page, "背部", "背阔肌");
  const history = page.getByLabel("肌肉训练档案", { exact: true });
  await expect(history.getByRole("heading", { name: "背阔肌", exact: true })).toBeVisible();
  await expect(history.getByText("2026-06-19", { exact: true }).first()).toBeVisible();
  await expect(page.locator(".canvas-context")).toContainText("背阔肌");
  await expect(page.locator(".canvas-context")).not.toContainText("刺激");
  await expect(page.locator(".selection-panel")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("muscle-history-desktop.png") });
  const related = page.getByLabel("相关动作选择").getByRole("button").first();
  await related.click();
  await expect(related).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".body-projection-label")).toContainText("非刺激评分");
  await history.locator(".muscle-history-link").first().click();
  await expect(page.locator('.exercise-card[aria-pressed="true"]')).toContainText("引体向上");
  await expect(page.locator('.exercise-card[aria-pressed="true"]')).toBeInViewport();
  await chooseMuscle(page, "背部", "背阔肌");
  await expect(history).toContainText("截至 2026-06-19");
  await expect(page.getByLabel("肌肉近七日统计")).toContainText("2026-06-13 — 2026-06-19");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(history).toBeVisible();
  const sheet = await page.getByLabel("Training insights").boundingBox();
  expect(sheet!.height).toBeLessThanOrEqual(844 * 0.49);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath("muscle-history-mobile.png") });
  await page.getByRole("button", { name: "关闭详情" }).click();
  await expect(page.getByRole("button", { name: "选择肌肉" })).toContainText("切换身体部位");
  await page.getByRole("button", { name: "肌肉训练档案 背阔肌" }).click();
  await expect(history.getByRole("heading", { name: "背阔肌", exact: true })).toBeVisible();
});

test("keeps empty data and failed queries distinct and permits retry", async ({ page }) => {
  await page.goto("/");
  await chooseMuscle(page, "颈部", "胸锁乳突肌");
  const history = page.getByLabel("肌肉训练档案", { exact: true });
  await expect(history).toContainText("没有关联力量训练记录");
  await page.route("**/api/muscles/latissimus_dorsi?*", (route) =>
    route.fulfill({ status: 503, json: { ok: false } })
  );
  await chooseMuscle(page, "背部", "背阔肌");
  await expect(history.getByRole("alert")).toContainText("暂时不可用");
  await page.unroute("**/api/muscles/latissimus_dorsi?*");
  await page.getByRole("button", { name: "重新加载" }).click();
  await expect(history).toContainText("以前怎么练的");
});

async function chooseMuscle(page: Page, region: string, muscle: string) {
  await page.getByRole("button", { name: "选择肌肉", exact: true }).click();
  await page
    .getByRole("dialog", { name: "身体部位选择" })
    .getByRole("button", { name: region, exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "身体部位选择" })
    .getByRole("button", { name: new RegExp(muscle) })
    .click();
}
