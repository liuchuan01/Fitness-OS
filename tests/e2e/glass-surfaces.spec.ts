import { expect, test, type Locator } from "@playwright/test";

async function expectGlass(card: Locator) {
  await expect(card).toBeVisible();
  const surface = await card.evaluate((el) => {
    const material = getComputedStyle(el);
    const edge = getComputedStyle(el, "::before");
    return {
      blur: material.backdropFilter,
      background: material.backgroundImage,
      edge: edge.backgroundImage,
      hit: edge.pointerEvents
    };
  });
  expect(surface.blur).toContain("blur(");
  expect(surface.background).toContain("gradient");
  expect(surface.edge).toContain("conic-gradient");
  expect(surface.hit).toBe("none");
}

test("shared glass covers onboarding, credential notice, explorer and all HUDs", async ({
  page
}, testInfo) => {
  await page.clock.setFixedTime(new Date("2026-06-21T12:00:00Z"));
  await page.route("**/api/dashboard", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    Object.assign(data.projection, {
      date: "2026-06-21",
      hasTrainingData: false,
      lastWorkoutDate: null,
      daysSinceLastWorkout: null,
      weeklyTrainingSessions: 0,
      weeklyTrainingMinutes: 0,
      weeklyStrengthSets: 0,
      weeklyAverageRpe: null,
      muscleSetDistribution: [],
      recentWorkouts: [],
      coachInsight: "完成首次训练后，开始积累身体档案。"
    });
    await route.fulfill({ json: data });
  });
  await page.route("**/api/workouts", (route) =>
    route.fulfill({ json: { ok: true, timeline: [] } })
  );
  await page.route("**/api/onboarding", (route) =>
    route.fulfill({
      json: {
        stage: "empty",
        profileStatus: "missing",
        hasProgram: false,
        hasPlan: false,
        hasDraft: false,
        profileConfirmed: false,
        profileRevision: null,
        activeProgramId: null,
        firstPlanDate: null,
        hasWorkout: false
      }
    })
  );
  await page.route("**/api/model/settings", (route) =>
    route.fulfill({
      json: {
        ok: true,
        settings: { provider: "DeepSeek", configured: false, writable: true }
      }
    })
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByLabel("3D model status")).toContainText("Model ready", { timeout: 20000 });
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.getByRole("button", { name: "重置视角" }).click();
  await expectGlass(page.locator(".dashboard-empty"));
  for (const card of await page.locator(".body-hud-card").all()) await expectGlass(card);
  await expectGlass(page.getByRole("button", { name: "选择肌肉", exact: true }));
  await page.screenshot({ path: testInfo.outputPath("onboarding-desktop.png") });
  await page.getByRole("button", { name: "建立我的训练档案" }).click();
  await expectGlass(page.locator(".agent-config-notice"));
  await page.screenshot({ path: testInfo.outputPath("credentials-desktop.png") });
  await page.getByRole("button", { name: "关闭配置提示" }).click();
  await page.getByRole("button", { name: "选择肌肉", exact: true }).click();
  await expectGlass(page.getByRole("dialog", { name: "身体部位选择" }));
  await expect(page.locator(".dashboard-empty")).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath("explorer-desktop.png") });
  await page.keyboard.press("Escape");
  await expect(page.locator(".dashboard-empty")).toBeVisible();
  await expect(page.getByRole("button", { name: "选择肌肉", exact: true })).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath("onboarding-mobile.png") });
  await page.getByRole("button", { name: "建立我的训练档案" }).click();
  await expectGlass(page.locator(".agent-config-notice"));
  await page.screenshot({ path: testInfo.outputPath("credentials-mobile.png") });
  await page.getByRole("button", { name: "关闭配置提示" }).click();
  await page.getByRole("button", { name: "选择肌肉", exact: true }).click();
  await expectGlass(page.getByRole("dialog", { name: "身体部位选择" }));
  await expect(page.locator(".dashboard-empty")).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath("explorer-mobile.png") });
});
