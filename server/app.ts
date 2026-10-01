import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { applyJsonHeaders, readJsonBody, writeError, writeJson } from "./http/json.js";
import { serveStatic } from "./http/static.js";
import { DshHostAgentRuntime, type AgentRuntime } from "./agent-runtime.js";
import { AutomationScheduler } from "./automation.js";
import { resolveWorkspacePaths } from "./workspace.js";
import { getOnboardingState } from "./onboarding.js";
import { DataSync } from "./data-sync.js";
import { DshWebHost } from "./dsh-web-host.js";
import { readAgentSettings, saveAgentSettings } from "./agent-settings.js";
import {
  buildDashboardFromFiles,
  finishWorkoutFromPlan,
  getDailyWorkout,
  getMuscleHistoryFromFiles,
  getPlanForDate,
  listWorkoutLibrary
} from "./data-store.js";

export type LocalServiceOptions = {
  version: string;
  dataRoot?: string;
  agentRuntime?: AgentRuntime;
  runtimeRoot?: string;
  startScheduler?: boolean;
  staticRoot?: string;
  workspaceRoot?: string;
};

export function createLocalService(options: LocalServiceOptions) {
  const paths = resolveWorkspacePaths({
    workspaceRoot:
      options.workspaceRoot ?? (options.dataRoot ? join(options.dataRoot, ".service") : undefined),
    ...(options.workspaceRoot
      ? { dataRoot: options.dataRoot, runtimeRoot: options.runtimeRoot }
      : {})
  });
  // Explicit dataRoot without workspaceRoot is an isolated dependency-injection seam.
  const dataRoot = options.dataRoot ?? paths.fitnessRoot;
  const runtimeRoot = options.runtimeRoot ?? paths.runtimeRoot;
  const bridgeSecret =
    process.env.FITNESS_DSH_BRIDGE_SECRET ?? randomBytes(32).toString("base64url");
  const dshPort = Number(process.env.DSH_WEB_PORT ?? 3080);
  const dshWebHost = new DshWebHost({
    workspaceRoot: paths.workspaceRoot,
    port: dshPort,
    dshHome: paths.dshHome,
    bridgeSecret,
    agentSettingsFile: paths.settingsFile,
    profileSource: join(paths.appRoot, "dsh-fitness")
  });
  const agentRuntime =
    options.agentRuntime ??
    new DshHostAgentRuntime({
      bridgeUrl: `http://127.0.0.1:${dshPort}/fitness-automation-bridge`,
      secret: bridgeSecret
    });
  const scheduler = new AutomationScheduler(
    paths.workspaceRoot,
    dataRoot,
    paths.settingsFile,
    join(runtimeRoot, "automation", "state.yaml"),
    join(runtimeRoot, "automation", "runs"),
    agentRuntime
  );

  const dataSync = new DataSync(dataRoot);
  const server = createServer(async (request, response) => {
    applyJsonHeaders(response);
    const url = new URL(request.url ?? "/", "http://127.0.0.1");

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/data-events") {
      dataSync.subscribe(response);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/health") {
      writeJson(response, 200, {
        ok: true,
        service: "local-app-service",
        version: options.version
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/onboarding") {
      try {
        writeJson(response, 200, {
          ok: true,
          ...(await getOnboardingState({ fitnessRoot: dataRoot, runtimeRoot }))
        });
      } catch (error) {
        writeError(response, 422, error, "Failed to read onboarding progress");
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/dashboard") {
      try {
        const dashboard = await buildDashboardFromFiles({ dataRoot, readOnly: true });
        writeJson(response, 200, {
          ok: true,
          projection: dashboard.projection,
          updated: dashboard.updated
        });
      } catch (error) {
        writeJson(response, 422, {
          ok: false,
          error: error instanceof Error ? error.message : "Failed to build dashboard projection"
        });
      }
      return;
    }

    const muscleMatch = url.pathname.match(/^\/api\/muscles\/([^/]+)$/);
    if (request.method === "GET" && muscleMatch) {
      try {
        writeJson(
          response,
          200,
          await getMuscleHistoryFromFiles(
            { dataRoot, readOnly: true },
            {
              muscleId: muscleMatch[1],
              date: url.searchParams.get("date")
            }
          )
        );
      } catch (error) {
        writeError(response, 422, error, "Failed to read muscle history");
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/automation/schedule") {
      try {
        writeJson(response, 200, { ok: true, ...(await scheduler.getProjection()) });
      } catch (error) {
        writeError(response, 422, error, "Failed to read automation schedule");
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/agent/settings") {
      try {
        writeJson(response, 200, {
          ok: true,
          settings: await readAgentSettings(paths.settingsFile)
        });
      } catch (error) {
        writeError(response, 422, error, "Failed to read Agent settings");
      }
      return;
    }

    if (
      (request.method === "GET" || request.method === "PUT") &&
      ["/api/model/settings", "/api/model/preferences"].includes(url.pathname)
    ) {
      response.setHeader("Cache-Control", "no-store");
      try {
        const body =
          request.method === "PUT" ? JSON.stringify(await readJsonBody(request)) : undefined;
        dshWebHost.start();
        for (
          let attempt = 0;
          dshWebHost.status().status === "starting" && attempt < 60;
          attempt += 1
        ) {
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
        if (dshWebHost.status().status !== "ready")
          throw new Error("模型配置服务尚未就绪，请稍后重试。");
        const bridgePath =
          url.pathname === "/api/model/preferences"
            ? "fitness-model-preferences"
            : "fitness-model-settings";
        const result = await fetch(`http://127.0.0.1:${dshPort}/${bridgePath}`, {
          method: request.method,
          headers: { "Content-Type": "application/json", "x-fitness-bridge-secret": bridgeSecret },
          body,
          signal: AbortSignal.timeout(5000)
        });
        writeJson(response, result.status, await result.json());
      } catch {
        const hostStatus = dshWebHost.status();
        console.error(
          `[Fitness] ${request.method} ${url.pathname} unavailable: Host ${hostStatus.status}; ${url.pathname === "/api/model/preferences" ? "model preferences" : "credential"} bridge request failed`
        );
        writeJson(response, 503, { ok: false, error: "模型配置服务暂时不可用，请稍后重试。" });
      }
      return;
    }

    if (request.method === "PUT" && url.pathname === "/api/agent/settings") {
      try {
        const settings = await saveAgentSettings(paths.settingsFile, await readJsonBody(request));
        writeJson(response, 200, { ok: true, settings });
      } catch (error) {
        writeError(response, 422, error, "Failed to save Agent settings");
      }
      return;
    }

    if (request.method === "PUT" && url.pathname === "/api/automation/schedule") {
      try {
        const schedule = await scheduler.saveSchedule(await readJsonBody(request));
        writeJson(response, 200, { ok: true, schedule });
      } catch (error) {
        writeError(response, 422, error, "Failed to save automation schedule");
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/automation/daily-plan/run-now") {
      try {
        const state = await scheduler.runNow();
        writeJson(response, state.daily_plan.last_run?.status === "failed" ? 502 : 200, {
          ok: state.daily_plan.last_run?.status === "succeeded",
          state
        });
      } catch (error) {
        writeError(response, 502, error, "Failed to queue manual automation run");
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/dsh-web") {
      if (dshWebHost.status().status === "failed") dshWebHost.start();
      const status = dshWebHost.status();
      writeJson(response, status.status === "failed" ? 502 : 200, {
        ok: status.status !== "failed",
        ...status
      });
      return;
    }

    const planDateMatch = url.pathname.match(/^\/api\/plans\/(\d{4}-\d{2}-\d{2})$/);
    if (request.method === "GET" && (url.pathname === "/api/plans/today" || planDateMatch)) {
      try {
        const date =
          planDateMatch?.[1] ??
          url.searchParams.get("date") ??
          new Date().toISOString().slice(0, 10);
        const record = await getPlanForDate({ dataRoot, readOnly: true }, date);
        if (!record) {
          writeJson(response, 404, { ok: false, error: "No plan found for this date" });
          return;
        }
        writeJson(response, 200, { ok: true, ...record });
      } catch (error) {
        writeJson(response, 422, {
          ok: false,
          error: error instanceof Error ? error.message : "Failed to read plan"
        });
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/workouts/finish") {
      try {
        const input = await readJsonBody(request);
        const result = await finishWorkoutFromPlan({ dataRoot }, input);
        writeJson(response, 201, { ok: true, ...result });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to finish workout";
        const status = message.startsWith("Workout already exists") ? 409 : 422;
        writeJson(response, status, { ok: false, error: message });
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/workouts") {
      try {
        const library = await listWorkoutLibrary(
          { dataRoot },
          url.searchParams.get("search") ?? "",
          url.searchParams.get("today") ?? new Date().toISOString().slice(0, 10)
        );
        writeJson(response, 200, { ok: true, timeline: library.timeline });
      } catch (error) {
        writeJson(response, 422, {
          ok: false,
          error: error instanceof Error ? error.message : "Failed to list workouts"
        });
      }
      return;
    }

    const workoutMatch = url.pathname.match(/^\/api\/workouts\/(\d{4}-\d{2}-\d{2})$/);
    if (request.method === "GET" && workoutMatch) {
      try {
        const workout = await getDailyWorkout({ dataRoot }, workoutMatch[1]);
        if (!workout) {
          writeJson(response, 404, { ok: false, error: "No workout recorded for this date" });
          return;
        }
        writeJson(response, 200, { ok: true, workout });
      } catch (error) {
        writeJson(response, 422, {
          ok: false,
          error: error instanceof Error ? error.message : "Failed to read workout"
        });
      }
      return;
    }

    if (request.method === "GET" && options.staticRoot && !url.pathname.startsWith("/api/")) {
      await serveStatic(url, response, options.staticRoot);
      return;
    }

    writeJson(response, 404, {
      ok: false,
      error: "Not found"
    });
  });
  if (options.startScheduler) {
    scheduler.start();
    if (process.env.DSH_WEB_DISABLED !== "true") dshWebHost.start();
  }
  const close = server.close.bind(server);
  server.close = (...args) => {
    dataSync.close();
    return close(...args);
  };
  server.on("close", () => {
    scheduler.stop();
    dshWebHost.close();
  });
  return server;
}
