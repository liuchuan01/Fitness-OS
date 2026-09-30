import { createHash } from "node:crypto";
import { buildMuscleHistory } from "../shared/fitness/muscle-history.js";
import {
  muscleHistoryQuerySchema,
  muscleHistoryResponseSchema
} from "../shared/fitness/muscle-history-schema.js";
import {
  mkdir,
  readdir,
  readFile,
  rename,
  stat,
  copyFile,
  writeFile,
  link,
  unlink,
  realpath,
  lstat
} from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { parse, stringify } from "yaml";
import {
  buildDashboardProjection,
  buildDailyWorkoutView,
  buildEmptyDashboardProjection,
  buildPlanPreview,
  buildTimeline,
  calculateStimulus,
  muscleMapSchema,
  planSchema,
  stimulusRulesSchema,
  workoutSchema
} from "../shared/fitness/index.js";

import { z } from "zod";
import { resolveWorkspacePaths } from "./workspace.js";
import { motionCoachExercise, motionCoachExportSchema } from "../shared/fitness/motion-coach.js";
import {
  assertProfileRevision,
  validateOnboardingData,
  withProfileRevision
} from "./onboarding.js";
import type {
  DailyWorkoutViewModel,
  DashboardViewModel,
  Plan,
  PlanPreview,
  StimulusResult,
  TimelineWorkout,
  Workout
} from "../shared/fitness/index.js";

export type FitnessDataStoreOptions = {
  dataRoot: string;
  readOnly?: boolean;
  resourcesRoot?: string;
};

export type DashboardComputation = {
  projection: DashboardViewModel;
  updated: {
    workoutFile?: string;
    planFile?: string;
  };
};

export type WorkoutLibrary = {
  timeline: TimelineWorkout[];
  workouts: Workout[];
};

export type PlanRecord = {
  plan: Plan;
  preview: PlanPreview;
  sourcePlanFile: string;
};

const finishWorkoutInputSchema = z.object({
  source_plan_file: z.string().min(1),
  confirmed_as_planned: z.literal(true).optional(),
  actual: z
    .object({
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      title: z.string().min(1).optional(),
      bodyweight_kg: z.number().positive().optional(),
      readiness: workoutSchema.shape.readiness.optional(),
      blocks: workoutSchema.shape.blocks.optional()
    })
    .default({})
});

export type FinishWorkoutInput = z.input<typeof finishWorkoutInputSchema>;

export type FinishedWorkout = {
  workout: Workout;
  workoutFile: string;
  computed: StimulusResult;
};

export type ValidationSummary = {
  plans: number;
  workouts: number;
};

export type MotionCoachImportResult = { imported: number; skipped: number; dates: string[] };

let motionCoachImportQueue: Promise<void> = Promise.resolve();

export function importMotionCoachHistory(
  options: FitnessDataStoreOptions,
  input: unknown
): Promise<MotionCoachImportResult> {
  const run = motionCoachImportQueue.then(() => importMotionCoachHistorySerial(options, input));
  motionCoachImportQueue = run.then(() => undefined, () => undefined);
  return run;
}

