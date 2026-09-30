import { modelPreferencesResponseSchema } from "../../shared/dsh-model-preferences.js";
import { z } from "zod";
import { mkdtemp, mkdir, readFile, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { expect, it } from "vitest";
import { parse, stringify } from "yaml";
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
    const preferencesUrl = `${base}/fitness-model-preferences`;
    expect((await fetch(preferencesUrl)).status).toBe(401);
    const readPreferences = async () =>
      modelPreferencesResponseSchema.parse(await (await fetch(preferencesUrl, { headers })).json())
        .preferences;
    let preferences = await readPreferences();
    expect(preferences.models).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "fixture",
          efforts: [
            { id: "low", name: "Low" },
            { id: "high", name: "High" }
          ]
        })
      ])
    );
    const savePreferences = (value: object) =>
      fetch(preferencesUrl, { method: "PUT", headers, body: JSON.stringify(value) });
    for (const invalid of [
      { model: "absent", reasoningEffort: "high" },
      { model: "fixture", reasoningEffort: "unsupported" }
    ]) {
      expect(
        (
          await savePreferences({
            provider: "fitness-test",
            revision: preferences.revision,
            ...invalid
          })
        ).status
      ).toBe(422);
    }
    expect(
      (
        await savePreferences({
          provider: "fitness-test",
          model: "fixture",
          reasoningEffort: "high",
          revision: preferences.revision
        })
      ).status
    ).toBe(200);
    expect(
      (
        await savePreferences({
          provider: "fitness-test",
          model: "fixture-alt",
          revision: preferences.revision
        })
      ).status
    ).toBe(409);
    preferences = await readPreferences();
    for (const equipment of ["bands", "dumbbells"]) {
      if (equipment === "dumbbells") {
        expect(
          (
            await savePreferences({
              provider: "fitness-test",
              model: "fixture-alt",
              reasoningEffort: "low",
              revision: preferences.revision
            })
          ).status
        ).toBe(200);
      }
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
    expect(
      (
        await fetch(`${base}/fitness-automation-bridge`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            sessionId: "fitness-daily-model-test",
            runId: "model-test",
            requestId: "model-test",
            message: "检查模型设置。"
          })
        })
      ).status
    ).toBe(202);
    await expect
      .poll(
        async () =>
          z
            .object({ state: z.string() })
            .parse(
              await (
                await fetch(
                  `${base}/fitness-automation-bridge/status?sessionId=fitness-daily-model-test&runId=model-test`,
                  { headers }
                )
              ).json()
            ).state,
        { timeout: 20000 }
      )
      .toBe("idle");
    const calls = (await readFile(join(root, "fixture-model-requests.jsonl"), "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(
      calls
        .filter((call) => call.sessionId === "fitness-interactive")
        .every((call) => call.model === "fixture" && call.reasoningEffort === "high")
    ).toBe(true);
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sessionId: "fitness-daily-model-test",
          model: "fixture-alt",
          reasoningEffort: "low"
        })
      ])
    );
    const nativeFile = join(paths.dshHome, "settings.yaml");
    const stored = parse(await readFile(nativeFile, "utf8"));
    expect(stored["agent-default-model"]).toMatchObject({
      model: "fixture-alt",
      reasoningEffort: "low"
    });
    stored["agent-default-model"] = { provider: "fitness-test", model: "fixture" };
    stored["fitness-test-unrelated"] = { keep: "unchanged" };
    await writeFile(nativeFile, stringify(stored));
    await expect.poll(async () => (await readPreferences()).selection.model).toBe("fixture");
    preferences = await readPreferences();
    expect(preferences.selection.reasoningEffort).toBeUndefined();
    expect(
      (
        await savePreferences({
          provider: "fitness-test",
          model: "fixture-alt",
          revision: preferences.revision
        })
      ).status
    ).toBe(200);
    const updated = parse(await readFile(nativeFile, "utf8"));
    expect(updated["fitness-test-unrelated"]).toEqual({ keep: "unchanged" });
    expect(updated["agent-default-model"].reasoningEffort).toBeUndefined();
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
    host.close();
    host.start();
    await expect.poll(() => host.status().status, { timeout: 45000 }).toBe("ready");
    expect((await readPreferences()).selection).toEqual({
      provider: "fitness-test",
      model: "fixture-alt"
    });
  } finally {
    host.close();
    await delay(1000);
    await rm(root, { recursive: true, force: true });
  }
}, 90000);
