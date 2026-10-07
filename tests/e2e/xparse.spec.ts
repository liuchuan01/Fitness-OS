import { expect, test } from "@playwright/test";
import { modelPreferencesFixture } from "../fixtures/model-preferences";

test.beforeEach(async ({ page }) => {
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
});

test("file parsing gates paid permission and credentials, persists settings and retains drafts", async ({
  page
}) => {
  await page.goto("/#/settings?section=xparse");
  const enabled = page.getByRole("switch", { name: "启用文件解析" });
  const paid = page.getByRole("switch", { name: "允许使用付费解析" });
  await expect(page.getByRole("heading", { name: "TextIn xParse" })).toBeVisible();
  await enabled.uncheck();
  await expect(paid).toBeDisabled();
  await expect(page.getByLabel("TextIn App ID")).toHaveCount(0);
  await enabled.focus();
  await page.keyboard.press("Space");
  await expect(paid).toBeEnabled();
  await expect(page.getByLabel("TextIn App ID")).toHaveCount(0);
  await paid.focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "保存解析设置" }).click();
  await expect(page.getByText("文件解析已开启，从下一条对话起可用。")).toBeVisible();
  await page.reload();
  await expect(enabled).toBeChecked();
  await expect(paid).toBeChecked();
  await page.getByLabel("TextIn App ID").fill("test-app");
  await page.getByLabel("TextIn Secret Code").fill("test-secret");
  await paid.uncheck();
  await expect(page.getByLabel("TextIn Secret Code")).toHaveCount(0);
  await paid.check();
  await page.getByRole("button", { name: "教练偏好", exact: true }).click();
  await page.getByRole("button", { name: "文件解析", exact: true }).click();
  await expect(page.getByLabel("TextIn Secret Code")).toHaveValue("test-secret");
  await page.getByRole("button", { name: "保存 TextIn 凭据" }).click();
  await expect(page.getByText("已配置 TextIn 凭据", { exact: true })).toBeVisible();
  await expect(page.getByLabel("TextIn Secret Code")).toHaveValue("");
  await enabled.uncheck();
  await expect(paid).not.toBeChecked();
  await expect(paid).toBeDisabled();
  await page.getByRole("button", { name: "保存解析设置" }).click();
  await expect(page.getByText("文件解析已关闭，已保存的凭据保留。")).toBeVisible();
  await page.reload();
  await expect(enabled).not.toBeChecked();
  await expect(paid).not.toBeChecked();
  await expect(page.getByLabel("TextIn App ID")).toHaveCount(0);
  await enabled.check();
  await expect(paid).not.toBeChecked();
  await paid.check();
  await expect(page.getByText("已配置 TextIn 凭据", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "清除凭据" }).click();
  await expect(page.getByText("尚未配置 TextIn 凭据", { exact: true })).toBeVisible();
});

for (const theme of ["Neon", "Graphite", "Orbital"]) {
  test(`file parsing progressive settings fit ${theme} on desktop and mobile`, async ({
    page
  }, testInfo) => {
    await page.route("**/api/xparse/settings", (route) =>
      route.fulfill({
        json: {
          ok: true,
          settings: { enabled: false, allowPaid: false }
        }
      })
    );
    await page.goto("/#/settings");
    await page.getByRole("radio", { name: new RegExp(theme) }).check();
    await page.getByRole("button", { name: "文件解析", exact: true }).click();
    await expect(page.getByRole("link", { name: "了解 TextIn" })).toHaveAttribute(
      "href",
      "https://github.com/intsig-textin"
    );
    const enabled = page.getByRole("switch", { name: "启用文件解析" });
    const paid = page.getByRole("switch", { name: "允许使用付费解析" });
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
      await enabled.uncheck();
      for (const state of ["off", "free", "paid"]) {
        if (state === "free") await enabled.check();
        if (state === "paid") await paid.check();
        await expect(page.locator(".settings-card:visible")).toHaveCount(1);
        expect(
          await page.locator(".settings-page").evaluate((el) => el.scrollWidth <= el.clientWidth)
        ).toBe(true);
        await expect(page.getByLabel("TextIn App ID")).toHaveCount(state === "paid" ? 1 : 0);
        await page.locator(".settings-page").evaluate((el) => el.scrollTo(0, 0));
        await page.screenshot({
          path: testInfo.outputPath(`xparse-${theme}-${width}-${state}.png`),
          fullPage: true
        });
        if (state === "paid" && width < 768) {
          await page.getByRole("button", { name: "保存 TextIn 凭据" }).scrollIntoViewIfNeeded();
          await page.screenshot({
            path: testInfo.outputPath(`xparse-${theme}-${width}-credentials.png`)
          });
        }
      }
    }
  });
}
