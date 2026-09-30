import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ModelPreferences } from "./ModelPreferences";
import { modelPreferencesFixture } from "../../../tests/fixtures/model-preferences";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("retains a rejected draft and reloads native settings after a revision conflict", async () => {
  const preferences = modelPreferencesFixture();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: unknown, options?: RequestInit) =>
      options?.method === "PUT"
        ? Response.json(
            { error: "DSH 设置已在其他位置修改，请重新读取后再保存。" },
            { status: 409 }
          )
        : Response.json({ ok: true, preferences })
    )
  );
  render(<ModelPreferences />);
  const model = await screen.findByLabelText("默认模型");
  fireEvent.change(model, { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText("思考强度"), { target: { value: "max" } });
  fireEvent.click(screen.getByRole("button", { name: "保存模型设置" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("其他位置修改");
  expect(model).toHaveValue("1");
  expect(screen.getByLabelText("思考强度")).toHaveValue("max");
  fireEvent.click(screen.getByRole("button", { name: "重新读取" }));
  await waitFor(() => expect(model).toHaveValue("0"));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("recovers from read failure and respects the DSH provider read-only state", async () => {
  const preferences = { ...modelPreferencesFixture(), writable: false };
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(Response.json({ error: "Host 暂不可用" }, { status: 503 }))
      .mockImplementation(async () => Response.json({ ok: true, preferences }))
  );
  render(<ModelPreferences />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Host 暂不可用");
  fireEvent.click(screen.getByRole("button", { name: "重新读取" }));
  expect(await screen.findByLabelText("默认模型")).toBeDisabled();
  expect(screen.getByLabelText("思考强度")).toBeDisabled();
  expect(screen.getByRole("button", { name: "保存模型设置" })).toBeDisabled();
});

it("shows unavailable native selections without silently substituting another model", async () => {
  const preferences = modelPreferencesFixture();
  preferences.selection.model = "removed-model";
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ ok: true, preferences }))
  );
  render(<ModelPreferences />);
  expect(await screen.findByText(/当前模型不在可用目录：removed-model/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "保存模型设置" })).toBeDisabled();
});
