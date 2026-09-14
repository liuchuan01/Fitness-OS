import { describe, expect, it, vi } from "vitest";
import { DshHostAgentRuntime } from "../../server/agent-runtime.js";

describe("DshHostAgentRuntime", () => {
  it("admits automation through the Host bridge and waits for its idle observation", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, accepted: true }), { status: 202 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, state: "idle" }), { status: 200 })
      ) as unknown as typeof fetch;
    const runtime = new DshHostAgentRuntime({
      bridgeUrl: "http://127.0.0.1:3082/fitness-automation-bridge",
      secret: "test-secret",
      fetchImpl
    });

    await expect(
      runtime.run("fitness-daily-2026-09-01", "Generate today's plan.")
    ).resolves.toMatchObject({
      sessionId: "fitness-daily-2026-09-01"
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [admissionUrl, admission] = vi.mocked(fetchImpl).mock.calls[0]!;
    expect(admissionUrl).toBe("http://127.0.0.1:3082/fitness-automation-bridge");
    expect(admission).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({ "x-fitness-bridge-secret": "test-secret" })
    });
    expect(JSON.parse(String(admission?.body))).toMatchObject({
      sessionId: "fitness-daily-2026-09-01",
      message: "Generate today's plan."
    });
    expect(String(vi.mocked(fetchImpl).mock.calls[1]![0])).toContain(
      "/status?sessionId=fitness-daily-2026-09-01"
    );
  });
});
