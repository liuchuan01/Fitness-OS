import { parse, stringify } from "yaml";
import {
  calculateStimulus,
  muscleMapSchema,
  stimulusRulesSchema,
  workoutSchema
} from "../../shared/fitness/index.js";
import { afterEach, expect, it } from "vitest";
import { mkdtemp, cp, readFile, writeFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { createLocalService } from "../../server/app.js";
import { buildDashboardFromFiles } from "../../server/data-store.js";
import { dataSyncEventSchema } from "../../shared/data-sync.js";

let server: ReturnType<typeof createLocalService> | undefined;
let root = "";
const controller = new AbortController();

afterEach(async () => {
  controller.abort();
  if (server) {
    server.close();
    await once(server, "close");
  }
  if (root) await rm(root, { recursive: true, force: true });
});

it("publishes validated atomic edits, rejects broken YAML, and recovers without a Session", async () => {
  root = await mkdtemp(join(tmpdir(), "fitness-data-sync-"));
  await cp("tests/fixtures/data", root, { recursive: true });
  const map = muscleMapSchema.parse(
    parse(await readFile(join(root, "muscles/muscle_map.yaml"), "utf8"))
  );
  const rules = stimulusRulesSchema.parse(
    parse(await readFile(join(root, "muscles/stimulus_rules.yaml"), "utf8"))
  );
  for (const date of ["2026-06-16", "2026-06-19"]) {
    const path = join(root, `workouts/2026/${date}.yaml`);
    const workout = workoutSchema.parse(parse(await readFile(path, "utf8")));
    await writeFile(
      path,
      stringify({ ...workout, computed: calculateStimulus(workout, map, rules) })
    );
  }
  await buildDashboardFromFiles({ dataRoot: root });
  server = createLocalService({ version: "test", dataRoot: root });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing server address");
  const response = await fetch(`http://127.0.0.1:${address.port}/api/data-events`, {
    signal: controller.signal
  });
  expect(response.headers.get("content-type")).toContain("text/event-stream");
  const reader = response.body!.getReader();
  let buffer = "";
  async function next() {
    for (;;) {
      const end = buffer.indexOf("\n\n");
      if (end >= 0) {
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (block.startsWith("data: "))
          return dataSyncEventSchema.parse(JSON.parse(block.slice(6)));
      } else {
        const chunk = await reader.read();
        if (chunk.done) throw new Error("Stream closed before data event");
        buffer += new TextDecoder().decode(chunk.value);
      }
    }
  }
  const initial = await next();
  expect(initial.type).toBe("fitness.data-changed");
  const file = join(root, "plans/2026/2026-06-20.generated.yaml");
  const original = await readFile(file, "utf8");
  const draft = parse(original) as Record<string, unknown>;
  delete draft.computed_expected_stimulus;
  const draftText = stringify(draft);
  await writeFile(file, draftText);
  await fetch(`http://127.0.0.1:${address.port}/api/dashboard`);
  const draftResponse = await fetch(`http://127.0.0.1:${address.port}/api/plans/2026-06-20`);
  expect(draftResponse.status).toBe(422);
  expect(await readFile(file, "utf8")).toBe(draftText);
  expect((await next()).type).toBe("fitness.data-invalid");
  await writeFile(file, "blocks: [broken");
  expect((await next()).type).toBe("fitness.data-invalid");
  await writeFile(file + ".tmp", original.replace("title:", "title: 已更新 ·"));
  await rename(file + ".tmp", file);
  const updated = await next();
  expect(updated.type).toBe("fitness.data-changed");
  if (updated.type !== "fitness.data-changed" || initial.type !== "fitness.data-changed")
    throw new Error("Expected revisions");
  expect(updated.revision).not.toBe(initial.revision);
  expect(updated.changed).toContain("workouts");
  expect(await readFile(file, "utf8")).toContain("已更新");
  await writeFile(file, "blocks: [broken again");
  expect((await next()).type).toBe("fitness.data-invalid");
}, 15000);
