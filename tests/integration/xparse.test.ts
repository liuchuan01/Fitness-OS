import { mkdtemp, writeFile, readFile, rm, symlink, mkdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { once } from "node:events";
import { createServer } from "node:net";
import { afterEach, expect, it } from "vitest";
import { DshWebHost } from "../../server/dsh-web-host.js";
import { initializeWorkspace } from "../../server/workspace-init.js";
import { resolveWorkspacePaths } from "../../server/workspace.js";
import { readApplicationSettings, saveSettingsSection } from "../../server/agent-settings.js";
import { importWorkoutFromFile, validateFitnessData } from "../../server/data-store.js";
import { onePagePdf } from "../fixtures/xparse-pdf.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function workspace() {
  const root = await mkdtemp(join(tmpdir(), "fitness-xparse-test-"));
  roots.push(root);
  const paths = resolveWorkspacePaths({ workspaceRoot: root, env: {} });
  await initializeWorkspace(paths);
  return paths;
}

it("imports historical workouts without invented plans, preserves originals and rejects duplicates", async () => {
  const paths = await workspace();
  const source = join(paths.workspaceRoot, "export.csv");
  await writeFile(source, "date,exercise,weight,reps\n2026-10-01,bench,20,8\n");
  const draft = {
    id: "workout_2026-10-01",
    date: "2026-10-01",
    title: "迁移记录",
    blocks: [
      {
        type: "strength",
        name: "力量",
        exercises: [
          { name: "卧推", exercise_id: "horizontal_press", sets: [{ reps: 8, weight_kg: 20 }] }
        ]
      }
    ]
  };
  const result = await importWorkoutFromFile({ dataRoot: paths.fitnessRoot }, draft, source);
  expect(result.workout.computed?.total_sets).toBe(1);
  expect(result.workout.source_plan_file).toBeUndefined();
  expect(result.workout.bodyweight_kg).toBeUndefined();
  expect(result.workout.blocks[0].exercises[0].sets[0].rpe).toBeUndefined();
  expect(await readFile(join(paths.fitnessRoot, result.workout.source_import_file!), "utf8")).toBe(
    await readFile(source, "utf8")
  );
  expect(await validateFitnessData({ dataRoot: paths.fitnessRoot })).toEqual({
    plans: 0,
    workouts: 1
  });
  const before = await readFile(join(paths.fitnessRoot, result.workoutFile), "utf8");
  await expect(
    importWorkoutFromFile({ dataRoot: paths.fitnessRoot }, draft, source)
  ).rejects.toThrow("already exists");
  expect(await readFile(join(paths.fitnessRoot, result.workoutFile), "utf8")).toBe(before);
  await expect(
    importWorkoutFromFile({ dataRoot: paths.fitnessRoot }, { ...draft, computed: {} }, source)
  ).rejects.toThrow();
});

it("rejects symlinked import archives and serializes independent settings sections", async () => {
  const paths = await workspace();
  const outside = join(paths.workspaceRoot, "outside");
  await mkdir(outside);
  await symlink(outside, join(paths.fitnessRoot, "imports"));
  const source = join(paths.workspaceRoot, "raw.txt");
  await writeFile(source, "actual record");
  await expect(
    importWorkoutFromFile(
      { dataRoot: paths.fitnessRoot },
      { id: "test", title: "实际记录", date: "2026-10-02", blocks: [] },
      source
    )
  ).rejects.toThrow("outside fitness root");
  await Promise.all([
    saveSettingsSection(paths.settingsFile, "xparse", { enabled: true, allowPaid: false }),
    saveSettingsSection(paths.settingsFile, "agent", {
      schema_version: 1,
      instructions: "保留此设置"
    })
  ]);
  expect(await readApplicationSettings(paths.settingsFile)).toMatchObject({
    xparse: { enabled: true, allowPaid: false },
    agent: { instructions: "保留此设置" }
  });
});