async function importMotionCoachHistorySerial(
  options: FitnessDataStoreOptions,
  input: unknown
): Promise<MotionCoachImportResult> {
  if (options.readOnly) throw new Error("Import requires a writable fitness workspace");
  const payload = motionCoachExportSchema.parse(input);
  const files = await listYamlFiles(join(options.dataRoot, "workouts"));
  const existing = new Map<string, Workout>();
  const ids = new Set<string>();
  for (const file of files) {
    const workout = await readYaml(file, workoutSchema, "workout");
    existing.set(workout.date, workout);
    for (const block of workout.blocks)
      for (const exercise of block.exercises)
        if (exercise.source?.system === "ai-motion-coach") ids.add(exercise.source.record_id);
  }

  const additions = new Map<string, ReturnType<typeof motionCoachExercise>[]>();
  let skipped = 0;
  for (const session of payload.sessions) {
    if (ids.has(session.id)) {
      skipped += 1;
      continue;
    }
    ids.add(session.id);
    const day = additions.get(session.localDate) ?? [];
    day.push(motionCoachExercise(session));
    additions.set(session.localDate, day);
  }
  if (additions.size === 0) return { imported: 0, skipped, dates: [] };

  const { muscleMap, stimulusRules } = await readCalculationInputs(options);
  const dates = [...additions.keys()].sort();
  for (const date of dates) {
    const previous = existing.get(date);
    const blocks = previous ? structuredClone(previous.blocks) : [];
    let block = blocks.find((item) => item.type === "motion_coach" && item.name === "AI Motion Coach");
    if (!block) {
      block = { type: "motion_coach", name: "AI Motion Coach", exercises: [] };
      blocks.push(block);
    }
    block.exercises.push(...additions.get(date)!);
    const draft = workoutSchema.parse(previous
      ? { ...previous, blocks, computed: undefined }
      : { schema_version: 1, id: `workout_${date}`, date, title: "AI Motion Coach 训练", readiness: {}, blocks });
    const workout = workoutSchema.parse({
      ...draft,
      computed: calculateStimulus(draft, muscleMap, stimulusRules)
    });
    const file = join(options.dataRoot, "workouts", date.slice(0, 4), `${date}.yaml`);
    await assertSafeParent(options.dataRoot, file);
    if (previous) await writeYamlAtomic(file, workout);
    else await writeYamlNew(file, workout);
  }
  return { imported: payload.sessions.length - skipped, skipped, dates };
}

async function readCalculationInputs(options: FitnessDataStoreOptions) {
  const resourcesRoot = options.resourcesRoot ?? resolveWorkspacePaths().resourcesRoot;
  const manifestFile = join(options.dataRoot, "manifest.yaml");
  if (await pathExists(manifestFile)) {
    const dataManifest = parse(await readFile(manifestFile, "utf8"));
    const resources = parse(await readFile(join(resourcesRoot, "manifest.yaml"), "utf8"));
    if (
      dataManifest.resource_version !== resources.resource_version ||
      dataManifest.calculation_rules_version !== resources.calculation_rules_version
    )
      throw new Error("Fitness resource/rules version mismatch; explicit migration is required");
  }
  const muscleMap = await readYaml(
    join(resourcesRoot, "muscles", "muscle_map.yaml"),
    muscleMapSchema,
    "muscle_map"
  );
  const stimulusRules = await readYaml(
    join(resourcesRoot, "muscles", "stimulus_rules.yaml"),
    stimulusRulesSchema,
    "stimulus_rules"
  );
  return { muscleMap, stimulusRules };
}

export async function getPlanForDate(
  options: FitnessDataStoreOptions,
  date: string
): Promise<PlanRecord | undefined> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Plan date must use YYYY-MM-DD");
  }

  const { muscleMap, stimulusRules } = await readCalculationInputs(options);
  const planFiles = await listYamlFiles(join(options.dataRoot, "plans"));
  const matchingFile = planFiles.find((file) => file.endsWith(`/${date}.generated.yaml`));
  if (!matchingFile) return undefined;

  const { plan, hasForbiddenFields } = await readPlanYaml(matchingFile);
  const computedExpectedStimulus = calculateStimulus(plan, muscleMap, stimulusRules).stimulus;
  const planWithComputed: Plan = {
    ...plan,
    computed_expected_stimulus: computedExpectedStimulus
  };
  const preview = buildPlanPreview(planWithComputed, muscleMap, stimulusRules);

  if (hasForbiddenFields || !sameJson(plan.computed_expected_stimulus, computedExpectedStimulus)) {
    if (options.readOnly)
      throw new Error("Plan has not passed finalize/validate; the draft was not changed");
    await writeYamlAtomic(matchingFile, planWithComputed);
  }

  return {
    plan: planWithComputed,
    preview,
    sourcePlanFile: relative(options.dataRoot, matchingFile)
  };
}

