import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { afterEach, expect, it, vi } from "vitest";
import { DshWebHost } from "../../server/dsh-web-host.js";
import { initializeWorkspace } from "../../server/workspace-init.js";
import { resolveWorkspacePaths } from "../../server/workspace.js";
import { saveSettingsSection } from "../../server/agent-settings.js";
vi.mock("node:child_process", () => ({ spawn: vi.fn() }));
const roots: string[] = [];
afterEach(async () => {
  vi.clearAllMocks();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
it("uses the DSH bundled DeepSeek default and ignores legacy model overrides", async () => {
  const root = await mkdtemp(join(tmpdir(), "fitness-model-host-"));
  roots.push(root);
  const paths = resolveWorkspacePaths({ workspaceRoot: root, env: {} });
  await initializeWorkspace(paths);
  vi.mocked(spawn).mockImplementation(() => {
    const process = new EventEmitter();
    return Object.assign(process, {
      stdin: new PassThrough(),
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      kill: () => {
        process.emit("exit", 0, null);
        return true;
      }
    }) as unknown as ChildProcessWithoutNullStreams;
  });
  const host = new DshWebHost({
    workspaceRoot: root,
    dshHome: paths.dshHome,
    port: 3186,
    bridgeSecret: "test-only",
    agentSettingsFile: paths.settingsFile,
    profileSource: join(paths.appRoot, "dsh-fitness")
  });
  for (const selection of [
    { provider: "provider-one", model: "model-one" },
    { provider: "provider-two", model: "model-two" }
  ]) {
    await saveSettingsSection(paths.settingsFile, "model", selection);
    host.start();
    const patch = await readFile(join(paths.dshHome, "profiles/fitness/cordis.patch.yml"), "utf8");
    expect(patch).not.toContain("agent-default-model");
    const env = vi.mocked(spawn).mock.lastCall?.[2]?.env;
    expect(env).not.toHaveProperty("DSH_PROVIDER");
    expect(env).not.toHaveProperty("DSH_MODEL");
    host.close();
  }
});

it("queues a restart until the ready Host exits and ignores late events from the old process", async () => {
  const root = await mkdtemp(join(tmpdir(), "fitness-model-restart-"));
  roots.push(root);
  const paths = resolveWorkspacePaths({ workspaceRoot: root, env: {} });
  await initializeWorkspace(paths);
  const children: ChildProcessWithoutNullStreams[] = [];
  vi.mocked(spawn).mockImplementation(() => {
    const child = Object.assign(new EventEmitter(), {
      stdin: new PassThrough(),
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      kill: vi.fn(() => true)
    }) as unknown as ChildProcessWithoutNullStreams;
    children.push(child);
    return child;
  });
  const host = new DshWebHost({
    workspaceRoot: root,
    dshHome: paths.dshHome,
    port: 3186,
    bridgeSecret: "test-only",
    agentSettingsFile: paths.settingsFile,
    profileSource: join(paths.appRoot, "dsh-fitness")
  });
  await saveSettingsSection(paths.settingsFile, "model", {
    provider: "first",
    model: "first-model"
  });
  host.start();
  const old = children[0];
  old.stdout.emit("data", "dsh web: http://127.0.0.1:3186/?token=old\n");
  expect(host.status()).toMatchObject({ status: "ready" });
  await saveSettingsSection(paths.settingsFile, "model", { provider: "next", model: "next-model" });
  host.close();
  host.start();
  host.start();
  expect(old.kill).toHaveBeenCalledWith("SIGTERM");
  expect(children).toHaveLength(1);
  expect(host.status()).toEqual({ status: "starting" });
  old.stdout.emit("data", "dsh web: http://127.0.0.1:3186/?token=stale\n");
  expect(host.status()).toEqual({ status: "starting" });
  old.emit("exit", 0, "SIGTERM");
  expect(children).toHaveLength(2);
  expect(vi.mocked(spawn).mock.lastCall?.[2]?.env).not.toHaveProperty("DSH_MODEL");
  const patch = await readFile(join(paths.dshHome, "profiles/fitness/cordis.patch.yml"), "utf8");
  expect(patch).not.toContain("agent-default-model");
  children[1].stdout.emit("data", "dsh web: http://127.0.0.1:3186/?token=new\n");
  old.emit("error", new Error("late old-process error"));
  old.stdout.emit("data", "dsh web: http://127.0.0.1:3186/?token=old\n");
  expect(host.status()).toEqual({ status: "ready", url: "http://127.0.0.1:3186/?token=new" });
  host.close();
  children[1].emit("exit", 0, "SIGTERM");
  expect(children).toHaveLength(2);
});
