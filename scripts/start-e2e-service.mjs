import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
const workspace = await mkdtemp(join(tmpdir(), "fitness-e2e-"));
await cp(new URL("../tests/fixtures/data/", import.meta.url), join(workspace, "fitness"), {
  recursive: true
});
const child = spawn(process.execPath, ["dist-server/server/index.js"], {
  stdio: "inherit",
  env: {
    ...process.env,
    WORKSPACE_ROOT: workspace,
    DATA_ROOT: "",
    RUNTIME_ROOT: "",
    DSH_HOME: "",
    AGENT_RUNTIME_DISABLED: "true",
    DSH_WEB_DISABLED: "true"
  }
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", async (code) => {
  await rm(workspace, { recursive: true, force: true });
  process.exitCode = code ?? 0;
});
