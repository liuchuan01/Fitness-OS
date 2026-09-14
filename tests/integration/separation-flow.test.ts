import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stringify, parse } from "yaml";
import { resolveWorkspacePaths, applicationRoot } from "../../server/workspace.js";
import { initializeWorkspace } from "../../server/workspace-init.js";
import { commitOnboardingProfile, getProfileRevision } from "../../server/onboarding.js";
import {
  buildDashboardFromFiles,
  finalizePlanFile,
  finishWorkoutFromPlan,
  validateFitnessData
} from "../../server/data-store.js";
import { AutomationScheduler } from "../../server/automation.js";
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function setup() {
  const root = await mkdtemp(join(tmpdir(), "fitness-flow-"));
  roots.push(root);
  const paths = resolveWorkspacePaths({ workspaceRoot: root, env: {} });
  await initializeWorkspace(paths);
  return paths;
}
async function profile(paths: Awaited<ReturnType<typeof setup>>) {
  return commitOnboardingProfile(paths, {
    schema_version: 1,
    goals: { primary: "了解基础训练" },
    training_constraints: { equipment: ["哑铃"] },
    confirmation: { source: "user_confirmed", confirmed_at: "2026-09-13T00:00:00Z" }
  });
}
async function draft(paths: Awaited<ReturnType<typeof setup>>) {
  const file = join(paths.runtimeRoot, "onboarding", "first-plan.yaml");
  await writeFile(
    file,
    stringify({
      schema_version: 1,
      id: "plan_2026-09-13",
      date: "2026-09-13",
      title: "首次练习",
      profile_revision: await getProfileRevision(paths),
      blocks: [
        {
          type: "strength",
          name: "练习",
          exercises: [
            {
              name: "哑铃划船",
              exercise_id: "horizontal_row",
              sets: [{ reps: 8, prescription: { load_selection: "现场选舒适重量", target_rpe: 6 } }]
            }
          ]
        }
      ]
    })
  );
  return file;
}
describe("separated workspace lifecycle", () => {
  it("starts empty, keeps two workspaces isolated and resolves CLI independently of cwd", async () => {
    const a = await setup(),
      b = await setup();
    await profile(a);
    const dashboard = await buildDashboardFromFiles({ dataRoot: b.fitnessRoot, readOnly: true });
    expect(
      dashboard.projection.bodyProjection.every((muscle) => muscle.recoveryScore === null)
    ).toBe(true);
    const run = promisify(execFile);
    const args = [
      join(applicationRoot, "node_modules/tsx/dist/cli.mjs"),
      join(applicationRoot, "server/fitness-cli.ts"),
      "onboarding",
      "status"
    ];
    const env = {
      ...process.env,
      WORKSPACE_ROOT: a.workspaceRoot,
      DATA_ROOT: "",
      RUNTIME_ROOT: "",
      DSH_HOME: ""
    };
    const fromApp = await run(process.execPath, args, { cwd: applicationRoot, env });
    const fromWorkspace = await run(process.execPath, args, { cwd: a.workspaceRoot, env });
    expect(JSON.parse(fromApp.stdout)).toEqual(JSON.parse(fromWorkspace.stdout));
    expect(JSON.parse(fromApp.stdout).profileConfirmed).toBe(true);
    expect(await readFile(b.settingsFile, "utf8")).not.toContain("了解基础训练");
  });
  it("rejects stale profile drafts and conflicting submissions, and never treats prescriptions as completion", async () => {
    const paths = await setup();
    await profile(paths);
    const file = await draft(paths);
    const source = "plans/2026/2026-09-13.generated.yaml";
    const content = await readFile(join(paths.fitnessRoot, "profile.yaml"), "utf8");
    await writeFile(join(paths.fitnessRoot, "profile.yaml"), content + "\n");
    await expect(finalizePlanFile({ dataRoot: paths.fitnessRoot }, source, file)).rejects.toThrow(
      "PROFILE_REVISION_CONFLICT"
    );
    await draft(paths);
    await finalizePlanFile({ dataRoot: paths.fitnessRoot }, source, file);
    await expect(finalizePlanFile({ dataRoot: paths.fitnessRoot }, source, file)).rejects.toThrow(
      "already exists"
    );
    const planBytes = await readFile(join(paths.fitnessRoot, source));
    await expect(
      finalizePlanFile({ dataRoot: paths.fitnessRoot }, source, file, "stale")
    ).rejects.toThrow("PLAN_REVISION_CONFLICT");
    const updatedDraft = parse(await readFile(file, "utf8"));
    updatedDraft.title = "调整后的首次练习";
    await writeFile(file, stringify(updatedDraft));
    await finalizePlanFile(
      { dataRoot: paths.fitnessRoot },
      source,
      file,
      createHash("sha256").update(planBytes).digest("hex")
    );
    expect(parse(await readFile(join(paths.fitnessRoot, source), "utf8")).title).toBe(
      "调整后的首次练习"
    );
    await expect(
      finishWorkoutFromPlan({ dataRoot: paths.fitnessRoot }, { source_plan_file: source })
    ).rejects.toThrow("explicitly confirm");
    await expect(
      finishWorkoutFromPlan(
        { dataRoot: paths.fitnessRoot },
        { source_plan_file: source, confirmed_as_planned: true }
      )
    ).rejects.toThrow("reported actual");
    const actual = {
      blocks: [
        {
          type: "strength",
          name: "完成",
          exercises: [
            { name: "哑铃划船", exercise_id: "horizontal_row", sets: [{ reps: 8, weight_kg: 4 }] }
          ]
        }
      ]
    };
    const results = await Promise.allSettled(
      [1, 2].map(() =>
        finishWorkoutFromPlan({ dataRoot: paths.fitnessRoot }, { source_plan_file: source, actual })
      )
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    await expect(validateFitnessData({ dataRoot: paths.fitnessRoot })).resolves.toMatchObject({
      plans: 1,
      workouts: 1
    });
    const workoutPath = join(paths.fitnessRoot, "workouts/2026/2026-09-13.yaml");
    const workout = parse(await readFile(workoutPath, "utf8"));
    for (const reference of ["profile.yaml", "plans/"]) {
      await writeFile(workoutPath, stringify({ ...workout, source_plan_file: reference }));
      await expect(validateFitnessData({ dataRoot: paths.fitnessRoot })).rejects.toThrow(
        "Invalid workout source reference"
      );
    }
    await writeFile(workoutPath, stringify(workout));
  });
  it("ignores Git metadata during validation, rejects rule mismatch and skips automation before profile confirmation", async () => {
    const paths = await setup();
    await mkdir(join(paths.fitnessRoot, "programs/.git"), { recursive: true });
    await writeFile(join(paths.fitnessRoot, "programs/.git", "invalid.yaml"), "invalid: [");
    await expect(validateFitnessData({ dataRoot: paths.fitnessRoot })).resolves.toMatchObject({
      plans: 0,
      workouts: 0
    });
    const runtime = { run: vi.fn(), close: vi.fn() };
    const scheduler = new AutomationScheduler(
      paths.workspaceRoot,
      paths.fitnessRoot,
      paths.settingsFile,
      join(paths.runtimeRoot, "automation/state.yaml"),
      join(paths.runtimeRoot, "automation/runs"),
      runtime
    );
    const state = await scheduler.runNow();
    expect(state.daily_plan.last_run?.outcome?.code).toBe("profile_required");
    expect(runtime.run).not.toHaveBeenCalled();
    const manifest = parse(await readFile(join(paths.fitnessRoot, "manifest.yaml"), "utf8"));
    await writeFile(
      join(paths.fitnessRoot, "manifest.yaml"),
      stringify({ ...manifest, calculation_rules_version: "unsupported" })
    );
    await expect(validateFitnessData({ dataRoot: paths.fitnessRoot })).rejects.toThrow(
      "version mismatch"
    );
  });
});
