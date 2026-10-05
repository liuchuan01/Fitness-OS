import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test as base, type Page } from "@playwright/test";

// Use the already-built app, with a private workspace and a dynamically reserved port.
// Installing a package after process startup proves discovery is not a build-time import.
const test = base.extend<{ installedApp: { origin: string; workspace: string } }>({
  installedApp: async ({ request }, use) => {
    const workspace = await mkdtemp(join(tmpdir(), "fitness-theme-pack-"));
    await cp("tests/fixtures/data", join(workspace, "fitness"), { recursive: true });
    const reservation = createServer();
    await new Promise<void>((resolve) => reservation.listen(0, "127.0.0.1", resolve));
    const address = reservation.address();
    if (!address || typeof address === "string") throw new Error("No test port available");
    await new Promise<void>((resolve, reject) =>
      reservation.close((error) => (error ? reject(error) : resolve()))
    );
    const child = spawn(process.execPath, ["dist-server/server/index.js"], {
      env: {
        ...process.env,
        WORKSPACE_ROOT: workspace,
        DATA_ROOT: "",
        RUNTIME_ROOT: "",
        DSH_HOME: "",
        HOST: "127.0.0.1",
        PORT: String(address.port),
        AGENT_RUNTIME_DISABLED: "true",
        DSH_WEB_DISABLED: "true"
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    try {
      await expect.poll(() => output, { timeout: 15_000 }).toMatch(/listening on http:/);
      const match = output.match(/listening on (http:\/\/127\.0\.0\.1:\d+)/);
      if (!match) throw new Error(output);
      await expect
        .poll(async () => (await request.get(`${match[1]}/api/health`)).status())
        .toBe(200);
      await use({ origin: match[1], workspace });
    } finally {
      if (child.exitCode === null) {
        const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
        child.kill("SIGTERM");
        await exited;
      }
      await rm(workspace, { recursive: true, force: true });
    }
  }
});

async function section(page: Page, name: string) {
  await page
    .getByRole("navigation", { name: "设置分类" })
    .getByRole("button", { name, exact: true })
    .click();
}

test("discovers a post-build theme, preserves state and recovers after removal", async ({
  page,
  context,
  installedApp
}, testInfo) => {
  test.setTimeout(90_000);
  const { origin, workspace } = installedApp;
  await page.goto(`${origin}/#/settings`);
  await section(page, "界面外观");
  await expect(page.getByRole("radio", { name: /Slate Studio/ })).toHaveCount(0);

  const destination = join(workspace, "themes", "slate-studio");
  await cp("examples/themes/slate-studio", destination, { recursive: true });
  const invalidDirectory = join(workspace, "themes", "invalid-theme");
  await mkdir(invalidDirectory, { recursive: true });
  await writeFile(
    join(invalidDirectory, "theme.json"),
    JSON.stringify({
      schemaVersion: 999,
      id: "invalid-theme",
      name: "Invalid theme"
    })
  );
  await page.reload();
  await section(page, "界面外观");
  await expect(page.getByRole("radio", { name: /Slate Studio/ })).toBeVisible();
  const previewImage = page
    .locator(".theme-choice")
    .filter({ hasText: "Slate Studio" })
    .locator("img");
  await expect(previewImage).toBeVisible();
  await expect
    .poll(() => previewImage.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBe(480);
  const preview = await page.request.get(`${origin}/api/themes/slate-studio/assets/preview.png`);
  expect(preview.status()).toBe(200);
  expect(preview.headers()["content-type"]).toContain("image/png");
  expect((await preview.body()).subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  );
  await expect(page.getByRole("radio", { name: /Invalid theme/ })).toHaveCount(0);

  await section(page, "教练偏好");
  const draft = page.getByRole("textbox", { name: "教练指令", exact: true });
  await draft.fill("主题切换保留这份未保存草稿");
  await section(page, "界面外观");
  await page.getByRole("radio", { name: /Slate Studio/ }).check();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "slate-studio");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: testInfo.outputPath("slate-settings-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath("slate-settings-mobile.png") });
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator("html")).toHaveCSS("--theme-blur", "12px");
  await section(page, "教练偏好");
  await expect(draft).toHaveValue("主题切换保留这份未保存草稿");

  const dashboard = await context.newPage();
  await dashboard.emulateMedia({ reducedMotion: "reduce" });
  await dashboard.goto(origin);
  await expect(dashboard.locator("html")).toHaveAttribute("data-theme", "slate-studio");
  await dashboard.getByRole("button", { name: "展开训练时间线" }).click();
  await dashboard.getByRole("button", { name: /Pull Day/ }).click();
  await dashboard.getByRole("button", { name: "选择肌肉", exact: true }).click();
  const selector = dashboard.getByRole("dialog", { name: "身体部位选择" });
  await selector.getByRole("button", { name: "背部", exact: true }).click();
  await selector.getByRole("button", { name: /背阔肌/ }).click();
  const history = dashboard.getByLabel("肌肉训练档案", { exact: true });
  await expect(history).toContainText("截至 2026-06-19");
  await section(page, "界面外观");
  await page.getByRole("radio", { name: /Graphite/ }).check();
  await expect(dashboard.locator("html")).toHaveAttribute("data-theme", "graphite");
  await expect(history).toContainText("截至 2026-06-19");
  await expect(history.getByRole("heading", { name: "背阔肌", exact: true })).toBeVisible();
  await page.getByRole("radio", { name: /Slate Studio/ }).check();
  await expect(dashboard.locator("html")).toHaveAttribute("data-theme", "slate-studio");
  await expect(history).toContainText("截至 2026-06-19");
  await expect(dashboard.locator(".body-3d-shell")).toHaveAttribute(
    "data-body-theme",
    "slate-studio"
  );
  await dashboard.bringToFront();
  await expect(dashboard.getByLabel("3D model status")).toContainText("Model ready", {
    timeout: 20_000
  });
  await dashboard.getByRole("button", { name: "收起训练时间线" }).click();
  await dashboard.setViewportSize({ width: 1440, height: 900 });
  await expect(dashboard.locator(".body-3d-shell")).toHaveAttribute("data-focus-motion", "idle");
  await dashboard.screenshot({ path: testInfo.outputPath("slate-body-desktop.png") });
  await dashboard.setViewportSize({ width: 390, height: 844 });
  await expect(dashboard.getByLabel("Workout timeline")).toBeHidden();
  await expect(dashboard.locator(".body-3d-shell")).toHaveAttribute("data-focus-motion", "idle");
  await dashboard.screenshot({ path: testInfo.outputPath("slate-body-mobile.png") });
  await dashboard.close();

  await page.route("**/api/themes", (route) => route.fulfill({ status: 503, json: { ok: false } }));
  await page.reload();
  await section(page, "界面外观");
  await expect(page.getByRole("alert")).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("fitness:appearance:v2") ?? "null")?.themeId
    )
  ).toBe("slate-studio");
  await page.unroute("**/api/themes");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "slate-studio");

  await rm(join(destination, "preview.png"));
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "slate-studio");
  await section(page, "界面外观");
  const fallbackChoice = page.locator(".theme-choice").filter({ hasText: "Slate Studio" });
  await expect(fallbackChoice.locator("img")).toHaveCount(0);
  await expect(fallbackChoice.locator(".theme-preview svg")).toBeVisible();

  await rm(destination, { recursive: true });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "neon");
  await section(page, "界面外观");
  await expect(page.getByRole("radio", { name: /Slate Studio/ })).toHaveCount(0);
  await expect(page.getByRole("radio", { name: /Neon/ })).toBeChecked();
});