export async function finalizePlanFile(
  options: FitnessDataStoreOptions,
  planPath: string,
  draftFile?: string,
  expectedPlanRevision?: string
): Promise<PlanRecord> {
  const file = resolve(options.dataRoot, planPath);
  const relativePath = relative(options.dataRoot, file);
  if (relativePath.startsWith("..") || !relativePath.startsWith("plans/")) {
    throw new Error("Plan path must be inside data/plans");
  }
  await assertSafeParent(options.dataRoot, file);
  const { plan, hasForbiddenFields } = await readPlanYaml(draftFile ?? file);
  if (relativePath !== `plans/${plan.date.slice(0, 4)}/${plan.date}.generated.yaml`)
    throw new Error("Plan path must match its date");
  if (hasForbiddenFields) throw new Error("Plan contains workout-only fields");
  if (plan.computed_expected_stimulus !== undefined) {
    throw new Error(
      "Plan draft must not contain computed_expected_stimulus; remove it before finalize"
    );
  }
  await assertProfileRevision({ fitnessRoot: options.dataRoot }, plan.profile_revision);
  const { muscleMap, stimulusRules } = await readCalculationInputs(options);
  const finalized: Plan = {
    ...plan,
    computed_expected_stimulus: calculateStimulus(plan, muscleMap, stimulusRules).stimulus
  };
  await withProfileRevision(
    { fitnessRoot: options.dataRoot, runtimeRoot: join(dirname(options.dataRoot), "runtime") },
    plan.profile_revision,
    async () => {
      if (expectedPlanRevision) {
        const current = createHash("sha256")
          .update(await readFile(file))
          .digest("hex");
        if (current !== expectedPlanRevision) throw new Error("PLAN_REVISION_CONFLICT");
        await writeYamlAtomic(file, finalized);
      } else if (draftFile) await writeYamlNew(file, finalized);
      else await writeYamlAtomic(file, finalized);
    }
  );
  return {
    plan: finalized,
    preview: buildPlanPreview(finalized, muscleMap, stimulusRules),
    sourcePlanFile: relativePath
  };
}

export async function validateFitnessData(
  options: FitnessDataStoreOptions,
  planPath?: string
): Promise<ValidationSummary> {
  const { muscleMap, stimulusRules } = await readCalculationInputs(options);
  const planFiles = planPath
    ? [join(options.dataRoot, planPath)]
    : await listYamlFiles(join(options.dataRoot, "plans"));
  const workoutFiles = planPath ? [] : await listYamlFiles(join(options.dataRoot, "workouts"));
  for (const file of planFiles) {
    const relativePath = relative(options.dataRoot, file);
    if (relativePath.startsWith("..") || !relativePath.startsWith("plans/"))
      throw new Error("Plan path must be inside data/plans");
    const { plan, hasForbiddenFields } = await readPlanYaml(file);
    if (hasForbiddenFields) throw new Error(`${relativePath} contains workout-only fields`);
    if (relativePath !== `plans/${plan.date.slice(0, 4)}/${plan.date}.generated.yaml`)
      throw new Error(`${relativePath} does not match plan date`);
    const expected = calculateStimulus(plan, muscleMap, stimulusRules).stimulus;
    if (!sameJson(plan.computed_expected_stimulus, expected))
      throw new Error(`${relativePath} has stale or missing computed_expected_stimulus`);
  }
  for (const file of workoutFiles) {
    const workout = await readYaml(file, workoutSchema, "workout");
    if (
      relative(options.dataRoot, file) !==
      `workouts/${workout.date.slice(0, 4)}/${workout.date}.yaml`
    )
      throw new Error("Workout path does not match its date");
    for (const [source, prefix] of [
      [workout.source_plan_file, "plans/"],
      [workout.source_import_file, "imports/raw/"]
    ] as const) {
      if (!source) continue;
      const target = resolve(options.dataRoot, source);
      if (
        !source.startsWith(prefix) ||
        relative(options.dataRoot, target).startsWith("..") ||
        !(await pathExists(target))
      )
        throw new Error(`Invalid workout source reference: ${source}`);
      const base = await realpath(options.dataRoot);
      const actual = await realpath(target);
      if (!(await lstat(target)).isFile() || !relative(base, actual).startsWith(prefix))
        throw new Error(`Invalid workout source reference: ${source}`);
    }
    const expected = calculateStimulus(workout, muscleMap, stimulusRules);
    if (!sameJson(workout.computed, expected))
      throw new Error(`${relative(options.dataRoot, file)} has stale or missing computed`);
  }
  if (!planPath) await validateOnboardingData({ fitnessRoot: options.dataRoot });
  return { plans: planFiles.length, workouts: workoutFiles.length };
}

