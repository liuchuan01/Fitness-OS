import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stringify } from "yaml";
import { AutomationScheduler, nextOccurrence } from "../../server/automation.js";
import type { AgentRuntime } from "../../server/agent-runtime.js";

const roots: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("automation scheduler", () => {
  it("keeps the scheduled cursor when a later manual run completes", async () => {
    const fixture = await setupFixture();
    const runtime = fakeRuntime();
    const scheduler = createScheduler(fixture, runtime);
    await scheduler.saveSchedule(enabledSchedule);
    await scheduler.tick();
    const scheduledState = await scheduler.getState();
    await scheduler.runNow();
    const manualState = await scheduler.getState();
    await scheduler.tick();

    expect(manualState.daily_plan.scheduled_cursor).toEqual(
      scheduledState.daily_plan.scheduled_cursor
    );
    expect(manualState.daily_plan.last_run).toMatchObject({
      trigger_type: "manual",
      status: "succeeded",
      outcome: { code: "already_exists" }
    });
    expect(runtime.run).not.toHaveBeenCalled();
  });

  it("recovers an orphaned persisted running claim after restart", async () => {
    const fixture = await setupFixture();
    await mkdir(join(fixture.runtimeRoot, "automation"), { recursive: true });
    await writeFile(
      join(fixture.runtimeRoot, "automation/state.yaml"),
      stringify({
        schema_version: 2,
        daily_plan: {
          active_claim: {
            occurrence: "2026-06-20T09:00[Asia/Shanghai]",
            run_id: "dead-run",
            started_at: "2026-06-20T01:00:00.000Z",
            lease_expires_at: "2026-06-20T01:30:00.000Z",
            attempt_count: 1
          },
          last_run: {
            run_id: "dead-run",
            trigger_type: "scheduled",
            scheduled_occurrence: "2026-06-20T09:00[Asia/Shanghai]",
            status: "running",
            session_id: "fitness-daily-2026-06-20",
            started_at: "2026-06-20T01:00:00.000Z"
          }
        }
      }),
      "utf8"
    );
    const scheduler = createScheduler(fixture, fakeRuntime());
    await scheduler.saveSchedule(enabledSchedule);
    await scheduler.tick();

    const recovered = await scheduler.getState();
    expect(recovered).toMatchObject({
      daily_plan: {
        scheduled_cursor: { occurrence: "2026-06-20T09:00[Asia/Shanghai]" },
        last_run: { status: "succeeded", outcome: { code: "already_exists" } }
      }
    });
    expect(recovered.daily_plan.active_claim).toBeUndefined();
  });

  it("does not accept a normal Agent exit without a valid finalized plan", async () => {
    const fixture = await setupFixture(false);
    const runtime = fakeRuntime();
    const scheduler = createScheduler(fixture, runtime);
    await scheduler.saveSchedule(enabledSchedule);
    await scheduler.tick();
    const state = await scheduler.getState();

    expect(runtime.run).toHaveBeenCalledTimes(1);
    expect(state.daily_plan.scheduled_cursor).toBeUndefined();
    expect(state.daily_plan.last_run).toMatchObject({
      status: "failed",
      error_code: "AGENT_RUN_FAILED"
    });
    expect(state.daily_plan.retry?.next_retry_at).toBeDefined();
  });

  it("returns no_active_program without starting the Agent", async () => {
    const fixture = await setupFixture(false, false);
    const runtime = fakeRuntime();
    const scheduler = createScheduler(fixture, runtime);
    await scheduler.saveSchedule(enabledSchedule);
    await scheduler.tick();
    await expect(scheduler.getState()).resolves.toMatchObject({
      daily_plan: { last_run: { status: "succeeded", outcome: { code: "no_active_program" } } }
    });
    expect(runtime.run).not.toHaveBeenCalled();
  });

  it("detects non-YAML writes anywhere under data", async () => {
    const fixture = await setupFixture(false);
    const runtime: AgentRuntime = {
      run: vi.fn(async (sessionId) => {
        await writeFile(join(fixture.dataRoot, "Agent.md"), "unauthorized change\n", "utf8");
        return { sessionId, finalResponse: "ok", notifications: [] };
      }),
      close: vi.fn()
    };
    const scheduler = createScheduler(fixture, runtime);
    await scheduler.saveSchedule(enabledSchedule);
    await scheduler.tick();

    await expect(scheduler.getState()).resolves.toMatchObject({
      daily_plan: {
        last_run: {
          status: "failed",
          error_code: "OUT_OF_BOUNDS_CHANGE",
          changed_files: ["fitness/Agent.md"]
        }
      }
    });
  });

  it("resolves the offset at the requested local time on DST transition days", () => {
    const schedule = {
      enabled: true,
      local_time: "01:30",
      time_zone: "America/New_York",
      missed_run_policy: "run_once" as const
    };
    expect(nextOccurrence(new Date("2026-03-07T12:00:00Z"), schedule)).toBe(
      "2026-03-08T01:30:00-05:00"
    );
  });

  it("shifts nonexistent DST times forward and chooses the first repeated occurrence", () => {
    expect(
      nextOccurrence(new Date("2026-03-07T12:00:00Z"), {
        enabled: true,
        local_time: "02:30",
        time_zone: "America/New_York",
        missed_run_policy: "run_once"
      })
    ).toBe("2026-03-08T03:00:00-04:00");
    expect(
      nextOccurrence(new Date("2026-10-31T12:00:00Z"), {
        enabled: true,
        local_time: "01:30",
        time_zone: "America/New_York",
        missed_run_policy: "run_once"
      })
    ).toBe("2026-11-01T01:30:00-04:00");
  });
});

