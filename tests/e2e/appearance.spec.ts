import { expect, test, type Page } from "@playwright/test";

const appearanceKey = "fitness:appearance:v1";
async function mockCredentials(page: Page) {
  await page.route("**/api/model/settings", (route) =>
    route.fulfill({
      json: {
        ok: true,
        settings: { provider: "DeepSeek", configured: true, writable: true }
      }
    })
  );
}
async function openCard(page: Page, title: string) {
  await page
    .locator("summary")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) })
    .click();
}

test("appearance lives only in settings, persists theme and migrates disabled glow", async ({
  page
}) => {
  await mockCredentials(page);
  await page.goto("/");
  await page.evaluate(
    (key) => localStorage.setItem(key, JSON.stringify({ themeId: "neon", glowEnabled: false })),
    appearanceKey
  );
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-glow", "on");
  await expect(page.getByRole("button", { name: "外观主题", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "配置后台", exact: true }).click();
  await openCard(page, "界面外观");
  await expect(page.getByRole("checkbox", { name: "强调光效" })).toHaveCount(0);
  await expect(page.getByLabel("模型提供方")).toHaveCount(0);
  await expect(page.getByLabel("模型名称")).toHaveCount(0);
  await page.getByRole("radio", { name: /Graphite/ }).check();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "graphite");
  await openCard(page, "界面外观");
  await page.getByRole("radio", { name: /Neon/ }).check();
  await page.getByRole("button", { name: "返回训练首页" }).click();
  await expect(page.getByLabel("3D model status")).toContainText("Model ready", { timeout: 20000 });
  await expect(page.locator("html")).toHaveAttribute("data-glow", "on");
});

test("card settings fit desktop and narrow screens in both themes", async ({ page }, testInfo) => {
  await mockCredentials(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/settings");
  await expect(page.getByRole("heading", { name: "自动计划", exact: true })).toBeVisible();
  await expect(page.locator("summary").filter({ hasText: "CONNECTION" })).toContainText(
    "密钥已配置"
  );
  await page.screenshot({ path: testInfo.outputPath("desktop-cards.png") });
  await openCard(page, "界面外观");
  await openCard(page, "教练指令");
  await openCard(page, "自动计划");
  for (const theme of ["Neon", "Graphite"]) {
    await page.getByRole("radio", { name: new RegExp(theme) }).check();
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
      expect(
        await page.locator(".settings-page").evaluate((el) => el.scrollWidth <= el.clientWidth)
      ).toBe(true);
      await page.locator(".settings-page").evaluate((el) => el.scrollTo(0, 0));
      await page.screenshot({ path: testInfo.outputPath(`${theme}-${width}.png`) });
    }
  }
  const summary = page.locator("summary").filter({ hasText: "APPEARANCE" });
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("radio", { name: /Graphite/ })).not.toBeVisible();
});

test("saving coach settings leaves schedule draft intact and vice versa", async ({ page }) => {
  await mockCredentials(page);
  // Keep writes local to this browser so parallel fixture readers are unaffected.
  for (const [path, field] of [
    ["agent/settings", "settings"],
    ["automation/schedule", "schedule"]
  ]) {
    await page.route(`**/api/${path}`, (route) =>
      route.request().method() === "PUT"
        ? route.fulfill({ json: { ok: true, [field]: route.request().postDataJSON() } })
        : route.continue()
    );
  }
  await page.goto("/#/settings");
  await expect(page.getByRole("heading", { name: "自动计划", exact: true })).toBeVisible();
  await openCard(page, "教练指令");
  await openCard(page, "自动计划");
  await page.getByRole("textbox", { name: "教练指令", exact: true }).fill("请简洁地解释训练建议。");
  await page.getByLabel("本地时间").fill("10:30");
  await page.getByRole("button", { name: "保存教练指令" }).click();
  await expect(page.getByText("教练指令已保存。", { exact: true })).toBeVisible();
  await expect(page.getByLabel("本地时间")).toHaveValue("10:30");
  await page.getByRole("textbox", { name: "教练指令", exact: true }).fill("另一份尚未保存的指令");
  await page.getByRole("button", { name: "保存自动计划" }).click();
  await expect(page.getByText("自动计划设置已保存。", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "教练指令", exact: true })).toHaveValue(
    "另一份尚未保存的指令"
  );
});

test("invalid stored themes fall back to Neon", async ({ page }) => {
  await page.goto("/");
  for (const raw of ["{invalid", JSON.stringify({ themeId: "unknown", glowEnabled: false })]) {
    await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), {
      key: appearanceKey,
      raw
    });
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "neon");
    await expect(page.locator("html")).toHaveAttribute("data-glow", "on");
  }
});