export async function finishWorkoutFromPlan(
  options: FitnessDataStoreOptions,
  input: unknown
): Promise<FinishedWorkout> {
  const parsedInput = finishWorkoutInputSchema.parse(input);
  const planFiles = await listYamlFiles(join(options.dataRoot, "plans"));
  const sourcePlan = planFiles.find(
    (file) => relative(options.dataRoot, file) === parsedInput.source_plan_file
  );

  if (!sourcePlan) {
    throw new Error("source_plan_file does not reference an existing plan");
  }

  const { plan } = await readPlanYaml(sourcePlan);
  const actual = parsedInput.actual;
  if (!actual.blocks && !parsedInput.confirmed_as_planned)
    throw new Error("Provide actual blocks or explicitly confirm completed plan contents");
  if (
    !actual.blocks &&
    plan.blocks.some((block) =>
      block.exercises.some((exercise) =>
        exercise.sets.some((set) => set.prescription && set.weight_kg === undefined)
      )
    )
  )
    throw new Error("A load-selection prescription requires reported actual blocks");
  const date = actual.date ?? plan.date;
  const workoutDraft = workoutSchema.parse({
    schema_version: plan.schema_version,
    id: `workout_${date}`,
    date,
    title: actual.title ?? plan.title,
    bodyweight_kg: actual.bodyweight_kg,
    readiness: actual.readiness ?? {},
    blocks: actual.blocks ?? projectPlanBlocksToActual(plan.blocks),
    source_plan_file: parsedInput.source_plan_file
  });
  const { muscleMap, stimulusRules } = await readCalculationInputs(options);
  const computed = calculateStimulus(workoutDraft, muscleMap, stimulusRules);
  const workout = workoutSchema.parse({ ...workoutDraft, computed });
  const workoutFile = join(options.dataRoot, "workouts", date.slice(0, 4), `${date}.yaml`);

  if (await pathExists(workoutFile)) {
    throw new Error(`Workout already exists for ${date}`);
  }

  await assertSafeParent(options.dataRoot, workoutFile);
  await writeYamlNew(workoutFile, workout);

  return {
    workout,
    workoutFile: relative(options.dataRoot, workoutFile),
    computed
  };
}

function projectPlanBlocksToActual(blocks: Plan["blocks"]): Plan["blocks"] {
  return blocks.map((block) => ({
    ...block,
    exercises: block.exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) => {
        const actualSet = { ...set };
        delete actualSet.rpe;
        delete actualSet.prescription;
        return actualSet;
      })
    }))
  }));
}

export async function listWorkoutLibrary(
  options: FitnessDataStoreOptions,
  search = "",
  today = new Date().toISOString().slice(0, 10)
): Promise<WorkoutLibrary> {
  const { muscleMap, stimulusRules } = await readCalculationInputs(options);
  const workoutFiles = await listYamlFiles(join(options.dataRoot, "workouts"));
  const workouts = await Promise.all(
    workoutFiles.map((file) => readYaml(file, workoutSchema, "workout"))
  );
  const query = search.trim().toLocaleLowerCase();
  const filtered = query
    ? workouts.filter((workout) =>
        [
          workout.title,
          workout.date,
          ...workout.blocks.flatMap((block) =>
            block.exercises.flatMap((exercise) => [exercise.name, exercise.exercise_id ?? ""])
          )
        ].some((value) => value.toLocaleLowerCase().includes(query))
      )
    : workouts;

  return {
    workouts: filtered,
    timeline: buildTimeline(filtered, muscleMap, stimulusRules, today)
  };
}

