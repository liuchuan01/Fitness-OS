import { once } from "node:events";
import { afterEach, describe, expect, it } from "vitest";
import { createLocalService } from "../../server/app.js";

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
});
