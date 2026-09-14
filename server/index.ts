import { createLocalService } from "./app.js";
import { disabledAgentRuntime } from "./agent-runtime.js";
import { resolve } from "node:path";
import { resolveWorkspacePaths } from "./workspace.js";
import { initializeWorkspace } from "./workspace-init.js";

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "127.0.0.1";

const paths = resolveWorkspacePaths();
await initializeWorkspace(paths);
const { workspaceRoot, runtimeRoot, fitnessRoot: dataRoot } = paths;
const server = createLocalService({
  version: "0.0.0",
  dataRoot,
  runtimeRoot,
  workspaceRoot,
  staticRoot: resolve(process.env.STATIC_ROOT ?? `${paths.appRoot}/dist`),
  ...(process.env.AGENT_RUNTIME_DISABLED === "true" ? { agentRuntime: disabledAgentRuntime } : {}),
  startScheduler: true
});

async function shutdown() {
  server.close();
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());

server.listen(port, host, () => {
  console.log(`Local app service listening on http://${host}:${port}`);
});
