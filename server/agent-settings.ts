import { copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { parse, stringify } from "yaml";
import { z } from "zod";
import { xparseSettingsSchema } from "../shared/xparse.js";

export const defaultAgentInstructions = `你是 AI Fitness OS 的健身教练，用中文与用户协作。
先读取工作区 AGENTS.md，按照任务地图读取当前档案、周期与训练数据。
只根据已记录或用户明确提供的事实回答，不推测实际完成训练、疼痛、RPE 或身体指标。
写入业务数据先创建草稿，再调用 Fitness CLI 校验和提交。
不手写 computed 字段，不修改应用源码，不把计划当作已完成训练。`;
export const agentSettingsSchema = z
  .object({ schema_version: z.literal(1), instructions: z.string().trim().min(1).max(12_000) })
  .strict();
export type AgentSettings = z.output<typeof agentSettingsSchema>;
export const defaultAgentSettings: AgentSettings = {
  schema_version: 1,
  instructions: defaultAgentInstructions
};
export const automationSettingsSchema = z
  .object({
    schema_version: z.literal(1),
    daily_plan: z
      .object({
        enabled: z.boolean(),
        local_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        time_zone: z.string().refine((value) => {
          try {
            new Intl.DateTimeFormat("en", { timeZone: value });
            return true;
          } catch {
            return false;
          }
        }, "Invalid time zone"),
        missed_run_policy: z.literal("run_once")
      })
      .strict()
  })
  .strict();
export const defaultAutomationSettings = automationSettingsSchema.parse({
  schema_version: 1,
  daily_plan: {
    enabled: false,
    local_time: "09:00",
    time_zone: "Asia/Shanghai",
    missed_run_policy: "run_once"
  }
});
export const modelSettingsSchema = z
  .object({
    provider: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    credential_ref: z.string().min(1).optional()
  })
  .strict();
export const applicationSettingsSchema = z
  .object({
    schema_version: z.literal(1),
    agent: agentSettingsSchema,
    automation: automationSettingsSchema,
    model: modelSettingsSchema,
    xparse: xparseSettingsSchema.default({ enabled: false, allowPaid: false })
  })
  .strict();
export type ApplicationSettings = z.output<typeof applicationSettingsSchema>;
export function defaultApplicationSettings(): ApplicationSettings {
  return applicationSettingsSchema.parse({
    schema_version: 1,
    agent: defaultAgentSettings,
    automation: defaultAutomationSettings,
    model: {}
  });
}
export async function readApplicationSettings(file: string): Promise<ApplicationSettings> {
  try {
    return applicationSettingsSchema.parse(parse(await readFile(file, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return defaultApplicationSettings();
    throw error;
  }
}
// Queue read/merge/write by canonical filename, including callers from different service instances.
const writes = new Map<string, Promise<unknown>>();
export async function saveSettingsSection<K extends "agent" | "automation" | "model" | "xparse">(
  file: string,
  section: K,
  value: unknown
): Promise<ApplicationSettings[K]> {
  const key = resolve(file);
  const run = (writes.get(key) ?? Promise.resolve())
    .catch(() => {})
    .then(async () => {
      const settings = await readApplicationSettings(key);
      const next = applicationSettingsSchema.parse({ ...settings, [section]: value });
      await mkdir(dirname(key), { recursive: true });
      const lock = `${key}.lock`;
      try {
        await mkdir(lock);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST")
          throw new Error(`Settings are being saved by another process: ${key}`);
        throw error;
      }
      const temporary = `${key}.${randomUUID()}.tmp`;
      try {
        // Read again after taking the cross-process lock to preserve unrelated sections.
        const current = await readApplicationSettings(key);
        const merged = applicationSettingsSchema.parse({ ...current, [section]: next[section] });
        try {
          await copyFile(key, `${key}.${randomUUID()}.bak`);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        await writeFile(temporary, stringify(merged), { mode: 0o600, flag: "wx" });
        await rename(temporary, key);
        return merged[section];
      } finally {
        await rm(temporary, { force: true });
        await rm(lock, { recursive: true, force: true });
      }
    });
  writes.set(key, run);
  try {
    return await run;
  } finally {
    if (writes.get(key) === run) writes.delete(key);
  }
}
export async function readAgentSettings(file: string) {
  return (await readApplicationSettings(file)).agent;
}
export async function saveAgentSettings(file: string, value: unknown) {
  return saveSettingsSection(file, "agent", value);
}
export async function readAutomationSettings(file: string) {
  return (await readApplicationSettings(file)).automation;
}
export async function saveAutomationSettings(file: string, value: unknown) {
  return saveSettingsSection(file, "automation", value);
}
