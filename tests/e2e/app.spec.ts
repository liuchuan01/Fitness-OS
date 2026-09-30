import { expect, test } from "@playwright/test";

test("opens the stage zero application shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByLabel("Workout timeline")).toBeVisible();
  await expect(page.getByLabel("Body dashboard")).toBeVisible();
  await expect(page.getByLabel("Training insights")).toBeVisible();
  await expect(page.getByText("今天的身体状态")).toBeVisible();
  await expect(page.getByText("距上次训练").first()).toBeVisible();
  await expect(page.getByLabel("首页身体数据")).toBeVisible();
  await expect(page.getByText("近 7 日训练", { exact: true })).toBeVisible();
  await expect(page.getByText("力量训练", { exact: true })).toBeVisible();
  // Fixture workouts can fall outside the rolling seven-day window.
  await expect(page.getByRole("region", { name: "肌群训练分布", exact: true })).toContainText(
    /组|暂无力量记录/
  );
});

test("edits coach instructions and automation in the configuration page", async ({ page }) => {
  await page.route("**/api/model/settings", (route) =>
    route.fulfill({
      json: { ok: true, settings: { provider: "DeepSeek", configured: true, writable: true } }
    })
  );
  await page.goto("/");
  await page.getByRole("button", { name: "配置后台" }).click();

  await expect(page.getByRole("region", { name: "配置后台", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "教练偏好" }).click();
  await expect(page.getByRole("textbox", { name: "教练指令", exact: true })).toHaveValue(
    /健身教练/
  );
  await page.getByRole("button", { name: "自动计划", exact: true }).click();
  await expect(page.getByText("每日自动计划", { exact: true })).toBeVisible();
});

test("opens the Agent conversation over the body canvas", async ({ page }) => {
  test.setTimeout(60_000);
  await page.route("**/api/model/settings", (route) =>
    route.fulfill({
      json: { ok: true, settings: { provider: "DeepSeek", configured: true, writable: true } }
    })
  );
  await page.route("**/api/dsh-web", async (route) => {
    await route.fulfill({
      json: {
        ok: true,
        status: "ready",
        url: "http://127.0.0.1:3080/?token=visual-test"
      }
    });
  });
  await page.route("http://127.0.0.1:3080/**", async (route) => {
    await route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><html><head><meta charset='utf-8'></head><body style='margin:0;background:#11151d;color:#dce7f1;font:14px sans-serif'><main aria-label='DSH official chat' style='display:grid;place-items:center;height:100vh'><div><button>新会话</button><button aria-label='收起 Agent 对话'>收起</button><br><br>DSH 官方会话<br><br><textarea aria-label='Message DSH'></textarea></div></main><script>let origin='';addEventListener('message',e=>{if(e.source===parent&&e.data?.v===1&&e.data?.type==='fitness.surface.connect'){origin=e.origin;parent.postMessage({v:1,type:'fitness.surface.ready'},origin)}});document.querySelector('button[aria-label]').onclick=()=>parent.postMessage({v:1,type:'fitness.surface.collapse'},origin)</script></body></html>"
    });
  });

  await page.goto("/");
  const launcher = page.getByRole("button", { name: /和训练 Agent 对话/ });
  await expect(launcher).toBeVisible();
  const composerBox = await launcher.boundingBox();
  const lowerHud = page.getByRole("region", { name: "力量训练", exact: true });
  const stimulusHud = page.getByRole("region", { name: "肌群训练分布", exact: true });
  await expect(lowerHud).toBeVisible();
  await expect(stimulusHud).toBeVisible();
  const lowerHudBox = await lowerHud.boundingBox();
  const stimulusHudBox = await stimulusHud.boundingBox();
  expect(composerBox).not.toBeNull();
  expect(lowerHudBox).not.toBeNull();
  expect(stimulusHudBox).not.toBeNull();
  expect(boxesOverlap(composerBox, lowerHudBox)).toBe(false);
  expect(boxesOverlap(composerBox, stimulusHudBox)).toBe(false);
  await page.screenshot({
    path: "test-results/visual-regression/agent-chat-collapsed-desktop.png",
    fullPage: true
  });
  await launcher.click();
  await expect(page.getByLabel("训练 Agent 对话")).toBeVisible();
  await expect(page.getByTitle("训练 Agent 会话")).toBeVisible();
  await expect(page.getByLabel("Interactive 3D body")).toBeVisible();
  const chatBox = await page.getByLabel("训练 Agent 对话").boundingBox();
  const bodyBox = await page.getByLabel("Body dashboard").boundingBox();
  const timelineBox = await page.getByLabel("Workout timeline").boundingBox();
  const insightsBox = await page.getByLabel("Training insights").boundingBox();
  expect(chatBox).toEqual(bodyBox);
  expect(boxesOverlap(chatBox, timelineBox)).toBe(false);
  expect(boxesOverlap(chatBox, insightsBox)).toBe(false);

  const agentFrame = page.frameLocator('iframe[title="训练 Agent 会话"]');
  await expect(agentFrame.getByRole("button", { name: "新会话" })).toBeVisible();
  await expect(agentFrame.getByRole("button", { name: "收起 Agent 对话" })).toHaveText("收起");
  await page.screenshot({
    path: "test-results/visual-regression/agent-chat-desktop.png",
    fullPage: true
  });

  await expect(page.getByRole("button", { name: "旋转身体", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("首页身体数据")).toBeVisible();
  await expect(page.getByLabel("首页身体数据")).toHaveCSS("opacity", "0.4");

  const composer = agentFrame.getByLabel("Message DSH");
  await composer.fill("保留这份未发送草稿");
  await agentFrame.getByRole("button", { name: "收起 Agent 对话" }).click();
  await expect(launcher).toBeFocused();
  await launcher.click();
  await expect(composer).toHaveValue("保留这份未发送草稿");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel("训练 Agent 对话")).toBeVisible();
  await expect(page.getByLabel("Interactive 3D body")).toBeVisible();
  await page.screenshot({
    path: "test-results/visual-regression/agent-chat-mobile.png",
    fullPage: true
  });
});

