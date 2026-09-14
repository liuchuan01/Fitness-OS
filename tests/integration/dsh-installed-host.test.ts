import { mkdtemp, mkdir, readFile, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { expect, it } from "vitest";
import { chromium } from "@playwright/test";
import { DshWebHost } from "../../server/dsh-web-host.js";
import { initializeWorkspace } from "../../server/workspace-init.js";
import { resolveWorkspacePaths } from "../../server/workspace.js";

it("boots the installed DSH, authenticates the bridge and refreshes profile context per request", async () => {
  const root = await mkdtemp(join(tmpdir(), "fitness-installed-host-"));
  const paths = resolveWorkspacePaths({ workspaceRoot: root, env: {} });
  await initializeWorkspace(paths);
  const portServer = createServer();
  portServer.listen(0, "127.0.0.1");
  await once(portServer, "listening");
  const address = portServer.address();
  if (!address || typeof address === "string") throw new Error("No port");
  const port = address.port;
  await new Promise<void>((done) => portServer.close(() => done()));
  const source = join(root, "profile-source");
  await mkdir(join(source, "profile"), { recursive: true });
  await writeFile(join(source, "config.json"), await readFile("dsh-fitness/config.json"));
  for (const name of ["surface", "automation-bridge"])
    await symlink(resolve("dsh-fitness", name), join(source, name), "dir");
  const patch = await readFile("dsh-fitness/profile/cordis.patch.yml", "utf8");
  await writeFile(
    join(source, "profile/cordis.patch.yml"),
    patch +
      `
- id: agent-default-model
  config:
    provider: fitness-test
    model: fixture
- insert:
    - id: fitness-test-model
      name: ${JSON.stringify(resolve("tests/fixtures/dsh-model/index.js"))}
`
  );
  const profile = join(paths.fitnessRoot, "profile.yaml");
  await writeFile(profile, "preferences: {equipment: bands}\n");
  const host = new DshWebHost({
    workspaceRoot: root,
    port,
    dshHome: paths.dshHome,
    bridgeSecret: "test-only",
    agentSettingsFile: paths.settingsFile,
    profileSource: source
  });
  try {
    host.start();
    await expect.poll(() => host.status().status, { timeout: 45000 }).toBe("ready");
    const base = `http://127.0.0.1:${port}`;
    const bootstrap = await (await fetch(`${base}/fitness-bootstrap`)).json();
    expect(bootstrap).toMatchObject({ ok: true, sessionId: "fitness-interactive" });
    expect((await fetch(`${base}/fitness-automation-bridge/status`)).status).toBe(401);
    const headers = { "x-fitness-bridge-secret": "test-only", "Content-Type": "application/json" };
    const settings = await (await fetch(`${base}/fitness-model-settings`, { headers })).json();
    expect(settings).toMatchObject({ ok: true });
    for (const equipment of ["bands", "dumbbells"]) {
      await writeFile(profile, `preferences: {equipment: ${equipment}}\n`);
      const body = JSON.stringify({
        sessionId: "fitness-interactive",
        runId: equipment,
        requestId: equipment,
        message: "检查本次档案。"
      });
      const admitted = await fetch(`${base}/fitness-automation-bridge`, {
        method: "POST",
        headers,
        body
      });
      expect(await admitted.json()).toMatchObject({ ok: true, accepted: true });
      const duplicate = await fetch(`${base}/fitness-automation-bridge`, {
        method: "POST",
        headers,
        body
      });
      expect(await duplicate.json()).toMatchObject({ ok: true, accepted: true });
      await expect
        .poll(
          async () => {
            const status = await fetch(
              `${base}/fitness-automation-bridge/status?sessionId=fitness-interactive&runId=${equipment}`,
              { headers }
            );
            const payload: unknown = await status.json();
            return payload && typeof payload === "object" && "state" in payload
              ? payload.state
              : undefined;
          },
          { timeout: 20000 }
        )
        .toBe("idle");
    }
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 900 },
        locale: "zh-CN"
      });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const status = host.status();
      if (status.status !== "ready") throw new Error("Host not ready");
      await page.goto(status.url);
      await expect
        .poll(() => page.locator("body").innerText(), { timeout: 20000 })
        .toContain("升级验证完成。档案：bands");
      await expect
        .poll(() => page.locator("body").innerText())
        .toContain("升级验证完成。档案：dumbbells");
      await page.getByRole("button", { name: "1 次工具调用", exact: true }).click();
      await page.getByRole("button", { name: "AGENTS.md", exact: true }).first().click();
      await expect.poll(() => page.locator("body").innerText()).toContain("训练 Agent 文档地图");
      await expect
        .poll(async () => {
          const box = await page.locator("[data-sidebar-right-panel]").boundingBox();
          return box ? Math.round(box.x + box.width) : 0;
        })
        .toBe(1440);
      if (process.env.FITNESS_DSH_REVIEW_DIR) {
        await mkdir(process.env.FITNESS_DSH_REVIEW_DIR, { recursive: true });
        await page.screenshot({
          animations: "disabled",
          path: join(process.env.FITNESS_DSH_REVIEW_DIR, "preview-desktop.png")
        });
        await page.setViewportSize({ width: 390, height: 844 });
        await expect
          .poll(() =>
            page.locator("[data-sidebar-right-panel]").getAttribute("data-sidebar-right-panel")
          )
          .toBe("fullscreen");
        await page.screenshot({
          animations: "disabled",
          path: join(process.env.FITNESS_DSH_REVIEW_DIR, "preview-mobile.png")
        });
      }
      await page.reload();
      await expect
        .poll(() => page.locator("body").innerText(), { timeout: 20000 })
        .toContain("升级验证完成。档案：dumbbells");
      await page.getByRole("button", { name: "新会话", exact: true }).click();
      await expect.poll(() => page.locator("body").innerText()).toContain("今天想怎么练");
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
    }
  } finally {
    host.close();
    await delay(1000);
    await rm(root, { recursive: true, force: true });
  }
}, 90000);
