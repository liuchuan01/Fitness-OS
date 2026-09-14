import { copyFile, mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { dirname, join, relative } from "node:path";
import { parse, stringify } from "yaml";
import { z } from "zod";
import type { AgentRuntime } from "./agent-runtime.js";
import { readAutomationSettings, saveAutomationSettings } from "./agent-settings.js";
import { getOnboardingState, getProfileRevision, assertProfileRevision } from "./onboarding.js";
import { resolveWorkspacePaths } from "./workspace.js";
import { programSchema } from "../shared/fitness/profile-schema.js";
import { validateFitnessData } from "./data-store.js";

export const scheduleSchema = z.object({
  schema_version: z.literal(1),
  daily_plan: z.object({
    enabled: z.boolean(),
    local_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    time_zone: z.string().min(1),
    missed_run_policy: z.literal("run_once")
  })
});
export type AutomationSchedule = z.output<typeof scheduleSchema>;
const outcomeSchema = z.discriminatedUnion("code", [
  z.object({ code: z.literal("created"), planFile: z.string() }),
  z.object({ code: z.literal("already_exists"), planFile: z.string() }),
  z.object({ code: z.literal("already_completed"), workoutFile: z.string() }),
  z.object({ code: z.literal("no_active_program") }),
  z.object({ code: z.literal("profile_required") }),
  z.object({ code: z.literal("recovery_day") })
]);
export type DailyPlanOutcome = z.output<typeof outcomeSchema>;
const runSchema = z.object({
  run_id: z.string(),
  trigger_type: z.enum(["scheduled", "manual"]),
  scheduled_occurrence: z.string().optional(),
  status: z.enum(["running", "succeeded", "failed"]),
  session_id: z.string(),
  started_at: z.string(),
  finished_at: z.string().optional(),
  duration_ms: z.number().int().nonnegative().optional(),
  outcome: outcomeSchema.optional(),
  error_code: z.string().optional(),
  error: z.string().optional(),
  changed_files: z.array(z.string()).optional()
});
const stateSchema = z.object({
  schema_version: z.literal(2),
  daily_plan: z.object({
    scheduled_cursor: z.object({ occurrence: z.string(), completed_at: z.string() }).optional(),
    active_claim: z
      .object({
        occurrence: z.string(),
        run_id: z.string(),
        started_at: z.string(),
        lease_expires_at: z.string(),
        attempt_count: z.number().int().positive()
      })
      .optional(),
    retry: z
      .object({
        occurrence: z.string(),
        attempt_count: z.number().int().positive(),
        next_retry_at: z.string()
      })
      .optional(),
    last_run: runSchema.optional()
  })
});
export type AutomationState = z.output<typeof stateSchema>;
export type AutomationProjection = {
  schedule: AutomationSchedule;
  state: AutomationState;
  next_run_at?: string;
};
export const defaultSchedule: AutomationSchedule = {
  schema_version: 1,
  daily_plan: {
    enabled: false,
    local_time: "09:00",
    time_zone: "Asia/Shanghai",
    missed_run_policy: "run_once"
  }
};
const emptyState: AutomationState = { schema_version: 2, daily_plan: {} };
const retryDelaysMs = [60_000, 300_000] as const;

export class AutomationScheduler {
  private timer: NodeJS.Timeout | undefined;
  private queue: Promise<void> = Promise.resolve();
  private readonly pendingOccurrences = new Map<string, Promise<void>>();
  private lastBackgroundError: unknown;
  constructor(
    private readonly workspaceRoot: string,
    private readonly dataRoot: string,
    private readonly scheduleFile: string,
    private readonly stateFile: string,
    private readonly runsRoot: string,
    private readonly runtime: AgentRuntime,
    private readonly now: () => Date = () => new Date()
  ) {}
  start() {
    if (this.timer) return;
    this.runTickSafely();
    this.timer = setInterval(() => this.runTickSafely(), 60_000);
    this.timer.unref();
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
  async getProjection(): Promise<AutomationProjection> {
    if (this.lastBackgroundError) {
      const error = this.lastBackgroundError;
      this.lastBackgroundError = undefined;
      throw error;
    }
    const schedule = await this.getSchedule();
    const state = await this.getState();
    return {
      schedule,
      state,
      ...(schedule.daily_plan.enabled
        ? { next_run_at: projectedNextRun(this.now(), schedule.daily_plan, state) }
        : {})
    };
  }
  async getSchedule() {
    return readAutomationSettings(this.scheduleFile);
  }
  async saveSchedule(value: unknown) {
    const schedule = scheduleSchema.parse(value);
    assertTimeZone(schedule.daily_plan.time_zone);
    await saveAutomationSettings(this.scheduleFile, schedule);
    this.runTickSafely();
    return schedule;
  }
  async getState() {
    return readYamlOrDefault(this.stateFile, stateSchema, emptyState);
  }
  async runNow() {
    const schedule = await this.getSchedule();
    const date = zonedParts(this.now(), schedule.daily_plan.time_zone).date;
    return this.enqueue(() => this.execute({ triggerType: "manual", date }));
  }
  async tick() {
    const schedule = await this.getSchedule();
    if (!schedule.daily_plan.enabled) return;
    const parts = zonedParts(this.now(), schedule.daily_plan.time_zone);
    if (parts.time < schedule.daily_plan.local_time) return;
    const occurrence = occurrenceId(parts.date, schedule.daily_plan);
    const state = await this.getState();
    if (state.daily_plan.scheduled_cursor?.occurrence === occurrence) return;
    if (
      state.daily_plan.retry?.occurrence === occurrence &&
      this.now() < new Date(state.daily_plan.retry.next_retry_at)
    )
      return;
    const pending = this.pendingOccurrences.get(occurrence);
    if (pending) {
      await pending;
      return;
    }
    const execution = this.enqueue(() =>
      this.execute({ triggerType: "scheduled", date: parts.date, occurrence })
    ).then(() => undefined);
    this.pendingOccurrences.set(occurrence, execution);
    await execution.finally(() => this.pendingOccurrences.delete(occurrence));
  }
  private runTickSafely() {
    void this.tick().catch((error) => {
      this.lastBackgroundError = error;
    });
  }
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(task);
    this.queue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }
  private async execute(input: {
    triggerType: "scheduled" | "manual";
    date: string;
    occurrence?: string;
  }): Promise<AutomationState> {
    const started = this.now();
    const runId = randomUUID();
    const sessionId =
      input.triggerType === "scheduled"
        ? `fitness-daily-${input.date}`
        : `fitness-daily-${input.date}-manual-${runId}`;
    const previous = await this.getState();
    const previousAttempts =
      input.occurrence && previous.daily_plan.active_claim?.occurrence === input.occurrence
        ? previous.daily_plan.active_claim.attempt_count
        : input.occurrence && previous.daily_plan.retry?.occurrence === input.occurrence
          ? previous.daily_plan.retry.attempt_count
          : 0;
    const attemptCount = previousAttempts + 1;
    const run = {
      run_id: runId,
      trigger_type: input.triggerType,
      ...(input.occurrence ? { scheduled_occurrence: input.occurrence } : {}),
      status: "running" as const,
      session_id: sessionId,
      started_at: started.toISOString()
    };
    let state: AutomationState = {
      schema_version: 2,
      daily_plan: {
        scheduled_cursor: previous.daily_plan.scheduled_cursor,
        retry: previous.daily_plan.retry,
        last_run: run,
        ...(input.occurrence
          ? {
              active_claim: {
                occurrence: input.occurrence,
                run_id: runId,
                started_at: started.toISOString(),
                lease_expires_at: new Date(started.getTime() + 30 * 60_000).toISOString(),
                attempt_count: attemptCount
              }
            }
          : {})
      }
    };
    await writeYamlAtomic(this.stateFile, state, false);
    const beforeFiles = await snapshotFiles(this.workspaceRoot, this.dataRoot);
    try {
      const preflight = await resolvePreflight(this.dataRoot, input.date);
      let outcome: DailyPlanOutcome;
      if (preflight) outcome = preflight;
      else {
        const profileRevision = await getProfileRevision({ fitnessRoot: this.dataRoot });
        await this.runtime.run(sessionId, dailyPlanPrompt(input.date));
        await assertProfileRevision({ fitnessRoot: this.dataRoot }, profileRevision);
        const planFile = `plans/${input.date.slice(0, 4)}/${input.date}.generated.yaml`;
        await validateFitnessData({ dataRoot: this.dataRoot }, planFile);
        outcome = { code: "created", planFile };
      }
      const changedFiles = await changedSince(this.workspaceRoot, this.dataRoot, beforeFiles);
      assertAllowedChanges(changedFiles, outcome.code === "created" ? outcome.planFile : undefined);
      const finished = this.now();
      state = {
        schema_version: 2,
        daily_plan: {
          scheduled_cursor: input.occurrence
            ? { occurrence: input.occurrence, completed_at: finished.toISOString() }
            : previous.daily_plan.scheduled_cursor,
          last_run: {
            ...run,
            status: "succeeded",
            finished_at: finished.toISOString(),
            duration_ms: Math.max(0, finished.getTime() - started.getTime()),
            outcome,
            changed_files: changedFiles
          }
        }
      };
    } catch (error) {
      const finished = this.now();
      const changedFiles = await changedSince(this.workspaceRoot, this.dataRoot, beforeFiles);
      let effectiveError = error;
      try {
        assertAllowedChanges(
          changedFiles,
          `plans/${input.date.slice(0, 4)}/${input.date}.generated.yaml`
        );
      } catch (boundaryError) {
        effectiveError = boundaryError;
      }
      const retry =
        input.occurrence && attemptCount <= retryDelaysMs.length
          ? {
              occurrence: input.occurrence,
              attempt_count: attemptCount,
              next_retry_at: new Date(
                finished.getTime() + retryDelaysMs[attemptCount - 1]
              ).toISOString()
            }
          : undefined;
      state = {
        schema_version: 2,
        daily_plan: {
          scheduled_cursor: previous.daily_plan.scheduled_cursor,
          retry,
          last_run: {
            ...run,
            status: "failed",
            finished_at: finished.toISOString(),
            duration_ms: Math.max(0, finished.getTime() - started.getTime()),
            error_code: errorCode(effectiveError),
            error: effectiveError instanceof Error ? effectiveError.message : "Agent run failed",
            changed_files: changedFiles
          }
        }
      };
    }
    await writeYamlAtomic(this.stateFile, state, false);
    await writeRunLog(this.runsRoot, state.daily_plan.last_run!);
    return state;
  }
}

async function resolvePreflight(
  dataRoot: string,
  date: string
): Promise<DailyPlanOutcome | undefined> {
  const workoutFile = `workouts/${date.slice(0, 4)}/${date}.yaml`;
  if (await pathExists(join(dataRoot, workoutFile)))
    return { code: "already_completed", workoutFile };
  const planFile = `plans/${date.slice(0, 4)}/${date}.generated.yaml`;
  if (await pathExists(join(dataRoot, planFile))) {
    await validateFitnessData({ dataRoot }, planFile);
    return { code: "already_exists", planFile };
  }
  const onboarding = await getOnboardingState(
    { fitnessRoot: dataRoot, runtimeRoot: join(dirname(dataRoot), "runtime") },
    date
  );
  if (!onboarding.profileConfirmed) return { code: "profile_required" };
  const programs = await yamlFiles(join(dataRoot, "programs"));
  const active = (
    await Promise.all(
      programs.map(async (file) => programSchema.parse(parse(await readFile(file, "utf8"))))
    )
  ).find(
    (program) =>
      typeof program.start_date === "string" &&
      typeof program.end_date === "string" &&
      program.confirmation !== undefined &&
      program.start_date <= date &&
      date <= program.end_date
  );
  if (!active) return { code: "no_active_program" };
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" })
    .format(new Date(`${date}T12:00:00Z`))
    .toLowerCase();
  const slots = Array.isArray(active.weekly_schedule)
    ? (active.weekly_schedule as Array<Record<string, unknown>>)
    : [];
  if (slots.find((slot) => slot.day_of_week === weekday)?.type === "recovery")
    return { code: "recovery_day" };
  return undefined;
}
function assertAllowedChanges(files: string[], targetPlanFile?: string) {
  const target = targetPlanFile ? `fitness/${targetPlanFile}` : undefined;
  const forbidden = files.filter(
    (file) =>
      file !== target &&
      !(target && file.startsWith(`${target}.`) && (file.endsWith(".bak") || file.endsWith(".tmp")))
  );
  if (forbidden.length)
    throw new Error(`Agent modified files outside the daily plan target: ${forbidden.join(", ")}`);
}
function dailyPlanPrompt(date: string) {
  return `为 ${date} 创建每日训练计划。严格遵守工作区 AGENTS.md，先读取当前 fitness/profile.yaml、有效周期、近期真实训练及指标和公共动作契约。目标只能是 fitness/plans/${date.slice(0, 4)}/${date}.generated.yaml；不得修改其他文件。草稿放在 runtime/onboarding/，携带本次档案 profile_revision，通过 AGENTS.md 指定的 CLI finalize plan 提交，再 validate all。不得改写配置或公共资源。`;
}
export function nextOccurrence(now: Date, schedule: AutomationSchedule["daily_plan"]) {
  const parts = zonedParts(now, schedule.time_zone);
  const date = parts.time < schedule.local_time ? parts.date : addUtcDate(parts.date, 1);
  return zonedIso(date, schedule.local_time, schedule.time_zone);
}
function projectedNextRun(
  now: Date,
  schedule: AutomationSchedule["daily_plan"],
  state: AutomationState
) {
  if (state.daily_plan.retry) return state.daily_plan.retry.next_retry_at;
  if (state.daily_plan.active_claim) return state.daily_plan.active_claim.lease_expires_at;
  const parts = zonedParts(now, schedule.time_zone);
  const todayOccurrence = occurrenceId(parts.date, schedule);
  if (
    parts.time >= schedule.local_time &&
    state.daily_plan.scheduled_cursor?.occurrence !== todayOccurrence
  )
    return now.toISOString();
  return nextOccurrence(now, schedule);
}
function occurrenceId(date: string, schedule: AutomationSchedule["daily_plan"]) {
  return `${date}T${schedule.local_time}[${schedule.time_zone}]`;
}
function addUtcDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
function zonedIso(date: string, time: string, timeZone: string) {
  const resolved = resolveLocalTime(date, time, timeZone);
  return `${resolved.date}T${resolved.time}:00${formatOffset(resolved.offsetMinutes)}`;
}

function resolveLocalTime(date: string, time: string, timeZone: string) {
  assertTimeZone(timeZone);
  let localMinute = Date.parse(`${date}T${time}:00Z`);
  for (let shifted = 0; shifted <= 180; shifted += 1, localMinute += 60_000) {
    const localDate = new Date(localMinute).toISOString().slice(0, 10);
    const localTime = new Date(localMinute).toISOString().slice(11, 16);
    const offsets = new Set(
      [-86_400_000, 0, 86_400_000].map((delta) =>
        offsetMinutesAt(new Date(localMinute + delta), timeZone)
      )
    );
    const matches = [...offsets]
      .map((offsetMinutes) => ({
        instant: new Date(localMinute - offsetMinutes * 60_000),
        offsetMinutes
      }))
      .filter(({ instant }) => {
        const parts = zonedParts(instant, timeZone);
        return parts.date === localDate && parts.time === localTime;
      })
      .sort((left, right) => left.instant.getTime() - right.instant.getTime());
    if (matches[0])
      return { date: localDate, time: localTime, offsetMinutes: matches[0].offsetMinutes };
  }
  throw new Error(`Cannot resolve local time ${date} ${time} in ${timeZone}`);
}

function offsetMinutesAt(instant: Date, timeZone: string) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(instant)
    .find((part) => part.type === "timeZoneName")?.value;
  if (name === "GMT") return 0;
  const match = name?.match(/^GMT([+-])(\d{2}):(\d{2})$/);
  if (!match) throw new Error(`Cannot resolve offset for ${timeZone}`);
  return (match[1] === "+" ? 1 : -1) * (Number(match[2]) * 60 + Number(match[3]));
}

