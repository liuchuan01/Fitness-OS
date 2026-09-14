import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  writeFile,
  rename,
  link,
  unlink,
  copyFile,
  lstat
} from "node:fs/promises";
import { dirname, join, relative, resolve, isAbsolute } from "node:path";
import { parse, stringify } from "yaml";
import { z } from "zod";
import {
  bodyMetricsSchema,
  calendarDateSchema,
  cardioMetricsSchema,
  confirmedProfileSchema,
  nutritionMetricsSchema,
  readinessSchema,
  planSchema,
  profileDraftSchema,
  profileSchema,
  programSchema,
  workoutSchema,
  type OnboardingState
} from "../shared/fitness/index.js";

type FitnessRoot = { fitnessRoot: string };
type OnboardingPaths = FitnessRoot & { runtimeRoot: string };
async function readOptional(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}
export async function getProfileRevision(paths: FitnessRoot): Promise<string | null> {
  await assertBusinessPath(paths.fitnessRoot, join(paths.fitnessRoot, "profile.yaml"));
  const content = await readOptional(join(paths.fitnessRoot, "profile.yaml"));
  return content === undefined ? null : createHash("sha256").update(content).digest("hex");
}
export async function assertProfileRevision(
  paths: FitnessRoot,
  revision: string | null | undefined
) {
  await assertBusinessPath(paths.fitnessRoot, join(paths.fitnessRoot, "profile.yaml"));
  const profile = await readOptional(join(paths.fitnessRoot, "profile.yaml"));
  if (!profile || !confirmedProfileSchema.safeParse(parse(profile)).success)
    throw new Error("PROFILE_NOT_CONFIRMED");
  if (!revision || revision !== createHash("sha256").update(profile).digest("hex"))
    throw new Error("PROFILE_REVISION_CONFLICT");
}
async function yamlFiles(root: string): Promise<string[]> {
  let entries;
  try {
    if ((await lstat(root)).isSymbolicLink()) throw new Error("ONBOARDING_SYMLINK_NOT_ALLOWED");
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  return (
    await Promise.all(
      entries
        .filter((entry) => !entry.name.startsWith("."))
        .map(async (entry) => {
          const file = join(root, entry.name);
          if (entry.isDirectory()) return yamlFiles(file);
          return entry.isFile() && /\.ya?ml$/.test(entry.name) ? [file] : [];
        })
    )
  )
    .flat()
    .sort();
}
async function readParsed<T>(file: string, schema: z.ZodType<T>) {
  try {
    return schema.parse(parse(await readFile(file, "utf8")));
  } catch (error) {
    throw new Error(`${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
async function createOnce(file: string, value: unknown) {
  await mkdir(dirname(file), { recursive: true });
  const content = stringify(value);
  const temp = `${file}.${randomUUID()}.tmp`;
  await writeFile(temp, content, { flag: "wx" });
  try {
    try {
      await link(temp, file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const existing = await readFile(file, "utf8");
      if (JSON.stringify(parse(existing)) !== JSON.stringify(value))
        throw new Error("ONBOARDING_FILE_CONFLICT");
    }
  } finally {
    await unlink(temp);
  }
}
export async function saveOnboardingDraft(paths: OnboardingPaths, input: unknown) {
  const draft = profileDraftSchema.parse(input);
  const file = join(paths.runtimeRoot, "onboarding", "profile-draft.yaml");
  await assertBusinessPath(paths.runtimeRoot, file);
  await mkdir(dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, stringify(draft), { flag: "wx" });
    await rename(temp, file);
  } finally {
    await unlink(temp).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
  return draft;
}
export async function commitOnboardingProfile(paths: OnboardingPaths, input: unknown) {
  const profile = confirmedProfileSchema.parse(input);
  await assertBusinessPath(paths.fitnessRoot, join(paths.fitnessRoot, "profile.yaml"));
  await createOnce(join(paths.fitnessRoot, "profile.yaml"), profile);
  return { profile, revision: await getProfileRevision(paths) };
}
export async function commitOnboardingProgram(paths: OnboardingPaths, input: unknown) {
  const program = programSchema.parse(input);
  if (!program.confirmation) throw new Error("PROGRAM_NOT_CONFIRMED");
  await assertBusinessPath(
    paths.fitnessRoot,
    join(paths.fitnessRoot, "programs", `${program.id}.yaml`)
  );
  await withProfileRevision(paths, program.profile_revision, () =>
    createOnce(join(paths.fitnessRoot, "programs", `${program.id}.yaml`), program)
  );
  return program;
}
export async function getOnboardingState(
  paths: OnboardingPaths,
  date = new Date().toISOString().slice(0, 10)
): Promise<OnboardingState> {
  calendarDateSchema.parse(date);
  await assertBusinessPath(paths.fitnessRoot, join(paths.fitnessRoot, "profile.yaml"));
  await assertBusinessPath(
    paths.runtimeRoot,
    join(paths.runtimeRoot, "onboarding", "profile-draft.yaml")
  );
  const profileText = await readOptional(join(paths.fitnessRoot, "profile.yaml"));
  const profile =
    profileText === undefined ? undefined : profileDraftSchema.parse(parse(profileText));
  const profileConfirmed =
    profile !== undefined && confirmedProfileSchema.safeParse(profile).success;
  const hasDraft =
    (await readOptional(join(paths.runtimeRoot, "onboarding", "profile-draft.yaml"))) !== undefined;
  const programs = await Promise.all(
    (await yamlFiles(join(paths.fitnessRoot, "programs"))).map((file) =>
      readParsed(file, programSchema)
    )
  );
  const activeProgramId =
    programs.find(
      (program) => program.confirmation && program.start_date <= date && program.end_date >= date
    )?.id ?? null;
  const plans = await Promise.all(
    (await yamlFiles(join(paths.fitnessRoot, "plans"))).map((file) => readParsed(file, planSchema))
  );
  const workouts = await Promise.all(
    (await yamlFiles(join(paths.fitnessRoot, "workouts"))).map((file) =>
      readParsed(file, workoutSchema)
    )
  );
  const firstPlanDate =
    plans
      .filter((plan) => plan.computed_expected_stimulus !== undefined)
      .map((plan) => plan.date)
      .sort()[0] ?? null;
  const hasWorkout = workouts.length > 0;
  return {
    stage: hasWorkout
      ? "training_started"
      : firstPlanDate
        ? "plan_ready"
        : activeProgramId
          ? "program_confirmed"
          : profileConfirmed
            ? "profile_confirmed"
            : hasDraft || profile
              ? "draft"
              : "empty",
    hasDraft,
    profileConfirmed,
    profileRevision: await getProfileRevision(paths),
    activeProgramId,
    firstPlanDate,
    hasWorkout,
    profileStatus: profileConfirmed ? "confirmed" : profile || hasDraft ? "draft" : "missing",
    hasProgram: activeProgramId !== null,
    hasPlan: firstPlanDate !== null
  };
}
export async function validateOnboardingData(paths: FitnessRoot) {
  let profiles = 0;
  let programs = 0;
  let metrics = 0;
  const profile = join(paths.fitnessRoot, "profile.yaml");
  await assertBusinessPath(paths.fitnessRoot, profile);
  if ((await readOptional(profile)) !== undefined) {
    await readParsed(profile, profileSchema);
    profiles += 1;
  }
  for (const file of await yamlFiles(join(paths.fitnessRoot, "programs"))) {
    await readParsed(file, programSchema);
    programs += 1;
  }
  for (const file of await yamlFiles(join(paths.fitnessRoot, "metrics"))) {
    const path = relative(join(paths.fitnessRoot, "metrics"), file);
    if (path === "body.yaml") await readParsed(file, bodyMetricsSchema);
    else if (path === "readiness.yaml") await readParsed(file, readinessSchema);
    else if (path === "cardio.yaml") await readParsed(file, cardioMetricsSchema);
    else if (path.startsWith("nutrition/")) await readParsed(file, nutritionMetricsSchema);
    else throw new Error(`Unsupported metrics file: ${path}`);
    metrics += 1;
  }
  const manifest = join(paths.fitnessRoot, "manifest.yaml");
  await assertBusinessPath(paths.fitnessRoot, manifest);
  if ((await readOptional(manifest)) !== undefined)
    await readParsed(
      manifest,
      z
        .object({
          schema_version: z.literal(1),
          resource_version: z.string().min(1),
          calculation_rules_version: z.string().min(1)
        })
        .strict()
    );
  const preferences = join(paths.fitnessRoot, "exercises", "preferences.yaml");
  await assertBusinessPath(paths.fitnessRoot, preferences);
  if ((await readOptional(preferences)) !== undefined)
    await readParsed(
      preferences,
      z
        .object({
          schema_version: z.literal(1),
          exercises: z.array(
            z
              .object({
                exercise_id: z.string().min(1),
                familiarity: z.enum(["unknown", "new", "familiar"]).optional(),
                preference: z.enum(["preferred", "neutral", "avoid"]).optional(),
                limitations: z.array(z.string().min(1)).optional()
              })
              .strict()
          )
        })
        .strict()
    );
  return { profiles, programs, metrics };
}

export async function updateOnboardingProfile(
  paths: OnboardingPaths,
  input: unknown,
  expectedRevision: string
) {
  const profile = confirmedProfileSchema.parse(input);
  const file = join(paths.fitnessRoot, "profile.yaml");
  await assertBusinessPath(paths.fitnessRoot, file);
  const lock = join(paths.runtimeRoot, "onboarding", "profile-update.lock");
  await assertBusinessPath(paths.runtimeRoot, lock);
  await mkdir(dirname(lock), { recursive: true });
  await acquireLock(lock);
  const temp = `${file}.${randomUUID()}.tmp`;
  try {
    if ((await getProfileRevision(paths)) !== expectedRevision)
      throw new Error("PROFILE_REVISION_CONFLICT");
    await copyFile(file, `${file}.${randomUUID()}.bak`);
    await writeFile(temp, stringify(profile), { flag: "wx" });
    if ((await getProfileRevision(paths)) !== expectedRevision)
      throw new Error("PROFILE_REVISION_CONFLICT");
    await rename(temp, file);
    return { profile, revision: await getProfileRevision(paths) };
  } finally {
    await unlink(temp).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
    await unlink(lock);
  }
}

export async function commitOnboardingMetric(
  paths: OnboardingPaths,
  kind: "body" | "cardio" | "nutrition",
  input: unknown
) {
  const metric =
    kind === "body"
      ? bodyMetricsSchema.parse(input)
      : kind === "cardio"
        ? cardioMetricsSchema.parse(input)
        : nutritionMetricsSchema.parse(input);
  const file =
    kind === "nutrition" && "date" in metric
      ? join(paths.fitnessRoot, "metrics", "nutrition", `${metric.date}.yaml`)
      : join(paths.fitnessRoot, "metrics", `${kind}.yaml`);
  await assertBusinessPath(paths.fitnessRoot, file);
  if (kind === "nutrition") {
    await createOnce(file, metric);
    return metric;
  }
  const lock = join(paths.runtimeRoot, "onboarding", `${kind}-update.lock`);
  await assertBusinessPath(paths.runtimeRoot, lock);
  await mkdir(dirname(lock), { recursive: true });
  await acquireLock(lock);
  try {
    const previousText = await readOptional(file);
    if (previousText === undefined) {
      await createOnce(file, metric);
      return metric;
    }
    const previous =
      kind === "body"
        ? bodyMetricsSchema.parse(parse(previousText))
        : cardioMetricsSchema.parse(parse(previousText));
    const previousEntries = "measurements" in previous ? previous.measurements : previous.sessions;
    const incomingEntries =
      "measurements" in metric ? metric.measurements : "sessions" in metric ? metric.sessions : [];
    const entries = [...previousEntries];
    for (const entry of incomingEntries) {
      const existing = entries.find(
        (item) =>
          item.date === entry.date &&
          (!("type" in entry) || ("type" in item && item.type === entry.type))
      );
      if (existing) {
        if (JSON.stringify(existing) !== JSON.stringify(entry))
          throw new Error("METRIC_FACT_CONFLICT");
      } else entries.push(entry);
    }
    const value = {
      ...previous,
      ...(kind === "body" ? { measurements: entries } : { sessions: entries })
    };
    if (JSON.stringify(previous) !== JSON.stringify(value)) {
      const temp = `${file}.${randomUUID()}.tmp`;
      try {
        await copyFile(file, `${file}.${randomUUID()}.bak`);
        await writeFile(temp, stringify(value), { flag: "wx" });
        await rename(temp, file);
      } finally {
        await unlink(temp).catch((error: NodeJS.ErrnoException) => {
          if (error.code !== "ENOENT") throw error;
        });
      }
    }
    return value;
  } finally {
    await unlink(lock);
  }
}

async function acquireLock(file: string): Promise<void> {
  try {
    await writeFile(file, String(process.pid), { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const owner = Number(await readFile(file, "utf8"));
    if (!Number.isInteger(owner) || owner <= 0) throw new Error("ONBOARDING_UPDATE_IN_PROGRESS");
    try {
      process.kill(owner, 0);
    } catch (signalError) {
      if ((signalError as NodeJS.ErrnoException).code !== "ESRCH") throw signalError;
      await unlink(file);
      await writeFile(file, String(process.pid), { flag: "wx" });
      return;
    }
    throw new Error("ONBOARDING_UPDATE_IN_PROGRESS");
  }
}

async function assertBusinessPath(root: string, file: string) {
  const base = resolve(root);
  const path = relative(base, resolve(file));
  if (path.startsWith("..") || isAbsolute(path)) throw new Error("ONBOARDING_PATH_OUT_OF_BOUNDS");
  let current = base;
  for (const part of ["", ...path.split("/")]) {
    current = join(current, part);
    try {
      if ((await lstat(current)).isSymbolicLink())
        throw new Error("ONBOARDING_SYMLINK_NOT_ALLOWED");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
  }
}

/** Serializes supported profile updates with the final plan/program publication. */
export async function withProfileRevision<T>(
  paths: OnboardingPaths,
  revision: string | null | undefined,
  commit: () => Promise<T>
): Promise<T> {
  const lock = join(paths.runtimeRoot, "onboarding", "profile-update.lock");
  await assertBusinessPath(paths.runtimeRoot, lock);
  await mkdir(dirname(lock), { recursive: true });
  await acquireLock(lock);
  try {
    await assertProfileRevision(paths, revision);
    return await commit();
  } finally {
    await unlink(lock);
  }
}