const enabledSchedule = {
  schema_version: 1 as const,
  daily_plan: {
    enabled: true,
    local_time: "09:00",
    time_zone: "Asia/Shanghai",
    missed_run_policy: "run_once" as const
  }
};
function fakeRuntime(): AgentRuntime {
  return {
    run: vi.fn(async (sessionId) => ({ sessionId, finalResponse: "ok", notifications: [] })),
    close: vi.fn()
  };
}
function createScheduler(
  fixture: { root: string; dataRoot: string; runtimeRoot: string },
  runtime: AgentRuntime
) {
  return new AutomationScheduler(
    fixture.root,
    fixture.dataRoot,
    join(fixture.dataRoot, "automation/schedule.yaml"),
    join(fixture.runtimeRoot, "automation/state.yaml"),
    join(fixture.runtimeRoot, "automation/runs"),
    runtime,
    () => new Date("2026-06-20T01:05:00.000Z")
  );
}
async function setupFixture(withPlan = true, withProgram = true) {
  const root = await mkdtemp(join(tmpdir(), "fitness-automation-"));
  roots.push(root);
  const dataRoot = join(root, "data");
  const runtimeRoot = join(root, "runtime");
  await cp(join(process.cwd(), "tests/fixtures/data"), dataRoot, { recursive: true });
  await writeFile(
    join(dataRoot, "profile.yaml"),
    stringify({
      schema_version: 1,
      goals: { primary: "练习基础动作" },
      confirmation: { confirmed_at: "2026-06-01T00:00:00.000Z", source: "user_confirmed" }
    })
  );
  if (!withPlan) await rm(join(dataRoot, "plans/2026/2026-06-20.generated.yaml"));
  if (withProgram) {
    await mkdir(join(dataRoot, "programs"), { recursive: true });
    await writeFile(
      join(dataRoot, "programs/test.yaml"),
      stringify({
        schema_version: 1,
        id: "test",
        name: "虚构测试周期",
        outcome: { goal: "熟悉动作" },
        confirmation: { confirmed_at: "2026-06-01T00:00:00.000Z", source: "user_confirmed" },
        start_date: "2026-06-01",
        end_date: "2026-06-30",
        weekly_schedule: [
          { day_of_week: "saturday", type: "strength", slot_id: "practice", direction: "基础练习" }
        ]
      }),
      "utf8"
    );
  }
  return { root, dataRoot, runtimeRoot };
}
