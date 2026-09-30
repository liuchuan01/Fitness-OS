import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse } from "yaml";
import { importMotionCoachHistory } from "../../server/data-store.js";
import { createLocalService } from "../../server/app.js";
import { workoutSchema } from "../../shared/fitness/schema.js";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

const roots: string[] = [];
const servers: Server[] = [];
const resourcesRoot = resolve("resources/fitness");
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((done) => server.close(() => done()))));
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function session(id: string, exercise: "squat" | "plank" | "russian_twist", localDate = "2026-09-30") {
  return {
    id,
    exercise,
    localDate,
    endedAt: Date.parse(`${localDate}T12:00:00+08:00`),
    durationMs: 85_000,
    repCount: exercise === "plank" ? 0 : exercise === "russian_twist" ? 13 : 8,
    attemptCount: exercise === "plank" ? 0 : 14,
    records: [],
    ...(exercise === "russian_twist" ? { twistCountUnit: "sides" as const } : {}),
    ...(exercise === "plank" ? { hold: { heldMs: 65_123, bestMs: 50_111, breaks: 2 } } : {})
  };
}

function exportFile(sessions: unknown[]) {
  return { format: "ai-motion-coach-history", schemaVersion: 1, exportedAt: "2026-09-30T10:00:00.000Z", sessions };
}

describe("AI Motion Coach history import", () => {
  it("retains counts, exact hold milliseconds and twist unit without inventing load or RPE", async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), "motion-coach-import-"));
    roots.push(dataRoot);
    const options = { dataRoot, resourcesRoot };
    const payload = exportFile([session("squat-1", "squat"), session("twist-1", "russian_twist"), session("plank-1", "plank")]);

    await expect(importMotionCoachHistory(options, payload)).resolves.toEqual({
      imported: 3, skipped: 0, dates: ["2026-09-30"]
    });
    const file = join(dataRoot, "workouts", "2026", "2026-09-30.yaml");
    const workout = workoutSchema.parse(parse(await readFile(file, "utf8")));
    const exercises = workout.blocks[0].exercises;
    expect(exercises.map((item) => item.source?.record_id)).toEqual(["squat-1", "twist-1", "plank-1"]);
    expect(exercises[0].sets).toEqual([{ kind: "work", reps: 8 }]);
    expect(exercises[1].sets).toEqual([{ kind: "work", reps: 13 }]);
    expect(exercises[1].source?.twist_count_unit).toBe("sides");
    expect(exercises[2].sets).toEqual([{ kind: "work", duration_sec: 65.123 }]);
    expect(exercises[2].source?.hold?.heldMs).toBe(65_123);
    expect(workout.computed?.total_volume_kg).toBeNull();
    expect(JSON.stringify(workout)).not.toMatch(/weight_kg|bodyweight_kg|"rpe"/);

    const original = await readFile(file, "utf8");
    await expect(importMotionCoachHistory(options, payload)).resolves.toEqual({
      imported: 0, skipped: 3, dates: []
    });
    expect(await readFile(file, "utf8")).toBe(original);
  });

  it("deduplicates zero-count records by ID across dates and rejects ambiguous twist units", async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), "motion-coach-import-"));
    roots.push(dataRoot);
    const options = { dataRoot, resourcesRoot };
    const zero = { ...session("zero-1", "squat"), repCount: 0, attemptCount: 0 };
    await expect(importMotionCoachHistory(options, exportFile([zero, zero]))).resolves.toEqual({
      imported: 1, skipped: 1, dates: ["2026-09-30"]
    });
    const workout = workoutSchema.parse(parse(await readFile(join(dataRoot, "workouts", "2026", "2026-09-30.yaml"), "utf8")));
    expect(workout.blocks[0].exercises[0].sets).toEqual([]);
    await expect(importMotionCoachHistory(options, exportFile([session("zero-1", "squat", "2026-10-01")]))).resolves.toEqual({
      imported: 0, skipped: 1, dates: []
    });
    await expect(importMotionCoachHistory(options, exportFile([{ ...session("bad", "russian_twist"), twistCountUnit: undefined }]))).rejects.toThrow();
  });

  it("accepts exported JSON through the local service and reports repeat imports", async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), "motion-coach-api-"));
    roots.push(dataRoot);
    const server = createLocalService({ version: "test", dataRoot });
    servers.push(server);
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    const port = (server.address() as AddressInfo).port;
    const url = `http://127.0.0.1:${port}/api/workouts/import-motion-coach`;
    const body = JSON.stringify(exportFile([session("api-1", "russian_twist")]));
    const request = () => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
    const first = await request();
    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toMatchObject({ imported: 1, skipped: 0 });
    const second = await request();
    await expect(second.json()).resolves.toMatchObject({ imported: 0, skipped: 1 });
  });
});
