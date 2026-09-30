import { stripVTControlCharacters } from "node:util";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { chromium, expect as browserExpect } from "@playwright/test";
import { expect, it } from "vitest";

async function freePort() {
  const server = createServer().listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing port");
  await new Promise<void>((done) => server.close(() => done()));
  return address.port;
}

it.each([false, true])(
  "configures a first key through npm run dev (initial read failure: %s)",
  async (failInitialRead) => {
    const root = await mkdtemp(join(tmpdir(), "fitness-empty-key-"));
    const port = await freePort();
    const hostPort = await freePort();
    const env = Object.fromEntries(
      Object.entries(process.env).filter(
        ([key]) =>
          ![
            "DEEPSEEK_API_KEY",
            "DATA_ROOT",
            "FITNESS_ROOT",
            "RUNTIME_ROOT",
            "DSH_HOME",
            "DSH_WEB_DISABLED",
            "DSH_WEB_BIND_HOST"
          ].includes(key)
      )
    );
    let webUrl = "";
    const service = spawn("npm", ["run", "dev"], {
      detached: true,
      env: {
        ...env,
        PORT: String(port),
        FITNESS_API_ORIGIN: `http://127.0.0.1:${port}`,
        HOST: "127.0.0.1",
        DSH_WEB_PORT: String(hostPort),
        WORKSPACE_ROOT: root,
        AGENT_RUNTIME_DISABLED: "true"
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    service.stdout.on("data", (chunk: Buffer) => {
      const match = /Local:\s+(http:\/\/[^\s]+)/u.exec(stripVTControlCharacters(chunk.toString()));
      if (match) webUrl = match[1];
    });
    service.stderr.resume();
    const browser = await chromium.launch();
    try {
      const base = `http://127.0.0.1:${port}`;
      await expect
        .poll(
          async () => {
            try {
              return (await fetch(`${base}/api/health`)).ok;
            } catch {
              return false;
            }
          },
          { timeout: 15000 }
        )
        .toBe(true);
      const page = await browser.newPage();
      await expect.poll(() => webUrl, { timeout: 15000 }).not.toBe("");
      if (failInitialRead) {
        await page.route("**/api/model/settings", async (route) => {
          if (route.request().method() === "GET") {
            await route.fulfill({
              status: 503,
              contentType: "application/json",
              body: JSON.stringify({ ok: false, error: "Unavailable" })
            });
          } else {
            await route.continue();
          }
        });
      }
      await page.goto(`${webUrl}#/settings?section=connection`);
      const input = page.getByLabel("DeepSeek API Key");
      await browserExpect(input).toBeEnabled({ timeout: 25000 });
      await browserExpect(
        page.getByText(failInitialRead ? "密钥状态暂不可用" : "尚未配置密钥", { exact: true })
      ).toBeVisible({ timeout: 25000 });
      if (failInitialRead)
        await page.screenshot({ path: join(root, "key-read-recovery.png"), fullPage: true });
      await page.unroute("**/api/model/settings");
      await input.fill("test-only-empty-workspace-key");
      await page.getByRole("button", { name: "保存模型密钥" }).click();
      await browserExpect(page.getByText("密钥已保存，从下一次对话或定时任务起生效。")).toBeVisible(
        { timeout: 25000 }
      );
      await browserExpect(input).toHaveValue("");
      const response = await fetch(`${base}/api/model/settings`);
      expect(await response.json()).toMatchObject({
        ok: true,
        settings: { configured: true, writable: true }
      });
      expect(await readFile(join(root, "config/dsh-credentials.yaml"), "utf8")).toContain(
        "test-only-empty-workspace-key"
      );
      await page.reload();
      await browserExpect(page.getByText("已配置密钥", { exact: true })).toBeVisible({
        timeout: 25000
      });
      await browserExpect(input).toHaveValue("");
    } finally {
      await browser.close();
      const exited = once(service, "exit");
      if (service.pid) process.kill(-service.pid, "SIGTERM");
      await exited;
      await rm(root, { recursive: true, force: true });
    }
  },
  60000
);
