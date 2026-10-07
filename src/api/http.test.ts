import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { getJson, postJson } from "./http";
import type { ApiError } from "./http";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
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

it("bounds a stalled GET and releases the request after timeout", async () => {
  vi.useFakeTimers();
  let signal: AbortSignal | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn((_url: string, options: RequestInit) => {
      signal = options.signal as AbortSignal;
      return new Promise((_, reject) =>
        signal?.addEventListener("abort", () => reject(signal?.reason))
      );
    })
  );
  const result = expect(
    getJson("/api/settings", z.object({ ok: z.boolean() }), { timeoutMs: 5000 })
  ).rejects.toMatchObject({ status: 408, message: "读取超时，请稍后重试。" });
  await vi.advanceTimersByTimeAsync(5000);
  await result;
  expect(signal?.aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

it("includes body reads in the GET timeout and preserves caller cancellation", async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, options: RequestInit) => ({
      ok: true,
      json: () =>
        new Promise((_, reject) =>
          options.signal?.addEventListener("abort", () => reject(options.signal?.reason))
        )
    }))
  );
  const result = expect(
    getJson("/api/settings", z.object({ ok: z.boolean() }), { timeoutMs: 5000 })
  ).rejects.toMatchObject({ status: 408 });
  await vi.advanceTimersByTimeAsync(5000);
  await result;
  const controller = new AbortController();
  const reason = new Error("page left");
  const cancelled = expect(
    getJson("/api/settings", z.object({ ok: z.boolean() }), {
      signal: controller.signal,
      timeoutMs: 5000
    })
  ).rejects.toBe(reason);
  await vi.advanceTimersByTimeAsync(1);
  controller.abort(reason);
  await cancelled;
  expect(vi.getTimerCount()).toBe(0);
});
