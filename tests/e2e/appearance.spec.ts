import { modelPreferencesFixture } from "../fixtures/model-preferences";
import { expect, test, type Page } from "@playwright/test";

const appearanceKey = "fitness:appearance:v1";
async function mockCredentials(page: Page) {
  await page.route("**/api/model/preferences", (route) =>
    route.fulfill({ json: { ok: true, preferences: modelPreferencesFixture() } })
  );
  await page.route("**/api/model/settings", (route) =>
    route.fulfill({
      json: {
        ok: true,
        settings: { provider: "DeepSeek", configured: true, writable: true }
      }
    })
  );
}
async function openSection(page: Page, title: string) {
  await page
    .getByRole("navigation", { name: "设置分类" })
    .getByRole("button", { name: title, exact: true })
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
  await openSection(page, "界面外观");
  await expect(page.getByRole("checkbox", { name: "强调光效" })).toHaveCount(0);
  await expect(page.getByLabel("模型提供方")).toHaveCount(0);
  await expect(page.getByLabel("模型名称")).toHaveCount(0);
  await page.getByRole("radio", { name: /Graphite/ }).check();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "graphite");
  await openSection(page, "界面外观");
  await page.getByRole("radio", { name: /Neon/ }).check();
  await page.getByRole("button", { name: "返回训练首页" }).click();
  await expect(page.getByLabel("3D model status")).toContainText("Model ready", { timeout: 20000 });
  await expect(page.locator("html")).toHaveAttribute("data-glow", "on");
});

test("settings sections fit desktop and narrow screens in both themes", async ({
  page
}, testInfo) => {
  await mockCredentials(page);
  await page.goto("/#/settings");
  for (const theme of ["Neon", "Graphite"]) {
    await openSection(page, "界面外观");
    await page.getByRole("radio", { name: new RegExp(theme) }).check();
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
      for (const section of ["界面外观", "教练偏好", "自动计划", "模型连接"]) {
        await openSection(page, section);
        await expect(page.locator(".settings-card:visible")).toHaveCount(1);
        expect(
          await page.locator(".settings-page").evaluate((el) => el.scrollWidth <= el.clientWidth)
        ).toBe(true);
        await page.locator(".settings-page").evaluate((el) => el.scrollTo(0, 0));
        await page.screenshot({ path: testInfo.outputPath(`${theme}-${width}-${section}.png`) });
      }
    }
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  const appearance = page.getByRole("button", { name: "界面外观", exact: true });
  await appearance.focus();
  await page.keyboard.press("Enter");
  await expect(appearance).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("radio", { name: /Graphite/ })).toBeVisible();
  await expect(page.getByLabel("DeepSeek API Key")).toBeHidden();
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
  await openSection(page, "教练偏好");
  await page.getByRole("textbox", { name: "教练指令", exact: true }).fill("请简洁地解释训练建议。");
  await openSection(page, "自动计划");
  await page.getByLabel("本地时间").fill("10:30");
  await openSection(page, "教练偏好");
  await page.getByRole("button", { name: "保存教练指令" }).click();
  await expect(page.getByText("教练指令已保存。", { exact: true })).toBeVisible();
  await openSection(page, "自动计划");
  await expect(page.getByLabel("本地时间")).toHaveValue("10:30");
  await openSection(page, "教练偏好");
  await page.getByRole("textbox", { name: "教练指令", exact: true }).fill("另一份尚未保存的指令");
  await openSection(page, "自动计划");
  await page.getByRole("button", { name: "保存自动计划" }).click();
  await expect(page.getByText("自动计划设置已保存。", { exact: true })).toBeVisible();
  await openSection(page, "教练偏好");
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

test("credential link opens connection and section switching retains key draft", async ({
  page
}) => {
  await mockCredentials(page);
  await page.goto("/#/settings?section=connection");
  const input = page.getByLabel("DeepSeek API Key");
  await expect(input).toBeVisible();
  await input.fill("test-only-unsaved");
  await openSection(page, "界面外观");
  await expect(input).toBeHidden();
  await openSection(page, "模型连接");
  await expect(input).toHaveValue("test-only-unsaved");
  await page.getByRole("button", { name: "返回训练首页" }).click();
  await expect(page.getByLabel("Body dashboard")).toBeVisible();
});

test("model preferences use live capabilities and persist independently of credentials", async ({
  page
}) => {
  await mockCredentials(page);
  let preferences = modelPreferencesFixture();
  await page.route("**/api/model/preferences", async (route) => {
    if (route.request().method() === "PUT") {
      const { revision, ...selection } = route.request().postDataJSON();
      expect(revision).toBe(preferences.revision);
      preferences = { ...preferences, selection, revision: revision + 1 };
    }
    await route.fulfill({ json: { ok: true, preferences } });
  });
  await page.goto("/#/settings?section=connection");
  await page.getByLabel("DeepSeek API Key").fill("test-only-unsaved-key");
  await page.getByLabel("默认模型", { exact: true }).selectOption({ label: "DSH 测试 Pro" });
  await expect(page.getByLabel("思考强度").locator("option")).toHaveText([
    "模型默认（低）",
    "低",
    "最高"
  ]);
  await page.getByLabel("思考强度").selectOption("max");
  await openSection(page, "教练偏好");
  await openSection(page, "模型连接");
  await expect(page.getByLabel("思考强度")).toHaveValue("max");
  await page.getByRole("button", { name: "保存模型设置", exact: true }).click();
  await expect(page.getByText(/默认模型已保存/)).toBeVisible();
  await expect(page.getByLabel("DeepSeek API Key")).toHaveValue("test-only-unsaved-key");
  await page.reload();
  await expect(page.getByLabel("思考强度")).toHaveValue("max");
  await page.getByLabel("默认模型", { exact: true }).selectOption({ label: "DSH 测试 Plain" });
  await expect(page.getByLabel("思考强度")).toBeDisabled();
  await page.getByRole("button", { name: "保存模型设置", exact: true }).click();
  await expect(page.getByText(/默认模型已保存/)).toBeVisible();
  expect(preferences.selection.reasoningEffort).toBeUndefined();
});
