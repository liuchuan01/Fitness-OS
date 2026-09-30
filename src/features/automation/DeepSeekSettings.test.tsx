import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DeepSeekSettings } from "./DeepSeekSettings";

vi.mock("./ModelPreferences", () => ({ ModelPreferences: () => null }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("saves only the DeepSeek key and clears the input without echoing credentials", async () => {
  const fetcher = vi.fn(async (_url: unknown, options?: RequestInit) =>
    Response.json({
      ok: true,
      settings: { provider: "DeepSeek", configured: options?.method === "PUT", writable: true }
    })
  );
  vi.stubGlobal("fetch", fetcher);
  render(<DeepSeekSettings />);
  await screen.findByText("尚未配置密钥");
  fireEvent.change(screen.getByLabelText("DeepSeek API Key"), {
    target: { value: " test-only-key " }
  });
  fireEvent.click(screen.getByRole("button", { name: "保存模型密钥" }));
  await screen.findByText("密钥已保存，从下一次对话或定时任务起生效。");
  expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual({ apiKey: "test-only-key" });
  expect(screen.getByLabelText("DeepSeek API Key")).toHaveValue("");
  expect(screen.queryByLabelText("模型提供方")).not.toBeInTheDocument();
});

it("allows first-key recovery after a failed status read", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: unknown, options?: RequestInit) =>
      options?.method === "PUT"
        ? Response.json({
            ok: true,
            settings: { provider: "DeepSeek", configured: true, writable: true }
          })
        : Response.json({ ok: false, error: "Unavailable" }, { status: 503 })
    )
  );
  render(<DeepSeekSettings />);
  fireEvent.click(screen.getByText("DeepSeek Harness"));
  await screen.findByText("密钥状态暂不可用");
  const input = screen.getByLabelText("DeepSeek API Key");
  expect(input).toBeEnabled();
  fireEvent.change(input, { target: { value: "test-only-key" } });
  fireEvent.click(screen.getByRole("button", { name: "保存模型密钥" }));
  await screen.findByText("已配置密钥");
  expect(input).toHaveValue("");
});

it("keeps environment-managed credentials read-only", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        ok: true,
        settings: { provider: "DeepSeek", configured: true, writable: false, source: "env" }
      })
    )
  );
  render(<DeepSeekSettings />);
  fireEvent.click(screen.getByText("DeepSeek Harness"));
  await screen.findByText("已配置密钥");
  expect(screen.getByLabelText("DeepSeek API Key")).toBeDisabled();
  expect(screen.getByRole("button", { name: "保存模型密钥" })).toBeDisabled();
});
