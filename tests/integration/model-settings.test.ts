import { once } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLocalService } from "../../server/app.js";

vi.mock("../../server/dsh-web-host.js", () => ({
  DshWebHost: class {
    start() {}
    close() {}
    status() {
      return { status: "ready", url: "http://127.0.0.1:3080" };
    }
  }
}));

const servers: ReturnType<typeof createLocalService>[] = [];
afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await Promise.all(
    servers.splice(0).map(async (server) => {
      server.close();
      await once(server, "close");
    })
  );
});

describe("DSH model configuration proxy", () => {
  it("forwards writes through the authenticated bridge and never caches credentials", async () => {
    const nativeFetch = globalThis.fetch;
    const bridge = vi.fn(async () =>
      Response.json({
        ok: true,
        settings: { provider: "DeepSeek", configured: true, writable: true }
      })
    );
    vi.stubGlobal("fetch", bridge);
    vi.stubEnv("FITNESS_DSH_BRIDGE_SECRET", "test-bridge-secret");
    const server = createLocalService({ version: "test" });
    servers.push(server);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP address");
    const response = await nativeFetch(`http://127.0.0.1:${address.port}/api/model/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: "test-only-secret" })
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).not.toContain("test-only-secret");
    expect(bridge).toHaveBeenCalledWith(
      expect.stringContaining("/fitness-model-settings"),
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({ "x-fitness-bridge-secret": "test-bridge-secret" })
      })
    );
  });

  it("forwards native model preferences and conflict status through the authenticated bridge", async () => {
    const nativeFetch = globalThis.fetch;
    const bridge = vi.fn(async () =>
      Response.json({ ok: false, error: "DSH 设置已在其他位置修改" }, { status: 409 })
    );
    vi.stubGlobal("fetch", bridge);
    vi.stubEnv("FITNESS_DSH_BRIDGE_SECRET", "test-bridge-secret");
    const server = createLocalService({ version: "test" });
    servers.push(server);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP address");
    const body = JSON.stringify({
      provider: "deepseek-official",
      model: "test-model",
      reasoningEffort: "high",
      revision: 2
    });
    const response = await nativeFetch(`http://127.0.0.1:${address.port}/api/model/preferences`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body
    });
    expect(response.status).toBe(409);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(bridge).toHaveBeenCalledWith(
      expect.stringContaining("/fitness-model-preferences"),
      expect.objectContaining({
        body,
        headers: expect.objectContaining({ "x-fitness-bridge-secret": "test-bridge-secret" })
      })
    );
  });

  it.each(["settings", "preferences"])(
    "returns a safe error when the %s backend fails",
    async (route) => {
      const nativeFetch = globalThis.fetch;
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          throw new Error("sensitive backend detail");
        })
      );
      const server = createLocalService({ version: "test" });
      servers.push(server);
      server.listen(0, "127.0.0.1");
      await once(server, "listening");
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Expected TCP address");
      const response = await nativeFetch(`http://127.0.0.1:${address.port}/api/model/${route}`);
      expect(response.status).toBe(503);
      expect(await response.text()).not.toContain("sensitive backend detail");
      expect(log).toHaveBeenCalledWith(
        `[Fitness] GET /api/model/${route} unavailable: Host ready; ${route === "preferences" ? "model preferences" : "credential"} bridge request failed`
      );
      expect(log.mock.calls.flat().join(" ")).not.toContain("sensitive backend detail");
      log.mockRestore();
    }
  );
});
