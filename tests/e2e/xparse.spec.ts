import { expect, test } from "@playwright/test";
import { modelPreferencesFixture } from "../fixtures/model-preferences";

test("file parsing settings persist, keep drafts, and fit all themes on desktop and mobile", async ({
  page
}, testInfo) => {
  await page.route("**/api/model/settings", (route) =>
    route.fulfill({
      json: { ok: true, settings: { provider: "DeepSeek", configured: false, writable: true } }
    })
  );
  await page.route("**/api/model/preferences", (route) =>
    route.fulfill({ json: { ok: true, preferences: modelPreferencesFixture() } })
  );
  let configured = false;
  await page.route("**/api/xparse/credentials", (route) => {
    if (route.request().method() === "PUT")
      configured = route.request().postDataJSON().clear !== true;
    return route.fulfill({ json: { ok: true, credentials: { configured, writable: true } } });
  });
  await page.goto("/#/settings?section=xparse");
  await expect(page.getByRole("heading", { name: "TextIn xParse" })).toBeVisible();
  await page.getByRole("checkbox", { name: /启用文件解析/ }).check();
  await page.getByRole("button", { name: "保存解析设置" }).click();
  await expect(page.getByText("文件解析已开启，从下一条对话起可用。")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: /启用文件解析/ })).toBeChecked();
  await page.getByLabel("TextIn App ID").fill("test-app");
  await page.getByLabel("TextIn Secret Code").fill("test-secret");
  await page.getByRole("button", { name: "教练偏好", exact: true }).click();
  await page.getByRole("button", { name: "文件解析", exact: true }).click();
  await expect(page.getByLabel("TextIn Secret Code")).toHaveValue("test-secret");
  await page.getByRole("button", { name: "保存 TextIn 凭据" }).click();
  await expect(page.getByText("已配置 TextIn 凭据", { exact: true })).toBeVisible();
  await expect(page.getByLabel("TextIn Secret Code")).toHaveValue("");
  for (const theme of ["Neon", "Graphite", "Orbital"]) {
    await page.getByRole("button", { name: "界面外观", exact: true }).click();
    await page.getByRole("radio", { name: new RegExp(theme) }).check();
    await page.getByRole("button", { name: "文件解析", exact: true }).click();
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
      await expect(page.locator(".settings-card:visible")).toHaveCount(1);
      expect(
        await page.locator(".settings-page").evaluate((el) => el.scrollWidth <= el.clientWidth)
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(`xparse-${theme}-${width}.png`),
        fullPage: true
      });
      await page.getByRole("button", { name: "保存 TextIn 凭据" }).scrollIntoViewIfNeeded();
      await page.screenshot({
        path: testInfo.outputPath(`xparse-${theme}-${width}-credentials.png`)
      });
      await page.locator(".settings-page").evaluate((el) => el.scrollTo(0, 0));
    }
  }
  await page.getByRole("checkbox", { name: /启用文件解析/ }).uncheck();
  await page.getByRole("button", { name: "保存解析设置" }).click();
  await expect(page.getByText("文件解析已关闭，已保存的凭据保留。")).toBeVisible();
  await expect(page.getByText("已配置 TextIn 凭据", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "清除凭据" }).click();
  await expect(page.getByText("尚未配置 TextIn 凭据", { exact: true })).toBeVisible();
});
