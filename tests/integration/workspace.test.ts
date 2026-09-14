import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, expect, test } from "vitest";
import { resolveWorkspacePaths } from "../../server/workspace.js";
import { initializeWorkspace } from "../../server/workspace-init.js";
import {
  readApplicationSettings,
  saveAgentSettings,
  saveAutomationSettings,
  saveSettingsSection
} from "../../server/agent-settings.js";
import {
  consolidateTrainingPreferences,
  migrateLegacyWorkspace
} from "../../server/workspace-migration.js";
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});
async function temp() {
  const root = await mkdtemp(join(tmpdir(), "fitness-workspace-"));
  roots.push(root);
  return root;
}
test("fresh workspaces stay blank and initialization preserves files", async () => {
  const paths = resolveWorkspacePaths({ workspaceRoot: await temp(), env: {} });
  await initializeWorkspace(paths);
  expect((await readdir(paths.fitnessRoot)).sort()).toEqual([".gitignore", "manifest.yaml"]);
  await writeFile(join(paths.fitnessRoot, "profile.yaml"), "existing");
  await initializeWorkspace(paths);
  expect(await readFile(join(paths.fitnessRoot, "profile.yaml"), "utf8")).toBe("existing");
  expect((await readApplicationSettings(paths.settingsFile)).automation.daily_plan.enabled).toBe(
    false
  );
});
test("conflicting independent path overrides fail", () => {
  expect(() =>
    resolveWorkspacePaths({ workspaceRoot: "/tmp/a", env: { DATA_ROOT: "/tmp/b" } })
  ).toThrow(/conflicts/);
  expect(
    resolveWorkspacePaths({ workspaceRoot: "/tmp/a", env: { DATA_ROOT: "/tmp/a/fitness" } })
      .fitnessRoot
  ).toBe("/tmp/a/fitness");
});
test("concurrent section saves preserve agent automation and model without keys", async () => {
  const paths = resolveWorkspacePaths({ workspaceRoot: await temp(), env: {} });
  await initializeWorkspace(paths);
  await Promise.all([
    saveAgentSettings(paths.settingsFile, { schema_version: 1, instructions: "简短回答" }),
    saveAutomationSettings(paths.settingsFile, {
      schema_version: 1,
      daily_plan: {
        enabled: true,
        local_time: "12:00",
        time_zone: "UTC",
        missed_run_policy: "run_once"
      }
    }),
    saveSettingsSection(paths.settingsFile, "model", {
      provider: "deepseek-official",
      model: "deepseek-v4-flash"
    })
  ]);
  const settings = await readApplicationSettings(paths.settingsFile);
  expect(settings.agent.instructions).toBe("简短回答");
  expect(settings.automation.daily_plan.enabled).toBe(true);
  expect(settings.model.model).toBe("deepseek-v4-flash");
  await expect(
    saveSettingsSection(paths.settingsFile, "model", { api_key: "must not persist" })
  ).rejects.toThrow();
});
test("migration preserves source and complete checksum backup and refuses overwrite", async () => {
  const source = await temp();
  const destination = await temp();
  await writeFile(join(source, "profile.yaml"), "schema_version: 1\ngoals:\n  primary: strength\n");
  const result = await migrateLegacyWorkspace(source, destination);
  expect(result.manifest.entries).toHaveLength(1);
  expect(await readFile(join(destination, "migration-backup/profile.yaml"), "utf8")).toBe(
    await readFile(join(source, "profile.yaml"), "utf8")
  );
  await expect(migrateLegacyWorkspace(source, destination)).rejects.toThrow(/empty destination/);
});

test("migration confirms an existing program using source metadata and consolidates preferences", async () => {
  const source = await temp();
  const destination = await temp();
  await mkdir(join(source, "data/programs"), { recursive: true });
  await writeFile(
    join(source, "data/programs/test.yaml"),
    "schema_version: 1\nid: existing\nname: existing direction\n"
  );
  const result = await migrateLegacyWorkspace(source, destination);
  expect(result.manifest.metadata_changes[0].source).toBe("original_file_mtime");
  expect(await readFile(join(destination, "fitness/programs/test.yaml"), "utf8")).toContain(
    "source: migration"
  );
  const preferences = consolidateTrainingPreferences(
    { exercise_selection: "retain", legacy_training_guidance: "old" },
    "1. warmup\n2. ramp\n3. main。先查历史负重\n4. area\n5. cooldown"
  );
  expect(preferences).toEqual({
    exercise_selection: "retain",
    warmup: "warmup",
    ramp_up_sets: "ramp",
    main_training: "main。",
    loading: "先查历史负重",
    training_area: "area",
    cooldown: "cooldown"
  });
});
