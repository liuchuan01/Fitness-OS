import { afterEach, describe, expect, it } from "vitest";
import { buildDashboardFromFiles } from "../../server/data-store.js";
import { createLocalService } from "../../server/app.js";

import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parse, stringify } from "yaml";

let server: Server | undefined;
let tempDataRoot: string | undefined;

afterEach(async () => {
  if (!server) return;

  await new Promise<void>((resolve, reject) => {
    server?.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  server = undefined;

  if (tempDataRoot) {
    await rm(tempDataRoot, { recursive: true, force: true });
    tempDataRoot = undefined;
  }
});

describe("local app service", () => {
  it("returns a healthy status", async () => {
    server = createLocalService({ version: "test" });

    await new Promise<void>((resolve) => {
      server!.listen(0, "127.0.0.1", resolve);
    });

    const address = server!.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: "local-app-service",
      version: "test"
    });
  });

  it("reads defaults and persists user-editable Agent instructions as YAML", async () => {
    tempDataRoot = await copyDataFixture();
    server = createLocalService({ version: "test", dataRoot: tempDataRoot });
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const initial = await fetch(`${baseUrl}/api/agent/settings`);
    await expect(initial.json()).resolves.toMatchObject({
      ok: true,
      settings: { schema_version: 1, instructions: expect.stringContaining("健身教练") }
    });

    const saved = await fetch(`${baseUrl}/api/agent/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schema_version: 1, instructions: "优先安排力量训练。" })
    });
    expect(saved.status).toBe(200);
    expect(
      parse(await readFile(join(tempDataRoot, ".service/config/settings.yaml"), "utf8")).agent
    ).toEqual({
      schema_version: 1,
      instructions: "优先安排力量训练。"
    });
  });

  it("serves Draco and GLB assets with their required MIME types", async () => {
    tempDataRoot = await mkdtemp(join(tmpdir(), "fitness-static-"));
    await mkdir(join(tempDataRoot, "models"), { recursive: true });
    await writeFile(join(tempDataRoot, "draco.wasm"), "wasm");
    await writeFile(join(tempDataRoot, "models", "body.glb"), "glb");
    server = createLocalService({
      version: "test",
      staticRoot: tempDataRoot,
      startScheduler: false
    });
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));

    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const [wasm, glb] = await Promise.all([
      fetch(`${baseUrl}/draco.wasm`),
      fetch(`${baseUrl}/models/body.glb`)
    ]);

    expect(wasm.headers.get("content-type")).toBe("application/wasm");
    expect(glb.headers.get("content-type")).toBe("model/gltf-binary");
  });

  it("returns a deterministic dashboard projection", async () => {
    tempDataRoot = await copyDataFixture();
    server = createLocalService({ version: "test", dataRoot: tempDataRoot });

    await new Promise<void>((resolve) => {
      server!.listen(0, "127.0.0.1", resolve);
    });

    const address = server!.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/api/dashboard`);

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      ok: boolean;
      projection: {
        daysSinceLastWorkout: number;
        bodyProjection: Array<unknown>;
        computedStimulus: { latissimus_dorsi: number };
      };
    };
    expect(payload.ok).toBe(true);
    expect(payload.projection.daysSinceLastWorkout).toBeGreaterThanOrEqual(0);
    expect(payload.projection.bodyProjection).toHaveLength(67);
    expect(payload.projection.computedStimulus.latissimus_dorsi).toBeGreaterThan(0);

    const writtenWorkout = parse(
      await readFile(join(tempDataRoot, "workouts/2026/2026-06-19.yaml"), "utf8")
    ) as {
      computed?: {
        stimulus?: { latissimus_dorsi?: number };
        recovery_load?: { erector_spinae_lower?: number };
      };
    };
    const writtenPlan = parse(
      await readFile(join(tempDataRoot, "plans/2026/2026-06-20.generated.yaml"), "utf8")
    ) as {
      computed_expected_stimulus?: { latissimus_dorsi?: number };
    };

    expect(writtenWorkout.computed?.stimulus?.latissimus_dorsi).toBe(
      payload.projection.computedStimulus.latissimus_dorsi
    );
    expect(writtenWorkout.computed?.recovery_load?.erector_spinae_lower).toBeGreaterThanOrEqual(0);
    expect(writtenPlan.computed_expected_stimulus?.latissimus_dorsi).toBeGreaterThan(0);
  });

  it("lists, searches, and reads workouts by date", async () => {
    tempDataRoot = await copyDataFixture();
    server = createLocalService({ version: "test", dataRoot: tempDataRoot });

    await new Promise<void>((resolve) => {
      server!.listen(0, "127.0.0.1", resolve);
    });

    const address = server!.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const timelineResponse = await fetch(`${baseUrl}/api/workouts?today=2026-06-20`);
    const timeline = (await timelineResponse.json()) as {
      timeline: Array<{ date: string; group: string; intensity: number }>;
    };

    expect(timelineResponse.status).toBe(200);
    expect(timeline.timeline.map((workout) => workout.date)).toEqual(["2026-06-19", "2026-06-16"]);
    expect(timeline.timeline[0]).toMatchObject({ group: "yesterday" });
    expect(timeline.timeline[0].intensity).toBeGreaterThan(0);

    const searchResponse = await fetch(
      `${baseUrl}/api/workouts?search=${encodeURIComponent("分腿蹲")}`
    );
    const search = (await searchResponse.json()) as { timeline: Array<{ date: string }> };
    expect(search.timeline).toEqual([expect.objectContaining({ date: "2026-06-16" })]);

    const dailyResponse = await fetch(`${baseUrl}/api/workouts/2026-06-19`);
    const daily = (await dailyResponse.json()) as {
      workout: {
        date: string;
        blocks: Array<{
          exercises: Array<{ name: string; primaryMuscles: string[]; secondaryMuscles: string[] }>;
        }>;
      };
    };
    expect(dailyResponse.status).toBe(200);
    expect(daily.workout.date).toBe("2026-06-19");
    const exercises = daily.workout.blocks.flatMap((block) => block.exercises);
    expect(exercises.find((exercise) => exercise.name === "引体向上")).toMatchObject({
      name: "引体向上",
      primaryMuscles: expect.arrayContaining(["latissimus_dorsi"]),
      secondaryMuscles: expect.arrayContaining(["deltoid_posterior"])
    });

    const emptyResponse = await fetch(`${baseUrl}/api/workouts/2026-06-20`);
    expect(emptyResponse.status).toBe(404);
  });

  it("reads a computed plan and finishes it as an immutable file-backed workout", async () => {
    tempDataRoot = await copyDataFixture();
    server = createLocalService({ version: "test", dataRoot: tempDataRoot });

    await new Promise<void>((resolve) => {
      server!.listen(0, "127.0.0.1", resolve);
    });

    const address = server!.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const planFile = join(tempDataRoot, "plans/2026/2026-06-20.generated.yaml");
    const originalPlan = await readFile(planFile, "utf8");
    const planResponse = await fetch(`${baseUrl}/api/plans/today?date=2026-06-20`);
    const planPayload = (await planResponse.json()) as {
      ok: boolean;
      sourcePlanFile: string;
      plan: { computed_expected_stimulus: { latissimus_dorsi: number } };
      preview: {
        totalSets: number;
        computedExpectedStimulus: { latissimus_dorsi: number };
        warnings: string[];
      };
    };

    expect(planResponse.status).toBe(200);
    expect(planPayload.sourcePlanFile).toBe("plans/2026/2026-06-20.generated.yaml");
    expect(planPayload.plan.computed_expected_stimulus.latissimus_dorsi).toBeGreaterThan(0);
    expect(planPayload.preview.totalSets).toBeGreaterThan(0);
    expect(planPayload.preview.computedExpectedStimulus.latissimus_dorsi).toBe(
      planPayload.plan.computed_expected_stimulus.latissimus_dorsi
    );
    expect(planPayload.preview.warnings).toEqual([]);

    const datedPlanResponse = await fetch(`${baseUrl}/api/plans/2026-06-20`);
    const datedPlanPayload = (await datedPlanResponse.json()) as {
      sourcePlanFile: string;
      preview: { computedExpectedStimulus: { latissimus_dorsi: number } };
    };
    expect(datedPlanResponse.status).toBe(200);
    expect(datedPlanPayload.sourcePlanFile).toBe(planPayload.sourcePlanFile);
    expect(datedPlanPayload.preview.computedExpectedStimulus.latissimus_dorsi).toBe(
      planPayload.preview.computedExpectedStimulus.latissimus_dorsi
    );

    const finishResponse = await fetch(`${baseUrl}/api/workouts/finish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_plan_file: planPayload.sourcePlanFile,
        actual: {
          bodyweight_kg: 80,
          blocks: [
            {
              type: "strength",
              name: "实际完成",
              exercises: [
                {
                  name: "引体向上",
                  exercise_id: "pull_up",
                  sets: [{ reps: 4, rpe: 9, bodyweight_factor: 0.7 }]
                }
              ]
            }
          ]
        }
      })
    });
    const finishPayload = (await finishResponse.json()) as {
      ok: boolean;
      workoutFile: string;
      workout: {
        source_plan_file: string;
        computed: {
          total_sets: number;
          stimulus: { latissimus_dorsi: number };
        };
      };
    };

    expect(finishResponse.status).toBe(201);
    expect(finishPayload.workoutFile).toBe("workouts/2026/2026-06-20.yaml");
    expect(finishPayload.workout.source_plan_file).toBe(planPayload.sourcePlanFile);
    expect(finishPayload.workout.computed.total_sets).toBe(1);
    expect(finishPayload.workout.computed.stimulus.latissimus_dorsi).toBeGreaterThan(0);

    const writtenWorkout = parse(
      await readFile(join(tempDataRoot, finishPayload.workoutFile), "utf8")
    ) as {
      source_plan_file?: string;
      computed?: { total_sets?: number };
    };
    expect(writtenWorkout).toMatchObject({
      source_plan_file: planPayload.sourcePlanFile,
      computed: { total_sets: 1 }
    });
    expect(await readFile(planFile, "utf8")).toBe(originalPlan);

    const duplicateResponse = await fetch(`${baseUrl}/api/workouts/finish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_plan_file: planPayload.sourcePlanFile,
        confirmed_as_planned: true
      })
    });
    expect(duplicateResponse.status).toBe(409);
  });

  it("rejects forbidden workout fields without changing the draft during plan reads", async () => {
    tempDataRoot = await copyDataFixture();
    const planFile = join(tempDataRoot, "plans/2026/2026-06-20.generated.yaml");
    const dirtyPlan = parse(await readFile(planFile, "utf8")) as Record<string, unknown>;
    dirtyPlan.computed = {
      total_sets: 99,
      total_volume_kg: 99,
      stimulus: {},
      recovery_load: {}
    };
    dirtyPlan.source_plan_file = "plans/old.yaml";
    await writeFile(planFile, stringify(dirtyPlan), "utf8");

    server = createLocalService({ version: "test", dataRoot: tempDataRoot });
    await new Promise<void>((resolve) => {
      server!.listen(0, "127.0.0.1", resolve);
    });

    const address = server!.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/api/plans/2026-06-20`);
    expect(response.status).toBe(422);
    expect(parse(await readFile(planFile, "utf8"))).toEqual(dirtyPlan);
  });

  it("projects a plan to actual workout data without planned readiness or RPE", async () => {
    tempDataRoot = await copyDataFixture();
    server = createLocalService({ version: "test", dataRoot: tempDataRoot });
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/api/workouts/finish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_plan_file: "plans/2026/2026-06-20.generated.yaml",
        confirmed_as_planned: true
      })
    });
    const payload = (await response.json()) as {
      workout: {
        readiness: Record<string, number>;
        blocks: Array<{ exercises: Array<{ sets: Array<{ rpe?: number; reps?: number }> }> }>;
      };
    };

    expect(response.status).toBe(201);
    expect(payload.workout.readiness).toEqual({});
    const sets = payload.workout.blocks.flatMap((block) =>
      block.exercises.flatMap((exercise) => exercise.sets)
    );
    expect(sets.some((set) => set.reps !== undefined)).toBe(true);
    expect(sets.every((set) => set.rpe === undefined)).toBe(true);
  });

  it("rejects a finish request that references a plan outside the data store", async () => {
    tempDataRoot = await copyDataFixture();
    server = createLocalService({ version: "test", dataRoot: tempDataRoot });

    await new Promise<void>((resolve) => {
      server!.listen(0, "127.0.0.1", resolve);
    });

    const address = server!.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/api/workouts/finish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_plan_file: "../../outside.yaml" })
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "source_plan_file does not reference an existing plan"
    });
  });

  it("returns an empty dashboard when no workout files exist", async () => {
    tempDataRoot = await copyDataFixture();
    await rm(join(tempDataRoot, "workouts"), { recursive: true, force: true });
    server = createLocalService({ version: "test", dataRoot: tempDataRoot });

    await new Promise<void>((resolve) => {
      server!.listen(0, "127.0.0.1", resolve);
    });

    const address = server!.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/api/dashboard`);
    const payload = (await response.json()) as {
      ok: boolean;
      projection: {
        hasTrainingData: boolean;
        weeklyStrengthSets: number;
        recentWorkouts: unknown[];
      };
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.projection).toMatchObject({
      hasTrainingData: false,
      weeklyStrengthSets: 0,
      recentWorkouts: []
    });
  });
});

async function copyDataFixture() {
  const target = await mkdtemp(join(tmpdir(), "fitness-data-"));
  await cp(join(process.cwd(), "tests", "fixtures", "data"), target, {
    recursive: true,
    filter: (source) => !source.endsWith(".bak") && !source.endsWith(".tmp")
  });
  await buildDashboardFromFiles({ dataRoot: target });
  return target;
}