function boxesOverlap(
  left: { x: number; y: number; width: number; height: number } | null,
  right: { x: number; y: number; width: number; height: number } | null
) {
  if (!left || !right) return false;
  return !(
    left.x + left.width <= right.x ||
    right.x + right.width <= left.x ||
    left.y + left.height <= right.y ||
    right.y + right.height <= left.y
  );
}

test("searches timeline and opens a daily workout with exercise highlighting", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "展开训练时间线" }).click();
  await expect(page.getByRole("button", { name: /Pull Day/ })).toBeVisible();
  await page.getByLabel("Search workouts").fill("分腿蹲");
  await expect(page.getByRole("button", { name: /Lower Body/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Pull Day/ })).toHaveCount(0);

  await page.getByLabel("Search workouts").fill("");
  await page.getByRole("button", { name: /Pull Day/ }).click();
  await expect(page.getByRole("button", { name: "收起训练时间线" })).toBeVisible();
  await expect(page.getByLabel("Search workouts")).toBeVisible();
  await expect(page.getByText("Daily Workout · 2026-06-19")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pull Day / 引体向上强化" })).toBeVisible();
  await expect(page.getByText("当天没有训练记录")).toHaveCount(0);
  const exercise = page.locator(".exercise-card").filter({ hasText: "引体向上" });
  await expect(exercise).toBeVisible();

  const viewportHeight = page.viewportSize()?.height ?? 720;
  const shellBox = await page.locator(".shell").boundingBox();
  const bodyBox = await page.getByLabel("Body dashboard").boundingBox();
  expect(shellBox?.height).toBeLessThanOrEqual(viewportHeight);
  expect(bodyBox?.height).toBeLessThanOrEqual(viewportHeight - 60);

  const insights = page.getByLabel("Training insights");
  const scrollState = await insights.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight
  }));
  expect(scrollState.scrollHeight).toBeGreaterThan(scrollState.clientHeight);
  await insights.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect.poll(() => insights.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  await exercise.click();
  await expect(exercise).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Exercise", { exact: true }).first()).toBeVisible();
  await expect(page.getByLabel("3D model status")).toContainText("Model ready", {
    timeout: 20_000
  });
  await expect(page.getByLabel("3D model status")).toContainText("已聚焦");
  await expect(exercise).toContainText("背阔肌");
  await expect(page.locator(".selection-panel")).toHaveCount(0);
  await page.screenshot({
    path: "test-results/visual-regression/daily-workout-desktop.png",
    fullPage: true
  });
});

test("shows a recovery-day empty state for a date without a workout", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "展开训练时间线" }).click();
  const today = page.getByRole("button", { name: /今天/ });
  await expect(today).toBeVisible();
  await expect(today).not.toContainText("加载中");
  await today.click();
  await expect(page.getByText("当天没有训练记录")).toBeVisible();
});

