import { z } from "zod";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { afterEach, expect, it } from "vitest";
import { createLocalService } from "../../server/app.js";
import { disabledAgentRuntime } from "../../server/agent-runtime.js";
import { muscleHistoryResponseSchema } from "../../shared/fitness/muscle-history-schema.js";

let server: ReturnType<typeof createLocalService> | undefined;
let root: string | undefined;
afterEach(async () => {
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  if (root) await rm(root, { recursive: true, force: true });
});

it("serves validated read-only muscle history, excludes plans, and links to daily exercises", async () => {
  root = await mkdtemp(join(tmpdir(), "fitness-muscle-history-"));
  const dataRoot = join(root, "data");
  await cp("tests/fixtures/data", dataRoot, { recursive: true });
  const file = join(dataRoot, "workouts/2026/2026-06-19.yaml");
  const original = await readFile(file, "utf8");
  server = createLocalService({
    version: "test",
    dataRoot,
    runtimeRoot: join(root, "runtime"),
    agentRuntime: disabledAgentRuntime,
    startScheduler: false
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const response = await fetch(`${base}/api/muscles/latissimus_dorsi?date=2026-06-20`);
  expect(response.status).toBe(200);
  const { muscle } = muscleHistoryResponseSchema.parse(await response.json());
  expect(muscle.lastTrainedDate).toBe("2026-06-19");
  expect(muscle.history.every((entry) => entry.date !== "2026-06-20")).toBe(true);
  const daily = z
    .object({
      workout: z.object({
        blocks: z.array(z.object({ exercises: z.array(z.object({ id: z.string() })) }))
      })
    })
    .parse(await (await fetch(`${base}/api/workouts/2026-06-19`)).json());
  expect(
    daily.workout.blocks.flatMap((block: { exercises: { id: string }[] }) =>
      block.exercises.map((exercise) => exercise.id)
    )
  ).toContain(muscle.history[0].exercises[0].viewId);
  expect(await readFile(file, "utf8")).toBe(original);
  for (const path of [
    "lats?date=2026-06-20",
    "latissimus_dorsi?date=2026-02-30",
    "latissimus_dorsi"
  ]) {
    expect((await fetch(`${base}/api/muscles/${path}`)).status).toBe(422);
  }
  const empty = muscleHistoryResponseSchema.parse(
    await (await fetch(`${base}/api/muscles/latissimus_dorsi?date=2020-01-01`)).json()
  );
  expect(empty.muscle.lastTrainedDate).toBeNull();
  expect(empty.muscle.history).toEqual([]);
});
