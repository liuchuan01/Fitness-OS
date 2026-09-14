import { chromium } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { parse } from "yaml";
import { buildDashboardProjection } from "../dist-server/shared/fitness/index.js";

// Run against the fixture service described in docs/design/VISUAL-REVIEW.md.
const output = process.env.VISUAL_OUTPUT ?? "test-results/visual-regression/style-review";
await mkdir(output, { recursive: true });
const fixture = async (path) => parse(await readFile(`tests/fixtures/data/${path}`, "utf8"));
const workouts = await Promise.all(
  ["2026-06-19", "2026-06-16"].map((date) => fixture(`workouts/2026/${date}.yaml`))
);
const projection = buildDashboardProjection({
  date: "2026-06-21",
  currentWorkout: workouts[0],
  recentWorkouts: workouts,
  muscleMap: await fixture("muscles/muscle_map.yaml"),
  stimulusRules: await fixture("muscles/stimulus_rules.yaml"),
  constraints: { lower_back_sensitive: true }
});
const browser = await chromium.launch({ headless: true });
try {
  for (const [name, width, height] of [
    ["desktop", 1440, 900],
    ["mobile", 390, 844]
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      reducedMotion: "reduce",
      isMobile: name === "mobile",
      hasTouch: name === "mobile"
    });
    await page.clock.setFixedTime(new Date("2026-06-21T12:00:00Z"));
    await page.route("**/api/dashboard", (route) =>
      route.fulfill({ json: { ok: true, projection } })
    );
    await page.addInitScript((themeId) => {
      globalThis.localStorage.setItem(
        "fitness:appearance:v1",
        JSON.stringify({ themeId, glowEnabled: true })
      );
    }, process.env.VISUAL_THEME ?? "neon");
    await page.goto("http://127.0.0.1:5173");
    await page
      .locator(".technical-status")
      .filter({ hasText: "Model ready" })
      .waitFor({ state: "attached" });
    await page.getByText("今天的身体状态").waitFor();
    // Freeze only the review browser through the existing background-page motion gate.
    await page.evaluate(() => {
      Object.defineProperty(globalThis.document, "hidden", { configurable: true, get: () => true });
      globalThis.document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.getByRole("button", { name: "重置视角" }).click();
    const capture = async (mode) => {
      await page.evaluate(() => globalThis.document.fonts.ready);
      await page.screenshot({ path: `${output}/${name}-${mode}.png` });
    };
    await capture("overview");
    const hud = page.getByRole("button", { name: "近 7 日训练详情" });
    if (name === "desktop") await hud.hover();
    else await hud.tap();
    await capture("hud-expanded");
    if (name === "desktop") await page.mouse.move(0, 0);
    else await hud.tap();
    for (const [label, shot] of [
      ["距上次训练详情", "last-workout"],
      ["力量训练详情", "strength"],
      ["肌群训练分布详情", "distribution"]
    ]) {
      const trigger = page.getByRole("button", { name: label, exact: true });
      if (name === "desktop") await trigger.hover();
      else await trigger.tap();
      await capture(shot);
      if (name === "desktop") await page.mouse.move(0, 0);
      else await trigger.tap();
    }
    await page.getByRole("button", { name: "选择肌肉", exact: true }).click();
    await capture("explorer");
    const explorer = page.getByRole("dialog", { name: "身体部位选择" });
    await explorer.getByRole("button", { name: "背部", exact: true }).click();
    await explorer.getByRole("button", { name: /背阔肌/ }).click();
    await page.getByRole("heading", { name: "背阔肌", exact: true }).waitFor();
    await page.getByText("以前怎么练的", { exact: true }).waitFor();
    await capture("focus");
    await page.getByLabel("相关动作选择").getByRole("button").first().click();
    await capture("exercise");
    await page.locator(".muscle-history-link").first().click();
    await page.locator('.exercise-card[aria-pressed="true"]').waitFor();
    await capture("day");
    await page.getByRole("button", { name: "配置后台", exact: true }).click();
    await page.getByRole("heading", { name: "界面外观" }).waitFor();
    await capture("settings");
    await page.close();
  }
  console.log(`视觉审阅截图：${output}（需人工审图，不是像素回归通过）`);
} finally {
  await browser.close();
}
