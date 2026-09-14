import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, join } from "node:path";
import { parse } from "yaml";
import { planSchema } from "../shared/fitness/index.js";
import { finalizePlanFile, finishWorkoutFromPlan, validateFitnessData } from "./data-store.js";
import { resolveWorkspacePaths } from "./workspace.js";
import { initializeWorkspace } from "./workspace-init.js";
import { migrateLegacyWorkspace } from "./workspace-migration.js";
import {
  commitOnboardingProfile,
  commitOnboardingProgram,
  getOnboardingState,
  saveOnboardingDraft,
  updateOnboardingProfile,
  commitOnboardingMetric
} from "./onboarding.js";

const [, , command, subject, ...args] = process.argv;
try {
  const paths = resolveWorkspacePaths();
  const dataRoot = paths.fitnessRoot;
  let result: unknown;
  if (command === "init") {
    result = await initializeWorkspace(paths);
  } else if (command === "migrate" && subject) {
    result = await migrateLegacyWorkspace(resolve(subject), paths.workspaceRoot);
  } else if (command === "onboarding" && subject === "status") {
    result = await getOnboardingState(paths);
  } else if (command === "draft" && subject === "profile" && args[0]) {
    result = await saveOnboardingDraft(paths, await yaml(args[0]));
  } else if (command === "commit" && subject === "profile" && args[0]) {
    result = await commitOnboardingProfile(paths, await yaml(args[0]));
  } else if (command === "update" && subject === "profile" && args[0] && args[1]) {
    result = await updateOnboardingProfile(paths, await yaml(args[0]), args[1]);
  } else if (
    command === "commit" &&
    (subject === "body" || subject === "cardio" || subject === "nutrition") &&
    args[0]
  ) {
    result = await commitOnboardingMetric(paths, subject, await yaml(args[0]));
  } else if (command === "commit" && subject === "program" && args[0]) {
    result = await commitOnboardingProgram(paths, await yaml(args[0]));
  } else if (command === "validate" && subject === "all") {
    result = await validateFitnessData({ dataRoot });
  } else if (command === "validate" && subject === "plan" && args[0]) {
    result = await validateFitnessData({ dataRoot }, normalizeDataPath(args[0], dataRoot));
  } else if ((command === "finalize" || command === "revise") && subject === "plan" && args[0]) {
    const input = resolve(args[0]);
    const draftRelative = relative(join(paths.runtimeRoot, "onboarding"), input);
    const isDraft = !draftRelative.startsWith("..") && !isAbsolute(draftRelative);
    const planPath = isDraft
      ? `plans/${planSchema.parse(await yaml(input)).date.slice(0, 4)}/${planSchema.parse(await yaml(input)).date}.generated.yaml`
      : normalizeDataPath(args[0], dataRoot);
    if (command === "revise" && (!isDraft || !args[1]))
      throw new Error("revise plan requires a runtime draft and expected plan SHA256");
    const record = await finalizePlanFile(
      { dataRoot },
      planPath,
      isDraft ? input : undefined,
      command === "revise" ? args[1] : undefined
    );
    result = {
      sourcePlanFile: record.sourcePlanFile,
      computed: record.plan.computed_expected_stimulus
    };
  } else if (command === "finish-workout" && subject && args[0]) {
    const finished = await finishWorkoutFromPlan(
      { dataRoot },
      {
        source_plan_file: normalizeDataPath(subject, dataRoot),
        actual: await yaml(args[0]),
        ...(args.includes("--confirmed-as-planned") ? { confirmed_as_planned: true } : {})
      }
    );
    result = { workoutFile: finished.workoutFile, computed: finished.computed };
  } else {
    throw new Error(
      "Usage: fitness init | migrate <legacy-app> | onboarding status | draft profile <yaml> | commit profile|program <yaml> | validate all | validate plan <path> | finalize plan <runtime-draft-or-plan> | finish-workout <plan> <actual-yaml> [--confirmed-as-planned]"
    );
  }
  console.log(JSON.stringify(result));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
async function yaml(file: string): Promise<unknown> {
  return parse(await readFile(file, "utf8"));
}
function normalizeDataPath(path: string, root: string) {
  const normalized = isAbsolute(path)
    ? relative(root, path)
    : path.replace(/^(fitness|data)\//, "");
  if (relative(root, resolve(root, normalized)).startsWith(".."))
    throw new Error("Path is outside fitness root");
  return normalized;
}
