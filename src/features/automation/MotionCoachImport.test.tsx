import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { importMotionCoachFile } from "../../api/motion-coach";
import { MotionCoachImport } from "./MotionCoachImport";

vi.mock("../../api/motion-coach", () => ({ importMotionCoachFile: vi.fn() }));

beforeEach(() => vi.mocked(importMotionCoachFile).mockReset());

it("shows imported and skipped record counts after choosing a file", async () => {
  vi.mocked(importMotionCoachFile)
    .mockResolvedValueOnce({ ok: true, imported: 1, skipped: 0, dates: ["2026-09-30"] })
    .mockResolvedValueOnce({ ok: true, imported: 0, skipped: 1, dates: [] });
  render(<MotionCoachImport />);
  const picker = screen.getByLabelText("选择 AI Motion Coach 导出文件");
  const file = new File(["{}"], "history.json", { type: "application/json" });
  fireEvent.change(picker, { target: { files: [file] } });
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("已导入 1 组，按记录编号跳过 0 组重复记录"));
  fireEvent.change(picker, { target: { files: [file] } });
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("已导入 0 组，按记录编号跳过 1 组重复记录"));
  expect(importMotionCoachFile).toHaveBeenCalledTimes(2);
});
