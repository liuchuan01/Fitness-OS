import { expect, test } from "@playwright/test";

test("imports Motion Coach history and skips the same record on retry", async ({ page }, testInfo) => {
  const payload = {
    format: "ai-motion-coach-history",
    schemaVersion: 1,
    exportedAt: "2026-09-30T10:00:00.000Z",
    sessions: [
      {
        id: `e2e-motion-coach-${testInfo.workerIndex}`,
        exercise: "russian_twist",
        localDate: "2026-09-30",
        endedAt: Date.parse("2026-09-30T12:00:00+08:00"),
        durationMs: 60_000,
        repCount: 12,
        attemptCount: 12,
        twistCountUnit: "sides",
        records: []
      }
    ]
  };

  await page.goto("/#/settings");
  const card = page.locator("details").filter({ has: page.getByRole("heading", { name: "训练记录导入" }) });
  await expect(card).toBeVisible();
  await card.locator("summary").click();
  const picker = page.getByLabel("选择 AI Motion Coach 导出文件");
  const file = { name: "motion-coach-history.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(payload)) };
  await picker.setInputFiles(file);
  await expect(card.getByRole("status")).toContainText("已导入 1 组，按记录编号跳过 0 组重复记录");
  await picker.setInputFiles(file);
  await expect(card.getByRole("status")).toContainText("已导入 0 组，按记录编号跳过 1 组重复记录");
  await page.screenshot({ path: testInfo.outputPath("motion-coach-import.png") });
});