function formatOffset(minutes: number) {
  const sign = minutes >= 0 ? "+" : "-";
  const absolute = Math.abs(minutes);
  return `${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
}
function zonedParts(date: Date, timeZone: string) {
  assertTimeZone(timeZone);
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  );
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`
  };
}
function assertTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format();
  } catch {
    throw new Error(`Invalid IANA time zone: ${timeZone}`);
  }
}
function errorCode(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return message.includes("outside")
    ? "OUT_OF_BOUNDS_CHANGE"
    : message.includes("computed") || message.includes("schema")
      ? "VALIDATION_FAILED"
      : "AGENT_RUN_FAILED";
}
async function snapshotFiles(workspaceRoot: string, dataRoot: string) {
  const result = new Map<string, string>();
  const profile = join(workspaceRoot, "profile.yaml");
  if (await pathExists(profile)) result.set("profile.yaml", await digestFile(profile));
  for (const file of await allFiles(dataRoot)) {
    result.set(`fitness/${relative(dataRoot, file)}`, await digestFile(file));
  }
  for (const file of await allFiles(join(workspaceRoot, "config"))) {
    result.set(`config/${relative(join(workspaceRoot, "config"), file)}`, await digestFile(file));
  }
  const resourcesRoot = resolveWorkspacePaths().resourcesRoot;
  for (const file of await allFiles(resourcesRoot)) {
    result.set(`resources/${relative(resourcesRoot, file)}`, await digestFile(file));
  }
  return result;
}
async function changedSince(workspaceRoot: string, dataRoot: string, before: Map<string, string>) {
  const after = await snapshotFiles(workspaceRoot, dataRoot);
  return [...new Set([...before.keys(), ...after.keys()])]
    .filter((file) => before.get(file) !== after.get(file))
    .sort();
}
async function digestFile(file: string) {
  return createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
}
async function allFiles(root: string): Promise<string[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    return (
      await Promise.all(
        entries
          .filter((entry) => entry.name !== ".git")
          .map((entry) =>
            entry.isDirectory()
              ? allFiles(join(root, entry.name))
              : entry.isFile()
                ? [join(root, entry.name)]
                : []
          )
      )
    )
      .flat()
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}
async function yamlFiles(root: string): Promise<string[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    return (
      await Promise.all(
        entries
          .filter((entry) => entry.name !== ".git")
          .map((entry) =>
            entry.isDirectory()
              ? yamlFiles(join(root, entry.name))
              : entry.isFile() && /\.ya?ml$/.test(entry.name)
                ? [join(root, entry.name)]
                : []
          )
      )
    )
      .flat()
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}
async function pathExists(path: string) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
async function writeRunLog(root: string, run: z.output<typeof runSchema>) {
  await mkdir(root, { recursive: true });
  await writeFile(join(root, `${run.run_id}.json`), JSON.stringify(run, null, 2) + "\n", "utf8");
}
async function readYamlOrDefault<T>(file: string, schema: z.ZodType<T>, fallback: T): Promise<T> {
  try {
    return schema.parse(parse(await readFile(file, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}
async function writeYamlAtomic(file: string, value: unknown, backup: boolean) {
  await mkdir(dirname(file), { recursive: true });
  if (backup) {
    try {
      await copyFile(file, `${file}.${new Date().toISOString().replace(/[:.]/g, "-")}.bak`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, stringify(value), "utf8");
  await rename(temporary, file);
}