export async function getDailyWorkout(
  options: FitnessDataStoreOptions,
  date: string
): Promise<DailyWorkoutViewModel | undefined> {
  const { muscleMap, stimulusRules } = await readCalculationInputs(options);
  const workoutFiles = await listYamlFiles(join(options.dataRoot, "workouts"));
  const matchingFile = workoutFiles.find((file) => file.endsWith(`/${date}.yaml`));
  if (!matchingFile) return undefined;
  const workout = await readYaml(matchingFile, workoutSchema, "workout");
  return buildDailyWorkoutView(workout, muscleMap, stimulusRules);
}

export async function buildDashboardFromFiles(
  options: FitnessDataStoreOptions
): Promise<DashboardComputation> {
  const { muscleMap, stimulusRules } = await readCalculationInputs(options);
  const workoutFiles = await listYamlFiles(join(options.dataRoot, "workouts"));
  const planFiles = await listYamlFiles(join(options.dataRoot, "plans"));
  const workouts = await Promise.all(
    workoutFiles.map((file) => readYaml(file, workoutSchema, "workout"))
  );
  const sortedWorkouts = workouts.sort((left, right) => right.date.localeCompare(left.date));
  const latestPlan = options.readOnly ? undefined : await readLatestPlan(planFiles);
  let updatedPlanFile: string | undefined;

  if (latestPlan) {
    const computedExpectedStimulus = calculateStimulus(
      latestPlan.plan,
      muscleMap,
      stimulusRules
    ).stimulus;
    const planWithComputed: Plan = {
      ...latestPlan.plan,
      computed_expected_stimulus: computedExpectedStimulus
    };

    if (
      latestPlan.hasForbiddenFields ||
      !sameJson(latestPlan.plan.computed_expected_stimulus, computedExpectedStimulus)
    ) {
      await writeYamlAtomic(latestPlan.file, planWithComputed);
    }
    updatedPlanFile = latestPlan.file;
  }

  const currentWorkout = sortedWorkouts[0];
  if (!currentWorkout) {
    return {
      projection: buildEmptyDashboardProjection({
        date: new Date().toISOString().slice(0, 10)
      }),
      updated: {
        planFile: updatedPlanFile ? relative(options.dataRoot, updatedPlanFile) : undefined
      }
    };
  }

  const currentWorkoutFile = workoutFiles.find((file) =>
    file.endsWith(`${currentWorkout.date}.yaml`)
  );
  const currentStimulus = calculateStimulus(currentWorkout, muscleMap, stimulusRules);
  const workoutWithComputed: Workout = {
    ...currentWorkout,
    computed: currentStimulus
  };

  if (
    !options.readOnly &&
    currentWorkoutFile &&
    !sameJson(currentWorkout.computed, currentStimulus)
  ) {
    await writeYamlAtomic(currentWorkoutFile, workoutWithComputed);
  }

  const projection = buildDashboardProjection({
    date: new Date().toISOString().slice(0, 10),
    currentWorkout: workoutWithComputed,
    recentWorkouts: sortedWorkouts,
    muscleMap,
    stimulusRules,
    constraints: {}
  });

  return {
    projection,
    updated: {
      workoutFile: currentWorkoutFile ? relative(options.dataRoot, currentWorkoutFile) : undefined,
      planFile: updatedPlanFile ? relative(options.dataRoot, updatedPlanFile) : undefined
    }
  };
}

