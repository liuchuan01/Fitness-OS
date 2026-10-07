import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { XparseSettings } from "./XparseSettings";
import * as api from "../../../api/xparse";

vi.mock("../../../api/xparse", () => ({
  getXparseSettings: vi.fn(),
  getXparseCredentials: vi.fn(),
  saveXparseSettings: vi.fn(),
  saveXparseCredentials: vi.fn()
}));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.getXparseSettings).mockResolvedValue({ enabled: false, allowPaid: false });
  vi.mocked(api.getXparseCredentials).mockResolvedValue({ configured: false, writable: true });
});
it("saves the switch independently and never clears an unsubmitted credential draft", async () => {
  vi.mocked(api.saveXparseSettings).mockResolvedValue({ enabled: true, allowPaid: false });
  render(<XparseSettings />);
  await screen.findByText("尚未配置 TextIn 凭据");
  fireEvent.change(screen.getByLabelText("TextIn App ID"), { target: { value: "app" } });
  fireEvent.change(screen.getByLabelText("TextIn Secret Code"), { target: { value: "secret" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /启用文件解析/ }));
  fireEvent.click(screen.getByRole("button", { name: "保存解析设置" }));
  await waitFor(() =>
    expect(api.saveXparseSettings).toHaveBeenCalledWith({ enabled: true, allowPaid: false })
  );
  expect(screen.getByLabelText("TextIn Secret Code")).toHaveValue("secret");
  expect(api.saveXparseCredentials).not.toHaveBeenCalled();
});
it("allows recovery after a credential read failure, retains failed input, then clears successful input", async () => {
  vi.mocked(api.getXparseCredentials).mockRejectedValue(new Error("offline"));
  vi.mocked(api.saveXparseCredentials)
    .mockRejectedValueOnce(new Error("保存失败"))
    .mockResolvedValueOnce({ configured: true, writable: true });
  render(<XparseSettings />);
  await screen.findByText(/TextIn 凭据状态暂不可用/);
  fireEvent.change(screen.getByLabelText("TextIn App ID"), { target: { value: "app" } });
  fireEvent.change(screen.getByLabelText("TextIn Secret Code"), { target: { value: "secret" } });
  fireEvent.click(screen.getByRole("button", { name: "保存 TextIn 凭据" }));
  await screen.findByText("保存失败");
  expect(screen.getByLabelText("TextIn Secret Code")).toHaveValue("secret");
  fireEvent.click(screen.getByRole("button", { name: "保存 TextIn 凭据" }));
  await screen.findByText("已配置 TextIn 凭据");
  expect(screen.getByLabelText("TextIn Secret Code")).toHaveValue("");
});
it("keeps environment credentials read-only while allowing the feature switch", async () => {
  vi.mocked(api.getXparseCredentials).mockResolvedValue({ configured: true, writable: false });
  render(<XparseSettings />);
  await screen.findByText("已配置 TextIn 凭据");
  expect(screen.getByLabelText("TextIn App ID")).toBeDisabled();
  expect(screen.getByRole("button", { name: "清除凭据" })).toBeDisabled();
  expect(screen.getByRole("checkbox", { name: /启用文件解析/ })).toBeEnabled();
});
