import { z } from "zod";
import { motionCoachExportSchema } from "../../shared/fitness/motion-coach";
import { postJson } from "./http";

const responseSchema = z.object({
  ok: z.literal(true),
  imported: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  dates: z.array(z.string())
});

export async function importMotionCoachFile(file: File) {
  if (file.size > 10_000_000) throw new Error("文件超过 10 MB，请分批导出后再试。");
  let payload: unknown;
  try {
    payload = JSON.parse(await file.text()) as unknown;
  } catch {
    throw new Error("文件不是有效的 JSON。");
  }
  const parsed = motionCoachExportSchema.safeParse(payload);
  if (!parsed.success) throw new Error("文件格式不符，或记录字段不完整。请从 AI Motion Coach 重新导出。");
  return postJson("/api/workouts/import-motion-coach", parsed.data, responseSchema);
}