async function readLatestPlan(
  planFiles: string[]
): Promise<{ file: string; plan: Plan; hasForbiddenFields: boolean } | undefined> {
  if (planFiles.length === 0) return undefined;

  const plans = await Promise.all(
    planFiles.map(async (file) => {
      const result = await readPlanYaml(file);
      return { file, plan: result.plan, hasForbiddenFields: result.hasForbiddenFields };
    })
  );
  return plans.sort((left, right) => right.plan.date.localeCompare(left.plan.date))[0];
}

async function readPlanYaml(file: string) {
  const content = await readFile(file, "utf8");
  const parsed = parse(content);
  const result = planSchema.safeParse(parsed);

  if (!result.success) {
    throw new Error(
      `plan YAML schema invalid: ${result.error.issues.map((issue) => issue.path.join(".")).join(", ")}`
    );
  }

  const parsedObject = typeof parsed === "object" && parsed !== null ? parsed : {};
  const hasForbiddenFields =
    "computed" in parsedObject ||
    "source_plan_file" in parsedObject ||
    "source_import_file" in parsedObject;

  return {
    plan: result.data,
    hasForbiddenFields
  };
}

async function readYaml<T extends z.ZodTypeAny>(
  file: string,
  schema: T,
  label: string
): Promise<z.output<T>> {
  const content = await readFile(file, "utf8");
  const parsed = parse(content);
  const result = schema.safeParse(parsed);

  if (!result.success) {
    throw new Error(
      `${label} YAML schema invalid: ${result.error.issues.map((issue) => issue.path.join(".")).join(", ")}`
    );
  }

  return result.data;
}

async function listYamlFiles(root: string): Promise<string[]> {
  const exists = await pathExists(root);
  if (!exists) return [];

  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter((entry) => !entry.name.startsWith("."))
      .map(async (entry) => {
        const path = join(root, entry.name);
        if (entry.isDirectory()) return listYamlFiles(path);
        if (entry.isFile() && (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml")))
          return [path];
        return [];
      })
  );

  return nested.flat().sort();
}

async function writeYamlAtomic(file: string, value: unknown) {
  await mkdir(dirname(file), { recursive: true });

  if (await pathExists(file)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    await copyFile(file, `${file}.${timestamp}.bak`);
  }

  const tempFile = `${file}.${process.pid}.tmp`;
  await writeFile(tempFile, stringify(value), "utf8");
  await rename(tempFile, file);
}

async function pathExists(path: string) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export async function getMuscleHistoryFromFiles(options: FitnessDataStoreOptions, input: unknown) {
  const { muscleId, date } = muscleHistoryQuerySchema.parse(input);
  const [{ muscleMap }, workoutFiles] = await Promise.all([
    readCalculationInputs(options),
    listYamlFiles(join(options.dataRoot, "workouts"))
  ]);
  const workouts = await Promise.all(
    workoutFiles.map((file) => readYaml(file, workoutSchema, "workout"))
  );
  return muscleHistoryResponseSchema.parse({
    ok: true,
    muscle: buildMuscleHistory({ muscleId, date, workouts, muscleMap })
  });
}

async function assertSafeParent(root: string, file: string) {
  const base = await realpath(root);
  let parent = dirname(file);
  while (!(await pathExists(parent))) parent = dirname(parent);
  const existing = await realpath(parent);
  const path = relative(base, existing);
  if (path.startsWith("..") || path.startsWith("/"))
    throw new Error("Write path is outside fitness root");
  try {
    if ((await lstat(file)).isSymbolicLink())
      throw new Error("Business file must not be a symbolic link");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await mkdir(dirname(file), { recursive: true });
}

async function writeYamlNew(file: string, value: unknown) {
  await mkdir(dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, stringify(value), { encoding: "utf8", flag: "wx" });
  try {
    await link(temp, file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST")
      throw new Error(`Business file already exists: ${file}`);
    throw error;
  } finally {
    await unlink(temp);
  }
}
