import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { postJson } from "./http";
import type { ApiError } from "./http";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("API HTTP helpers", () => {
  it("preserves server error messages for POST requests", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(JSON.stringify({ ok: false, error: "adapter not configured" }), {
          status: 501,
          headers: { "Content-Type": "application/json" }
        });
      })
    );

    await expect(
      postJson("/api/example", {}, z.object({ ok: z.literal(true) }))
    ).rejects.toMatchObject({
      message: "adapter not configured",
      status: 501
    } satisfies Partial<ApiError>);
  });
});