it("installed Host hides disabled skills and tools, protects credentials, and applies changes without restart", async () => {
  const paths = await workspace();
  const portServer = createServer();
  portServer.listen(0, "127.0.0.1");
  await once(portServer, "listening");
  const address = portServer.address();
  if (!address || typeof address === "string") throw new Error("No port");
  const port = address.port;
  await new Promise<void>((done) => portServer.close(() => done()));
  const source = join(paths.workspaceRoot, "profile-source");
  await mkdir(join(source, "profile"), { recursive: true });
  await writeFile(join(source, "config.json"), await readFile("dsh-fitness/config.json"));
  for (const name of ["surface", "automation-bridge"])
    await symlink(resolve("dsh-fitness", name), join(source, name), "dir");
  await writeFile(
    join(source, "profile/cordis.patch.yml"),
    (await readFile("dsh-fitness/profile/cordis.patch.yml", "utf8")) +
      `\n- id: agent-default-model\n  config:\n    provider: fitness-test\n    model: fixture\n- insert:\n    - id: fitness-xparse-probe\n      name: ${JSON.stringify(resolve("tests/fixtures/xparse-host/index.js"))}\n    - id: fitness-test-model\n      name: ${JSON.stringify(resolve("tests/fixtures/dsh-model/index.js"))}\n`
  );
  const host = new DshWebHost({
    workspaceRoot: paths.workspaceRoot,
    port,
    dshHome: paths.dshHome,
    bridgeSecret: "test-only",
    agentSettingsFile: paths.settingsFile,
    profileSource: source
  });
  const base = `http://127.0.0.1:${port}`;
  const headers = { "Content-Type": "application/json", "x-fitness-bridge-secret": "test-only" };
  const credentials = () =>
    fetch(`${base}/fitness-xparse-credentials`, { headers }).then((r) => r.json());
  const probe = () => fetch(`${base}/fitness-test-xparse`).then((r) => r.json());
  const modelSees = async (enabled: boolean) => {
    const sessionId = enabled ? "xparse-enabled-test" : "xparse-disabled-test";
    await fetch(`${base}/fitness-automation-bridge`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        sessionId,
        runId: sessionId,
        requestId: sessionId,
        message: "检查可用工具。"
      })
    });
    await expect
      .poll(
        async () =>
          (
            await fetch(
              `${base}/fitness-automation-bridge/status?sessionId=${sessionId}&runId=${sessionId}`,
              { headers }
            )
          ).json(),
        { timeout: 20_000 }
      )
      .toMatchObject({ state: "idle" });
    const calls = (
      await readFile(join(paths.workspaceRoot, "fixture-model-requests.jsonl"), "utf8")
    )
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(calls.some((call) => call.sessionId === sessionId)).toBe(true);
    expect(
      calls
        .filter((call) => call.sessionId === sessionId)
        .every((call) => call.tools.includes("xparse") === enabled)
    ).toBe(true);
  };
  await writeFile(join(paths.fitnessRoot, "profile.yaml"), "preferences: {equipment: bands}\n");
  try {
    host.start();
    await expect.poll(() => host.status(), { timeout: 45_000 }).toMatchObject({ status: "ready" });
    expect((await fetch(`${base}/fitness-xparse-credentials`)).status).toBe(401);
    expect(await probe()).toMatchObject({ available: false, content: null, tool: false });
    expect(await credentials()).toMatchObject({
      credentials: { configured: false, writable: true }
    });
    const save = await fetch(`${base}/fitness-xparse-credentials`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ appId: "test-app", secretCode: "never-expose-this-secret" })
    });
    expect(save.status).toBe(200);
    expect(await save.text()).not.toContain("never-expose-this-secret");
    expect(await readFile(paths.settingsFile, "utf8")).not.toContain("never-expose-this-secret");
    expect((await stat(join(paths.configRoot, "dsh-credentials.yaml"))).mode & 0o777).toBe(0o600);
    await saveSettingsSection(paths.settingsFile, "xparse", { enabled: true, allowPaid: false });
    await expect.poll(probe).toMatchObject({ available: true, tool: true });
    expect(await probe()).toMatchObject({ content: expect.stringContaining("import workout") });
    await modelSees(true);
    const pdf = join(paths.workspaceRoot, "local-only.pdf");
    await writeFile(pdf, onePagePdf());
    const localResult = await fetch(`${base}/fitness-test-xparse`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        args: ["get_doc_info", pdf],
        userIntent: "读取测试 PDF 页数",
        toolCallReason: "验证本地 CLI，不上传文档"
      })
    }).then((r) => r.json());
    expect(localResult).toMatchObject({
      isError: false,
      value: { exitCode: 0, stdout: expect.stringContaining('"page_count": 1') }
    });
    const forbidden = await fetch(`${base}/fitness-test-xparse`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        args: ["parse", "/tmp/test.pdf", "--api", "paid"],
        userIntent: "导入健身记录",
        toolCallReason: "读取记录"
      })
    }).then((r) => r.json());
    expect(forbidden).toMatchObject({ isError: true });
    expect(JSON.stringify(forbidden)).not.toContain("never-expose-this-secret");
    await saveSettingsSection(paths.settingsFile, "xparse", { enabled: false, allowPaid: false });
    await expect.poll(probe).toMatchObject({ available: false, content: null, tool: false });
    await modelSees(false);
    expect(await credentials()).toMatchObject({ credentials: { configured: true } });
    const blocked = await fetch(`${base}/fitness-test-xparse`, {
      method: "POST",
      headers,
      body: JSON.stringify({ args: ["quota"], userIntent: "查询", toolCallReason: "额度" })
    }).then((r) => r.json());
    expect(blocked).toMatchObject({ isError: true });
    await fetch(`${base}/fitness-xparse-credentials`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ clear: true })
    });
    expect(await credentials()).toMatchObject({ credentials: { configured: false } });
  } finally {
    host.close();
    await new Promise((done) => setTimeout(done, 1000));
  }
}, 60_000);
