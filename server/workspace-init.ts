import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { stringify, parse } from "yaml";
import { defaultApplicationSettings } from "./agent-settings.js";
import type { WorkspacePaths } from "./workspace.js";

async function createOnce(file: string, content: string) {
  try {
    await writeFile(file, content, { flag: "wx", mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
}
export async function initializeWorkspace(paths: WorkspacePaths) {
  for (const path of [
    paths.fitnessRoot,
    paths.configRoot,
    paths.runtimeRoot,
    paths.dshHome,
    join(paths.runtimeRoot, "automation"),
    join(paths.runtimeRoot, "onboarding")
  ])
    await mkdir(path, { recursive: true });
  const resources = parse(await readFile(join(paths.resourcesRoot, "manifest.yaml"), "utf8")) as {
    resource_version: string;
    calculation_rules_version: string;
  };
  await createOnce(
    join(paths.fitnessRoot, "manifest.yaml"),
    stringify({
      schema_version: 1,
      resource_version: resources.resource_version,
      calculation_rules_version: resources.calculation_rules_version
    })
  );
  await createOnce(join(paths.fitnessRoot, ".gitignore"), "*.tmp\n*.bak\n*.lock\n");
  await createOnce(paths.settingsFile, stringify(defaultApplicationSettings()));
  await createOnce(join(paths.workspaceRoot, "AGENTS.md"), workspaceNavigation(paths));
  return paths;
}
export function workspaceNavigation(paths: WorkspacePaths) {
  const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
  const installed = join(paths.appRoot, "server", "fitness-cli.js");
  const compiled = join(paths.appRoot, "dist-server", "server", "fitness-cli.js");
  const cli = existsSync(installed)
    ? `node ${quote(installed)}`
    : existsSync(join(paths.appRoot, "server/fitness-cli.ts"))
      ? `node ${quote(join(paths.appRoot, "node_modules/tsx/dist/cli.mjs"))} ${quote(join(paths.appRoot, "server/fitness-cli.ts"))}`
      : `node ${quote(compiled)}`;
  return `# 训练 Agent 文档地图\n\n健身数据：${paths.fitnessRoot}\n公共资源（只读）：${paths.resourcesRoot}\n\n- 建档：读取 ${join(paths.appRoot, "docs/product/ONBOARDING.md")}。\n- 数据校验与提交：读取 ${join(paths.appRoot, "docs/data/FITNESS-DATA-ARCHITECTURE.md")}。\n- 计划必读：fitness/profile.yaml → 目标日期 program → 最近 workouts 与 metrics → 公共动作规则 → 当日已有 plan。没有确认档案时先建档，不从案例补齐事实。\n- CLI：WORKSPACE_ROOT=${quote(paths.workspaceRoot)} ${cli}。\n- 草稿存放 runtime/onboarding；正式数据经 CLI 校验提交。计划与实际训练分开，不推测实际完成、RPE、疼痛和身体指标，不手写 computed。\n- 不得修改应用、公共资源、config、runtime/dsh；自动计划仅写目标日期计划及必要草稿。配置由应用管理。\n`;
}
