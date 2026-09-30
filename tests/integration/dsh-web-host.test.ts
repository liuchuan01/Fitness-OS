import { once } from "node:events";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLocalService } from "../../server/app.js";
import { DshWebHost } from "../../server/dsh-web-host.js";
import { applicationRoot } from "../../server/workspace.js";

const servers: ReturnType<typeof createLocalService>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(async (server) => {
    server.close();
    await once(server, "close");
  }));
});

describe("DSH Web host projection", () => {
  it("reports the official host lifecycle without creating a conversation store", async () => {
    const server = createLocalService({ version: "test" });
    servers.push(server);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP address");

    const response = await fetch(`http://127.0.0.1:${address.port}/api/dsh-web`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, status: "starting" });
  });

  it("logs a restored module directory conflict without logging secrets", async () => {
    const workspaceRoot = mkdtempSync(join(tmpdir(), "fitness-dsh-log-"));
    const dshHome = join(workspaceRoot, "runtime", "dsh");
    mkdirSync(join(dshHome, "profiles", "node_modules", "@deepseek-ai", "dsh-base"), {
      recursive: true
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const host = new DshWebHost({
      workspaceRoot,
      dshHome,
      port: 0,
      bridgeSecret: "test-bridge-secret",
      agentSettingsFile: join(workspaceRoot, "config", "settings.yaml"),
      profileSource: join(applicationRoot, "dsh-fitness")
    });
    try {
      host.start();
      await vi.waitFor(() => expect(host.status().status).toBe("failed"), { timeout: 15000 });
      expect(log.mock.calls.flat().join(" ")).toContain("exists and is not a symlink");
      expect(log.mock.calls.flat().join(" ")).not.toContain("test-bridge-secret");
    } finally {
      host.close();
      log.mockRestore();
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  }, 20000);
});