test("opens the dedicated today plan and copies the complete plan", async ({
  context,
  page,
  baseURL
}, testInfo) => {
  await page.route("**/api/plans/today*", async (route) => {
    const response = await route.fetch({ url: new URL("/api/plans/2026-06-20", baseURL).href });
    await route.fulfill({ response });
  });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: baseURL
  });
  await page.goto("/");

  await page.getByRole("button", { name: "查看完整计划" }).click();

  await expect(page.getByLabel("今日计划详情")).toBeVisible();
  const firstExercise = page.locator(".plan-detail-exercise h3").first();
  const firstSet = page.locator(".plan-set-list strong").first();
  await expect(firstExercise).toBeVisible();
  await expect(firstSet).toBeVisible();
  const exerciseName = (await firstExercise.textContent()) ?? "";
  const setSummary = (await firstSet.textContent()) ?? "";

  await page.getByRole("button", { name: "复制今日计划" }).click();
  await expect(page.getByText("已复制，可直接粘贴")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain(exerciseName);
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain(setSummary);

  await page.screenshot({
    path: testInfo.outputPath("today-plan-desktop.png"),
    animations: "disabled"
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "已复制" })).toBeVisible();
  // A closed desktop rail must disappear immediately when it becomes a mobile drawer.
  await expect(page.getByLabel("Workout timeline")).toBeHidden();
  const planHeading = page.locator(".plan-document-header h1");
  await expect(planHeading).toBeInViewport();
  expect(
    await planHeading.evaluate((heading) => {
      const box = heading.getBoundingClientRect();
      const topmost = document.elementFromPoint(box.left + 4, box.top + box.height / 2);
      return topmost === heading || heading.contains(topmost);
    })
  ).toBe(true);
  const planStage = page.getByLabel("今日计划详情");
  const mobileOverflow = await planStage.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth
  }));
  expect(mobileOverflow.scrollWidth).toBeLessThanOrEqual(mobileOverflow.clientWidth + 1);
  await page.screenshot({
    path: testInfo.outputPath("today-plan-mobile.png"),
    animations: "disabled"
  });
});

test("loads the interactive 3D body smoke view", async ({ page }) => {
  test.setTimeout(90_000);

  await page.goto("/");

  await expect(page.getByLabel("Interactive 3D body")).toBeVisible();
  await expect(page.getByLabel("3D model status")).toContainText("Model ready", {
    timeout: 20_000
  });
  await expect(page.getByLabel("3D body controls")).toBeVisible();
  await expect(page.getByRole("button", { name: "重置视角" })).toBeVisible();
  await page.getByRole("button", { name: "专业模式" }).click();
  await expect(page.getByRole("button", { name: "普通模式" })).toBeVisible();
  await page.getByRole("button", { name: "普通模式" }).click();
  await expect(page.getByRole("button", { name: "专业模式" })).toBeVisible();
  await page.screenshot({
    path: "test-results/visual-regression/dashboard-desktop.png",
    fullPage: true
  });

  const canvas = page.locator(".body-3d-shell canvas");
  await expect(canvas).toBeVisible();

  const desktopPixels = await canvas.evaluate((element) => {
    const canvasElement = element as HTMLCanvasElement;
    const context = canvasElement.getContext("webgl2") ?? canvasElement.getContext("webgl");
    if (!context) return 0;

    const pixels = new Uint8Array(4);
    context.readPixels(
      Math.floor(canvasElement.width / 2),
      Math.floor(canvasElement.height / 2),
      1,
      1,
      context.RGBA,
      context.UNSIGNED_BYTE,
      pixels
    );
    return pixels[0] + pixels[1] + pixels[2] + pixels[3];
  });
  expect(desktopPixels).toBeGreaterThan(0);

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.35);
    await expect(page.locator(".canvas-context")).not.toContainText("下背");
  }

  if (await page.getByRole("button", { name: "清除选择" }).count())
    await page.getByRole("button", { name: "清除选择" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel("Interactive 3D body")).toBeVisible();
  await expect(page.getByRole("button", { name: "重置视角" })).toBeVisible();
  await expect(page.getByRole("button", { name: "身体状态" })).toBeVisible();
  await expect(page.getByLabel("首页身体数据")).toBeVisible();
  await expect(page.getByRole("region", { name: "肌群训练分布", exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/visual-regression/dashboard-mobile.png",
    fullPage: true
  });
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 }
]) {
  test(`shows today's plan from the timeline at ${viewport.width}px`, async ({
    page
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.route("**/api/dashboard", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.projection.date = "2026-06-20";
      await route.fulfill({ json: body });
    });
    await page.route("**/api/workouts/2026-06-20", (route) =>
      route.fulfill({ status: 404, json: { error: "Not found" } })
    );
    await page.goto("/");
    const plan = page.getByRole("region", { name: "今日计划", exact: true });
    await expect(plan.getByRole("button", { name: "查看完整计划" })).toBeAttached();
    const title = await plan.locator(".plan-card-heading strong").textContent();
    await page
      .getByRole("button", {
        name: viewport.width < 600 ? "训练记录" : "展开训练时间线",
        exact: true
      })
      .click();
    await page.getByRole("button", { name: /今天/ }).click();
    await expect(page.getByText("当天没有训练记录")).toBeVisible();
    // Close the mobile drawer so the detail sheet can be reviewed and used.
    await page.getByRole("button", { name: "收起训练时间线" }).click();
    await expect(plan).toContainText(title ?? "");
    await expect(plan.getByRole("button", { name: "查看完整计划" })).toBeVisible();
    await expect(page.getByLabel("3D model status")).toContainText("Model ready", {
      timeout: 20_000
    });
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.screenshot({
      path: testInfo.outputPath("timeline-today-plan.png"),
      animations: "disabled"
    });
    await plan.getByRole("button", { name: "查看完整计划" }).click();
    await expect(page.getByLabel("今日计划详情")).toBeVisible();
    await expect(page.locator(".plan-document-header h1")).toHaveText(title ?? "");
  });
}
