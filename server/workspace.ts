import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function installationRoot() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  return existsSync(join(root, "resources", "fitness")) ? root : resolve(root, "..");
}

export const applicationRoot = installationRoot();
export type WorkspacePaths = ReturnType<typeof resolveWorkspacePaths>;

/** Every production entry uses these paths; legacy overrides may only repeat the derived path. */
export function resolveWorkspacePaths(
  options: {
    workspaceRoot?: string;
    dataRoot?: string;
    runtimeRoot?: string;
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  } = {}
) {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const workspaceRoot = resolve(
    cwd,
    options.workspaceRoot ?? env.WORKSPACE_ROOT ?? join(applicationRoot, ".workspaces", "default")
  );
  const fitnessRoot = join(workspaceRoot, "fitness");
  const configRoot = join(workspaceRoot, "config");
  const runtimeRoot = join(workspaceRoot, "runtime");
  const dshHome = join(runtimeRoot, "dsh");
  for (const [name, value, expected] of [
    ["DATA_ROOT", options.dataRoot ?? env.DATA_ROOT, fitnessRoot],
    ["FITNESS_ROOT", env.FITNESS_ROOT, fitnessRoot],
    ["RUNTIME_ROOT", options.runtimeRoot ?? env.RUNTIME_ROOT, runtimeRoot],
    ["DSH_HOME", env.DSH_HOME, dshHome]
  ]) {
    if (value && resolve(cwd, value) !== expected)
      throw new Error(`${name} conflicts with WORKSPACE_ROOT: expected ${expected}`);
  }
  return {
    appRoot: applicationRoot,
    workspaceRoot,
    fitnessRoot,
    configRoot,
    runtimeRoot,
    dshHome,
    settingsFile: join(configRoot, "settings.yaml"),
    resourcesRoot: join(applicationRoot, "resources", "fitness")
  };
}
