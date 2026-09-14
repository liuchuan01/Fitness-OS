import { stat, cp, chmod, copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, join, resolve, relative } from "node:path";
import { parse, stringify } from "yaml";
import {
  agentSettingsSchema,
  automationSettingsSchema,
  defaultApplicationSettings
} from "./agent-settings.js";
import { migrateCalculationSemantics } from "./workspace-calculation-migration.js";
import { initializeWorkspace } from "./workspace-init.js";
import { resolveWorkspacePaths } from "./workspace.js";

async function files(root: string, prefix = ""): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(join(root, prefix), { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const result: string[] = [];
  for (const entry of entries) {
    if (entry.name === ".git") continue;
    const file = join(prefix, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Migration refuses symlink: ${join(root, file)}`);
    if (entry.isDirectory()) result.push(...(await files(root, file)));
    else if (entry.isFile()) result.push(file);
  }
  return result.sort();
}
export async function migrateLegacyWorkspace(sourceRoot: string, destinationRoot: string) {
  const source = resolve(sourceRoot);
  const destination = resolve(destinationRoot);
  if (source === destination || !relative(source, destination).startsWith(".."))
    throw new Error("Migration destination must be outside the original workspace");
  await mkdir(destination, { recursive: true });
  if ((await readdir(destination)).length)
    throw new Error("Migration requires an empty destination; original data is never overwritten");
  const backup = join(destination, "migration-backup");
  const paths = resolveWorkspacePaths({ workspaceRoot: destination, env: {} });
  await mkdir(backup, { recursive: true, mode: 0o700 });
  const entries: { source: string; target: string; sha256: string; bytes: number }[] = [];
  const roots = [
    "profile.yaml",
    "data/Agent.md",
    "data/agent/settings.yaml",
    "data/automation/schedule.yaml"
  ];
  for (const kind of ["workouts", "plans", "programs", "metrics", "imports", "exercises"]) {
    roots.push(
      ...(await files(join(source, "data", kind))).map((file) => join("data", kind, file))
    );
  }
  for (const file of roots) {
    let content;
    try {
      content = await readFile(join(source, file));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    const target =
      file === "profile.yaml"
        ? "fitness/profile.yaml"
        : file.startsWith("data/")
          ? file.replace(/^data\//u, "fitness/")
          : file;
    await mkdir(dirname(join(backup, file)), { recursive: true });
    await copyFile(join(source, file), join(backup, file));
    entries.push({
      source: file,
      target,
      sha256: createHash("sha256").update(content).digest("hex"),
      bytes: content.length
    });
    if (
      ["data/Agent.md", "data/agent/settings.yaml", "data/automation/schedule.yaml"].includes(file)
    )
      continue;
    await mkdir(dirname(join(destination, target)), { recursive: true });
    await writeFile(join(destination, target), content, { flag: "wx" });
  }
  await initializeWorkspace(paths);
  // Preserve old Host/session/scheduler state as an archive, never activate it under a new cwd.
  try {
    await cp(join(source, "runtime"), join(backup, "runtime"), {
      recursive: true,
      verbatimSymlinks: true
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  try {
    await copyFile(
      join(source, "runtime/dsh/.credentials.yaml"),
      join(paths.configRoot, "dsh-credentials.yaml")
    );
    await chmod(join(paths.configRoot, "dsh-credentials.yaml"), 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const settings = defaultApplicationSettings();
  for (const [file, kind, schema] of [
    ["data/agent/settings.yaml", "agent", agentSettingsSchema],
    ["data/automation/schedule.yaml", "automation", automationSettingsSchema]
  ] as const) {
    try {
      const value = schema.parse(parse(await readFile(join(backup, file), "utf8")));
      Object.assign(settings, { [kind]: value });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  const originalInstructions = settings.agent.instructions;
  settings.agent.instructions = migrateLegacyAgentInstructions(originalInstructions);
  await writeFile(paths.settingsFile, stringify(settings), { mode: 0o600 });
  // Existing profile values are preserved; exact original personal preferences are also retained.
  try {
    const text = await readFile(join(backup, "data/Agent.md"), "utf8");
    const preferenceText = /## 训练计划默认编排偏好\n([\s\S]*?)(?=\n## |$)/u
      .exec(text)?.[1]
      ?.trim();
    if (preferenceText) {
      const profileFile = join(paths.fitnessRoot, "profile.yaml");
      const originalProfile = await readFile(profileFile, "utf8");
      const profile = parse(originalProfile) as Record<string, unknown>;
      const preferences = (profile.preferences ?? {}) as Record<string, unknown>;
      profile.preferences = consolidateTrainingPreferences(preferences, preferenceText);
      await writeFile(profileFile, stringify(profile));
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  // Use the actual recorded profile revision date, never invent an observation date.
  const profileFile = join(paths.fitnessRoot, "profile.yaml");
  try {
    const originalProfile = await readFile(profileFile, "utf8");
    const profile = parse(originalProfile) as Record<string, unknown>;
    let sourceDate: string | undefined;
    try {
      sourceDate =
        execFileSync("git", ["-C", source, "log", "-1", "--format=%cI", "--", "profile.yaml"], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"]
        }).trim() || undefined;
    } catch {
      /* Non-Git imports remain unconfirmed. */
    }
    if (sourceDate && Number.isFinite(Date.parse(sourceDate))) {
      const user = (profile.user ?? {}) as Record<string, unknown>;
      if (user.age_years !== undefined && !user.age_as_of) {
        const original = await readFile(join(backup, "profile.yaml"), "utf8");
        const line = original.split("\n").findIndex((line) => /^\s+age_years:/.test(line)) + 1;
        if (line > 0) {
          const blame = execFileSync(
            "git",
            [
              "-C",
              source,
              "blame",
              "--line-porcelain",
              "-L",
              `${line},${line}`,
              "HEAD",
              "--",
              "profile.yaml"
            ],
            { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
          );
          const epoch = /^author-time (\d+)$/m.exec(blame)?.[1];
          if (epoch) user.age_as_of = new Date(Number(epoch) * 1000).toISOString().slice(0, 10);
        }
      }
      profile.user = user;
      profile.confirmation ??= {
        confirmed_at: new Date(sourceDate).toISOString(),
        source: "migration"
      };
      await writeFile(profileFile, stringify(profile));
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  for (const entry of entries) {
    const actual = createHash("sha256")
      .update(await readFile(join(backup, entry.source)))
      .digest("hex");
    if (actual !== entry.sha256) throw new Error(`Backup hash mismatch: ${entry.source}`);
  }
  const metadataChanges = await confirmMigratedPrograms(source, paths.fitnessRoot);
  const calculationMigration = await migrateCalculationSemantics(paths);
  const manifest = {
    schema_version: 1,
    metadata_changes: metadataChanges,
    agent_settings_path_adapted: settings.agent.instructions !== originalInstructions,
    preference_migration:
      "Consolidated warmup, ramp_up_sets, main_training, training_area, cooldown and loading; original guide retained only in backup",
    calculation_migration: {
      version: "2",
      changed_workouts: calculationMigration.changes.length,
      report: "calculation-migration-report.json"
    },
    created_at: new Date().toISOString(),
    entries,
    dsh_state:
      "archived at migration-backup/runtime; not activated: changed workspace identity requires explicit verification",
    status: "copied; validate fitness before switching"
  };
  await writeFile(join(destination, "migration-manifest.json"), JSON.stringify(manifest, null, 2));
  return { paths, manifest };
}

export async function confirmMigratedPrograms(sourceRoot: string, fitnessRoot: string) {
  const changes: { file: string; source: string; confirmed_at: string }[] = [];
  for (const file of await files(join(fitnessRoot, "programs"))) {
    if (!/\.ya?ml$/.test(file)) continue;
    const target = join(fitnessRoot, "programs", file);
    const program = parse(await readFile(target, "utf8")) as Record<string, unknown>;
    if (program.confirmation) continue;
    const original = join("data", "programs", file);
    let date: string | undefined;
    let provenance = "original_file_mtime";
    try {
      date =
        execFileSync("git", ["-C", sourceRoot, "log", "-1", "--format=%cI", "--", original], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"]
        }).trim() || undefined;
      if (date) provenance = "original_git_revision";
    } catch {
      /* Preserve non-Git imports with their source file time. */
    }
    date ??= (await stat(join(sourceRoot, original))).mtime.toISOString();
    program.confirmation = { confirmed_at: new Date(date).toISOString(), source: "migration" };
    await writeFile(target, stringify(program));
    changes.push({
      file: join("programs", file),
      source: provenance,
      confirmed_at: new Date(date).toISOString()
    });
  }
  return changes;
}

export function consolidateTrainingPreferences(preferences: Record<string, unknown>, text: string) {
  const next = { ...preferences };
  delete next.legacy_training_guidance;
  const items = [...text.matchAll(/^([1-5])\. (.+)$/gm)];
  const names = ["warmup", "ramp_up_sets", "main_training", "training_area", "cooldown"];
  for (const match of items) {
    const key = names[Number(match[1]) - 1];
    if (key === "main_training") {
      const split = match[2].indexOf("先查");
      next[key] = split < 0 ? match[2] : match[2].slice(0, split).trim();
      if (split >= 0) next.loading = match[2].slice(split);
    } else next[key] = match[2];
  }
  return next;
}

export function migrateLegacyAgentInstructions(instructions: string) {
  return instructions
    .replace(/data\/Agent\.md/g, "AGENTS.md")
    .replace(/data\/README(?:\.md)?/g, "AGENTS.md（按导航读取正式数据契约）")
    .replace(/(?<![\w/])profile\.yaml/g, "fitness/profile.yaml")
    .replace(/(?<![\w/])data\//g, "fitness/");
}
